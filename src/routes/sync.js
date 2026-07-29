import { Router } from 'express';
import { runSync } from '../services/syncService.js';

export function createSyncRouter() {
  const router = Router();
  router.post('/run', async (req, res, next) => {
    try {
      const body = req.body || {};
      const result = await runSync({
        sources: body.sources || ['hubspot', 'payments', 'calendar'],
        forceStaleCursorFor: body.forceStaleCursorFor || [],
        simulateErrorFor: body.simulateErrorFor || []
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
