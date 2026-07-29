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

  app.get('/oauth2callback', async (req, res, next) => {
    try {
      const code = req.query.code;
      if (!code) {
        return res.status(400).send('Authorization code missing from query parameters.');
      }

      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
      const redirectUri = `${req.protocol}://${req.get('host')}/oauth2callback`;

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return res.status(400).json({ error: 'Failed to exchange authorization code for tokens', details: tokenData });
      }

      const fs = await import('node:fs');
      const path = await import('node:path');
      const envPath = path.resolve('.env');

      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

      if (tokenData.access_token) {
        process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = tokenData.access_token;
        if (envContent.includes('GOOGLE_CALENDAR_ACCESS_TOKEN=')) {
          envContent = envContent.replace(/GOOGLE_CALENDAR_ACCESS_TOKEN=.*/, `GOOGLE_CALENDAR_ACCESS_TOKEN=${tokenData.access_token}`);
        } else {
          envContent += `\nGOOGLE_CALENDAR_ACCESS_TOKEN=${tokenData.access_token}`;
        }
      }

      if (tokenData.refresh_token) {
        process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = tokenData.refresh_token;
        if (envContent.includes('GOOGLE_CALENDAR_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/GOOGLE_CALENDAR_REFRESH_TOKEN=.*/, `GOOGLE_CALENDAR_REFRESH_TOKEN=${tokenData.refresh_token}`);
        } else {
          envContent += `\nGOOGLE_CALENDAR_REFRESH_TOKEN=${tokenData.refresh_token}`;
        }
      }

      fs.writeFileSync(envPath, envContent, 'utf8');

      res.send('<h2 style="font-family: sans-serif; color: #10b981;">Authorization Successful!</h2><p style="font-family: sans-serif;">Your Google Calendar tokens have been automatically generated and saved to your <code>.env</code> file. You can close this window now.</p>');
    } catch (err) {
      next(err);
    }
  });

  app.use(createAppErrorMiddleware());

  return app;
}

export default createApp;
