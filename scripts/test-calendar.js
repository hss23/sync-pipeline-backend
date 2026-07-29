import 'dotenv/config';
import { CalendarAdapter } from '../src/services/adapters/calendarAdapter.js';

console.log('=== Google Calendar API Diagnostic Tool ===\n');

const token = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || process.env.GOOGLE_CALENDAR_CLIENT_ID;
if (!token) {
  console.log('ℹ️ Google Calendar credentials not detected in .env.');
  console.log('Running adapter in Mock Seed mode...\n');
} else {
  console.log('🔑 Google Calendar OAuth credentials detected in .env.');
  if (!process.env.GOOGLE_CALENDAR_REFRESH_TOKEN && !process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) {
    console.log('💡 Note: Add GOOGLE_CALENDAR_REFRESH_TOKEN to .env to enable automatic OAuth token generation.');
  }
  console.log('');
}

const adapter = new CalendarAdapter();

try {
  console.log('Fetching events from Google Calendar adapter (Full Fetch)...');
  const fullResult = await adapter.fetchFull();
  console.log(`✅ Success! Fetched ${fullResult.records.length} records.`);
  console.log('Sample Records:');
  console.table(fullResult.records.map(r => ({ id: r.externalId || r.id, summary: r.subject || r.summary, start: r.occurredAt || r.start, status: r.status })));
  console.log(`Next Sync Token: ${fullResult.cursor || 'None'}\n`);

  console.log('Testing Incremental Fetch with cursor...');
  const incResult = await adapter.fetchIncremental(fullResult.cursor);
  console.log(`✅ Incremental Fetch Success! Returned ${incResult.records.length} updated records.`);
} catch (err) {
  console.error('❌ Calendar Integration Error:', err.message);
}
