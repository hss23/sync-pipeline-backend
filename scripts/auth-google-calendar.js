import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import 'dotenv/config';

const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('❌ Missing GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET in .env');
  process.exit(1);
}

const redirectUri = 'http://localhost:3000/oauth2callback';
const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');

const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

console.log('=== Google Calendar Automated OAuth Setup ===\n');
console.log('1. Open this URL in your browser to authorize Google Calendar:\n');
console.log(`👉  ${authUrl}\n`);
console.log('2. Waiting for authorization code on http://localhost:3000/oauth2callback ...\n');

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost:3000');
  if (reqUrl.pathname === '/oauth2callback') {
    const code = reqUrl.searchParams.get('code');
    if (!code) {
      res.end('Authorization code missing.');
      return;
    }

    try {
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
        res.end(`Error exchanging code for token: ${tokenData.error_description || tokenData.error}`);
        console.error('Token Error:', tokenData);
        server.close();
        return;
      }

      console.log('✅ Tokens successfully generated from Google OAuth!');

      const envPath = path.resolve('.env');
      let envContent = fs.readFileSync(envPath, 'utf8');

      if (tokenData.access_token) {
        envContent = envContent.replace(/GOOGLE_CALENDAR_ACCESS_TOKEN=.*/, `GOOGLE_CALENDAR_ACCESS_TOKEN=${tokenData.access_token}`);
      }
      if (tokenData.refresh_token) {
        envContent = envContent.replace(/GOOGLE_CALENDAR_REFRESH_TOKEN=.*/, `GOOGLE_CALENDAR_REFRESH_TOKEN=${tokenData.refresh_token}`);
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('🎉 Saved GOOGLE_CALENDAR_ACCESS_TOKEN and GOOGLE_CALENDAR_REFRESH_TOKEN into .env!\n');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2 style="font-family: sans-serif; color: #10b981;">Authorization Successful!</h2><p style="font-family: sans-serif;">Your Google Calendar tokens have been automatically generated and saved to your <code>.env</code> file. You can close this window now.</p>');
    } catch (err) {
      res.end(`Error: ${err.message}`);
    } finally {
      setTimeout(() => server.close(), 1000);
    }
  }
});

server.listen(3000);
