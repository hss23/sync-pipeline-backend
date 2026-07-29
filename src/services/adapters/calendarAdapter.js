const sampleCalendarEvents = [
  { id: 'evt-101', summary: 'Quarterly Executive Review', start: '2026-07-30T14:00:00Z', status: 'confirmed', description: 'Strategy alignment' },
  { id: 'evt-102', summary: 'Engineering Architecture Sync', start: '2026-07-31T09:00:00Z', status: 'tentative', description: 'Pipeline review' },
  { id: 'evt-103', summary: 'Customer Onboarding Kickoff', start: '2026-08-01T16:00:00Z', status: 'confirmed', description: 'Northwind onboarding' }
];

function parseToken(input) {
  if (!input) return null;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export class CalendarAdapter {
  constructor({ tokenJson = process.env.GOOGLE_CALENDAR_TOKEN_JSON } = {}) {
    this.tokenJson = tokenJson;
    this.source = 'calendar';
  }

  async fetchIncremental(cursor, options = {}) {
    if (options.forceStaleCursor) {
      const err = new Error('Sync token is invalid or expired (410 Gone)');
      err.code = '410';
      err.status = 410;
      throw err;
    }

    const token = parseToken(this.tokenJson);
    if (token?.access_token) {
      try {
        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.searchParams.set('maxResults', '250');

        if (cursor) {
          url.searchParams.set('syncToken', cursor);
        }

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 410) {
          const err = new Error('Google Calendar syncToken expired (410 Gone)');
          err.code = '410';
          err.status = 410;
          throw err;
        }

        if (!res.ok) {
          throw new Error(`Google Calendar API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const records = (data.items || []).map((evt) => ({
          id: evt.id,
          summary: evt.summary || 'Untitled Event',
          start: evt.start?.dateTime || evt.start?.date || new Date().toISOString(),
          status: evt.status || 'confirmed',
          description: evt.description || ''
        }));

        const nextSyncToken = data.nextSyncToken || data.nextPageToken || cursor;
        return { records, cursor: nextSyncToken };
      } catch (err) {
        if (err.code === '410' || err.status === 410) throw err;
        throw err;
      }
    }

    // Mock Mode
    if (cursor === 'stale-token-expired') {
      const err = new Error('Google Calendar syncToken expired (410 Gone)');
      err.code = '410';
      err.status = 410;
      throw err;
    }

    const nextCursor = cursor ? `${cursor}-next` : 'cal-sync-token-v1';
    return {
      records: sampleCalendarEvents.map((e) => ({ ...e, externalId: e.id })),
      cursor: nextCursor
    };
  }

  async fetchFull() {
    const token = parseToken(this.tokenJson);
    if (token?.access_token) {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('maxResults', '250');

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Google Calendar API full fetch error: ${res.status}`);
      }

      const data = await res.json();
      const records = (data.items || []).map((evt) => ({
        id: evt.id,
        summary: evt.summary || 'Untitled Event',
        start: evt.start?.dateTime || evt.start?.date || new Date().toISOString(),
        status: evt.status || 'confirmed',
        description: evt.description || ''
      }));

      return { records, cursor: data.nextSyncToken || null };
    }

    return {
      records: sampleCalendarEvents.map((e) => ({ ...e, externalId: e.id })),
      cursor: 'cal-sync-token-full-v1'
    };
  }
}
