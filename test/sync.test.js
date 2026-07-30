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

test('docs UI and OpenAPI spec are available', async () => {
  const docsRes = await fetch(`${baseUrl}/docs`);
  assert.equal(docsRes.status, 200);
  const docsHtml = await docsRes.text();
  assert.match(docsHtml, /Sync Pipeline API/i);

  const specRes = await fetch(`${baseUrl}/docs/openapi.json`);
  assert.equal(specRes.status, 200);
  const spec = await specRes.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.paths['/health']);
});

test('HubSpot adapter reads the access token from project env config', async () => {
  const envPath = path.resolve('./.env');
  const previousEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  try {
    fs.writeFileSync(envPath, 'HUBSPOT_ACCESS_TOKEN=from-env-file\n', 'utf8');
    delete process.env.HUBSPOT_ACCESS_TOKEN;

    const { HubSpotAdapter } = await import('../src/services/adapters/hubspotAdapter.js');
    const adapter = new HubSpotAdapter();

    assert.equal(adapter.token, 'from-env-file');
  } finally {
    if (previousEnv) {
      fs.writeFileSync(envPath, previousEnv, 'utf8');
    } else {
      fs.rmSync(envPath, { force: true });
    }
    process.env.HUBSPOT_ACCESS_TOKEN = '';
  }
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
  assert.ok(['ok', 'recovered'].includes(firstBody.results.hubspot.status));
  assert.ok(['ok', 'recovered'].includes(firstBody.results.payments.status));
  assert.ok(['ok', 'recovered'].includes(firstBody.results.calendar.status));

  const firstRecords = await (await fetch(`${baseUrl}/records`)).json();

  // Re-run back-to-back
  const secondSync = await fetch(`${baseUrl}/sync/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sources: ['hubspot', 'payments', 'calendar'] })
  });
  const secondBody = await secondSync.json();
  assert.equal(secondSync.status, 200);
  assert.ok(['ok', 'recovered'].includes(secondBody.results.hubspot.status));

  const recordsResponse = await fetch(`${baseUrl}/records`);
  const recordsBody = await recordsResponse.json();
  assert.ok(recordsBody.count > 0);
  assert.equal(recordsBody.count, firstRecords.count); // Guarantees zero duplicate rows on re-runs

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
  assert.ok(['ok', 'recovered'].includes(body.results.hubspot.status));
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
  assert.ok(['ok', 'recovered'].includes(body.results.payments.status));
  assert.ok(['ok', 'recovered'].includes(body.results.calendar.status));

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
