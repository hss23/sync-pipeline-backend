import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SYNC_DATA_DIR = path.resolve('./tmp-test-data');

const { createApp } = await import('../src/app.js');

let server;
let baseUrl;

test.before(async () => {
  fs.rmSync(process.env.SYNC_DATA_DIR, { recursive: true, force: true });
  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('health endpoint returns 200 OK', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'sync-pipeline-backend');
});

test('sync run ingests multi-source data into normalized schema and avoids duplicates on re-runs', async () => {
  const seedResponse = await fetch(`${baseUrl}/admin/seed`, { method: 'POST' });
  assert.equal(seedResponse.status, 200);

  const firstSync = await fetch(`${baseUrl}/sync/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sources: ['hubspot', 'payments', 'calendar'] })
  });
  const firstBody = await firstSync.json();
  assert.equal(firstSync.status, 200);
  assert.equal(firstBody.results.hubspot.status, 'ok');
  assert.equal(firstBody.results.payments.status, 'ok');
  assert.equal(firstBody.results.calendar.status, 'ok');

  // Re-run back-to-back
  const secondSync = await fetch(`${baseUrl}/sync/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sources: ['hubspot', 'payments', 'calendar'] })
  });
  const secondBody = await secondSync.json();
  assert.equal(secondSync.status, 200);
  assert.equal(secondBody.results.hubspot.status, 'ok');

  const recordsResponse = await fetch(`${baseUrl}/records`);
  const recordsBody = await recordsResponse.json();
  assert.equal(recordsBody.count, 9); // 9 total unique records across hubspot (3), payments (3), and calendar (3)

  // Verify normalized schema fields on records
  const sample = recordsBody.records[0];
  assert.ok(sample.id);
  assert.ok(sample.source);
  assert.ok(sample.sourceRecordType);
  assert.ok(sample.externalId);
  assert.ok(sample.subject);
  assert.ok(sample.createdAt);
  assert.ok(sample.updatedAt);
});

test('stale cursor / 410 error triggers automatic full backfill fallback', async () => {
  const syncResponse = await fetch(`${baseUrl}/sync/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sources: ['hubspot', 'payments', 'calendar'],
      forceStaleCursorFor: ['payments', 'calendar']
    })
  });
  const body = await syncResponse.json();
  assert.equal(syncResponse.status, 200);
  assert.equal(body.results.payments.status, 'recovered');
  assert.equal(body.results.payments.mode, 'fullbackfill');
  assert.equal(body.results.calendar.status, 'recovered');
  assert.equal(body.results.calendar.mode, 'fullbackfill');
  assert.equal(body.results.hubspot.status, 'ok');
});

test('partial failure isolation allows healthy sources to land data when one source fails', async () => {
  const syncResponse = await fetch(`${baseUrl}/sync/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sources: ['hubspot', 'payments', 'calendar'],
      simulateErrorFor: ['hubspot']
    })
  });
  const body = await syncResponse.json();
  assert.equal(syncResponse.status, 200);
  assert.equal(body.results.hubspot.status, 'failed');
  assert.equal(body.results.payments.status, 'ok');
  assert.equal(body.results.calendar.status, 'ok');

  const statusResponse = await fetch(`${baseUrl}/admin/sync/status`);
  const statusBody = await statusResponse.json();
  assert.ok(statusBody.syncState.hubspot.lastError.includes('500'));
});

test('webhook ingestion is idempotent and protects against duplicate events', async () => {
  const payload = {
    id: 'pay-999',
    invoiceNo: 'INV-999',
    amount: 500,
    status: 'paid'
  };

  const firstCall = await fetch(`${baseUrl}/webhook/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(firstCall.status, 200);

  const secondCall = await fetch(`${baseUrl}/webhook/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(secondCall.status, 200);

  const recordsResponse = await fetch(`${baseUrl}/records`);
  const recordsBody = await recordsResponse.json();
  const matched = recordsBody.records.filter((r) => r.externalId === 'pay-999');
  assert.equal(matched.length, 1);
});

test('garbage or malformed webhook payload is cleanly rejected with HTTP 400', async () => {
  const invalidCall = await fetch(`${baseUrl}/webhook/hubspot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ randomField: 'no_id_here' })
  });
  assert.equal(invalidCall.status, 400);
  const body = await invalidCall.json();
  assert.ok(body.error.includes('Invalid or missing required fields'));
});
