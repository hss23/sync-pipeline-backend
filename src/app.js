import express from 'express';
import { createHealthRouter } from './routes/health.js';
import { createSyncRouter } from './routes/sync.js';
import { createRecordsRouter } from './routes/records.js';
import { createWebhookRouter } from './routes/webhook.js';
import { createAdminRouter } from './routes/admin.js';
import { createAppErrorMiddleware } from './middleware/error.js';
import { ensureDataDir } from './config/storage.js';

export function createApp() {
  ensureDataDir();
  const app = express();
  app.use(express.json());

  app.use('/health', createHealthRouter());
  app.use('/sync', createSyncRouter());
  app.use('/records', createRecordsRouter());
  app.use('/webhook', createWebhookRouter());
  app.use('/admin', createAdminRouter());
  app.use(createAppErrorMiddleware());

  return app;
}

export default createApp;
