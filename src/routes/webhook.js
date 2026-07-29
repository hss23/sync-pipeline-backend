import { Router } from 'express';
import { ingestWebhook } from '../services/syncService.js';

export function createWebhookRouter() {
  const router = Router();
  router.post('/:source', (req, res, next) => {
    try {
      const { source } = req.params;
      const record = ingestWebhook(source, req.body || {});
      res.json({ ok: true, naturalKey: `${record.source}:${record.sourceRecordType}:${record.externalId}` });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
