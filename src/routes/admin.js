import { Router } from 'express';
import { seedSampleData } from '../services/syncService.js';
import { loadStore } from '../services/store.js';

export function createAdminRouter() {
  const router = Router();
  router.post('/seed', async (req, res, next) => {
    try {
      const seeded = await seedSampleData();
      res.json({ ok: true, seeded });
    } catch (err) {
      next(err);
    }
  });

  router.get('/sync/status', (req, res) => {
    const store = loadStore();
    res.json({ syncState: store.syncState });
  });
  return router;
}
