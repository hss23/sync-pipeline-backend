import { Router } from 'express';
import { loadStore } from '../services/store.js';

export function createRecordsRouter() {
  const router = Router();
  router.get('/', (req, res) => {
    const store = loadStore();
    res.json({ count: store.records.length, records: store.records });
  });
  return router;
}
