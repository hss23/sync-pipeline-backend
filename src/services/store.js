import fs from 'node:fs';
import crypto from 'node:crypto';
import { getDataFilePath } from '../config/storage.js';

const recordsPath = getDataFilePath('records.json');
const statePath = getDataFilePath('sync-state.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function loadStore() {
  return {
    records: readJson(recordsPath, []),
    syncState: readJson(statePath, {})
  };
}

export function saveStore(store) {
  writeJson(recordsPath, store.records);
  writeJson(statePath, store.syncState);
}

export function makeNaturalKey(source, type, externalId) {
  return `${source}:${type}:${externalId}`;
}

export function upsertRecord(store, record) {
  if (!record || !record.source || !record.sourceRecordType || !record.externalId) {
    throw new Error('Invalid record format: source, sourceRecordType, and externalId are required.');
  }

  const key = makeNaturalKey(record.source, record.sourceRecordType, record.externalId);
  const index = store.records.findIndex(
    (row) => makeNaturalKey(row.source, row.sourceRecordType, row.externalId) === key
  );

  if (index >= 0) {
    const existing = store.records[index];
    const updated = {
      ...existing,
      ...record,
      id: existing.id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.records[index] = updated;
    return updated;
  }

  const newRecord = {
    ...record,
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.records.push(newRecord);
  return newRecord;
}

export function updateSyncState(store, source, partialState) {
  store.syncState[source] = {
    ...(store.syncState[source] || {}),
    ...partialState,
    updatedAt: new Date().toISOString()
  };
}
