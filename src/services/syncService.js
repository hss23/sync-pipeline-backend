import crypto from 'node:crypto';
import { loadStore, saveStore, upsertRecord, updateSyncState } from './store.js';
import { HubSpotAdapter } from './adapters/hubspotAdapter.js';
import { CalendarAdapter } from './adapters/calendarAdapter.js';
import { PaymentsAdapter } from './adapters/paymentsAdapter.js';

function createAdapter(source) {
  switch (source) {
    case 'hubspot':
      return new HubSpotAdapter();
    case 'calendar':
      return new CalendarAdapter();
    case 'payments':
      return new PaymentsAdapter();
    default:
      throw new Error(`Unsupported sync source: ${source}`);
  }
}

function shouldFallback(error) {
  if (!error) return false;
  const code = String(error.code || error.status || error.statusCode || '');
  const message = (error.message || '').toLowerCase();
  return (
    code === '410' ||
    code === 'expired_token' ||
    code === 'stale_cursor' ||
    code === 'invalid_cursor' ||
    message.includes('stale') ||
    message.includes('expired') ||
    message.includes('410') ||
    message.includes('gone')
  );
}

export function normalizeRecord(source, rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return null;
  }

  const externalId = String(
    rawPayload.externalId || rawPayload.id || rawPayload.contactId || rawPayload.paymentId || rawPayload.eventId || ''
  ).trim();

  if (!externalId) {
    return null;
  }

  let sourceRecordType = 'record';
  let subject = 'Untitled Record';
  let amount = null;
  let occurredAt = null;
  let status = 'unknown';

  if (source === 'hubspot') {
    sourceRecordType = 'contact';
    subject = rawPayload.name || rawPayload.subject || rawPayload.email || `Contact ${externalId}`;
    status = rawPayload.stage || rawPayload.status || 'lead';
    occurredAt = rawPayload.createdAt || rawPayload.occurredAt || new Date().toISOString();
  } else if (source === 'payments') {
    sourceRecordType = 'payment';
    subject = rawPayload.invoiceNo || rawPayload.subject || `Invoice ${externalId}`;
    amount = typeof rawPayload.amount === 'number' ? rawPayload.amount : parseFloat(rawPayload.amount) || null;
    status = rawPayload.status || 'pending';
    occurredAt = rawPayload.createdAt || rawPayload.occurredAt || new Date().toISOString();
  } else if (source === 'calendar') {
    sourceRecordType = 'event';
    subject = rawPayload.summary || rawPayload.subject || `Event ${externalId}`;
    status = rawPayload.status || 'confirmed';
    occurredAt = rawPayload.start || rawPayload.occurredAt || new Date().toISOString();
  } else {
    subject = rawPayload.subject || rawPayload.name || `Record ${externalId}`;
    occurredAt = rawPayload.occurredAt || new Date().toISOString();
  }

  return {
    source,
    sourceRecordType,
    externalId,
    subject,
    amount,
    occurredAt,
    status,
    metadata: rawPayload
  };
}

export async function runSync({ sources = ['hubspot', 'payments', 'calendar'], forceStaleCursorFor = [], simulateErrorFor = [] } = {}) {
  const store = loadStore();
  const results = {};

  const tasks = sources.map(async (source) => {
    try {
      if (simulateErrorFor.includes(source)) {
        throw new Error(`Source ${source} returned 500 internal server error / garbage response`);
      }

      const adapter = createAdapter(source);
      const existingState = store.syncState[source] || {};
      const cursor = existingState.cursor || null;

      try {
        const response = await adapter.fetchIncremental(cursor, {
          forceStaleCursor: forceStaleCursorFor.includes(source)
        });

        const normalizedRecords = (response.records || [])
          .map((item) => normalizeRecord(source, item))
          .filter(Boolean);

        normalizedRecords.forEach((record) => upsertRecord(store, record));

        const nextCursor = response.cursor || cursor;
        updateSyncState(store, source, {
          cursor: nextCursor,
          lastSuccessAt: new Date().toISOString(),
          lastError: null,
          lastErrorCode: null,
          lastMode: 'incremental'
        });

        results[source] = {
          status: 'ok',
          mode: 'incremental',
          recordsImported: normalizedRecords.length,
          cursor: nextCursor
        };
      } catch (error) {
        if (shouldFallback(error)) {
          // Stale cursor / 410 detected -> Fallback to full backfill
          try {
            const fullResponse = await adapter.fetchFull();
            const normalizedRecords = (fullResponse.records || [])
              .map((item) => normalizeRecord(source, item))
              .filter(Boolean);

            normalizedRecords.forEach((record) => upsertRecord(store, record));

            const newCursor = fullResponse.cursor || null;
            updateSyncState(store, source, {
              cursor: newCursor,
              lastSuccessAt: new Date().toISOString(),
              lastError: error.message,
              lastErrorCode: error.code || '410',
              lastMode: 'fullbackfill'
            });

            results[source] = {
              status: 'recovered',
              mode: 'fullbackfill',
              recordsImported: normalizedRecords.length,
              cursor: newCursor,
              reason: error.message
            };
          } catch (fallbackError) {
            updateSyncState(store, source, {
              lastError: fallbackError.message,
              lastErrorCode: fallbackError.code || 'fallback_failed'
            });
            results[source] = {
              status: 'failed',
              mode: 'fullbackfill',
              reason: fallbackError.message
            };
          }
        } else {
          // Source error (non-stale cursor, e.g. 500 / garbage response)
          updateSyncState(store, source, {
            lastError: error.message,
            lastErrorCode: error.code || 'source_error'
          });
          results[source] = {
            status: 'failed',
            mode: 'incremental',
            reason: error.message
          };
        }
      }
    } catch (outerError) {
      // Caught at source level so other tasks are unaffected
      updateSyncState(store, source, {
        lastError: outerError.message,
        lastErrorCode: 'source_failure'
      });
      results[source] = {
        status: 'failed',
        reason: outerError.message
      };
    }
  });

  await Promise.allSettled(tasks);
  saveStore(store);
  return { results, records: store.records };
}

export async function seedSampleData() {
  const store = loadStore();
  const seeded = [];

  const sources = ['hubspot', 'payments', 'calendar'];
  for (const source of sources) {
    const adapter = createAdapter(source);
    const { records } = await adapter.fetchFull();
    records.forEach((raw) => {
      const norm = normalizeRecord(source, raw);
      if (norm) {
        seeded.push(upsertRecord(store, norm));
      }
    });
  }

  saveStore(store);
  return seeded;
}

export function ingestWebhook(source, rawPayload) {
  const store = loadStore();
  const normalized = normalizeRecord(source, rawPayload);
  if (!normalized) {
    const err = new Error(`Invalid or missing required fields in webhook payload for source '${source}'`);
    err.status = 400;
    throw err;
  }
  const saved = upsertRecord(store, normalized);
  saveStore(store);
  return saved;
}
