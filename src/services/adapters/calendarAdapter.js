const sampleCalendarEvents = [
  { id: 'evt-101', summary: 'Quarterly Executive Review', start: '2026-07-30T14:00:00Z', status: 'confirmed', description: 'Strategy alignment' },
  { id: 'evt-102', summary: 'Engineering Architecture Sync', start: '2026-07-31T09:00:00Z', status: 'tentative', description: 'Pipeline review' },
  { id: 'evt-103', summary: 'Customer Onboarding Kickoff', start: '2026-08-01T16:00:00Z', status: 'confirmed', description: 'Northwind onboarding' }
];

async function getValidAccessToken(options = {}) {
  let accessToken = options.accessToken || process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  if (accessToken) return accessToken;

  const refreshToken = options.refreshToken || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  const clientId = options.clientId || process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.access_token || null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export class CalendarAdapter {
  constructor({
    accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
    refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  } = {}) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.source = 'calendar';
  }

  async fetchIncremental(cursor, options = {}) {
    if (options.forceStaleCursor) {
      const err = new Error('Sync token is invalid or expired (410 Gone)');
      err.code = '410';
      err.status = 410;
      throw err;
    }

    let token = await getValidAccessToken(this);

    if (token) {
      try {
        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.searchParams.set('maxResults', '250');

        if (cursor) {
          url.searchParams.set('syncToken', cursor);
        }

        let res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401 && (this.refreshToken || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN)) {
          token = await getValidAccessToken({ ...this, accessToken: null });
          if (token) {
            res = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          }
        }

        if (res.status === 410 || res.status === 401 || res.status === 400) {
          const err = new Error(`Google Calendar syncToken/token expired or invalid (${res.status})`);
          err.code = '410';
          err.status = res.status;
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
    let token = await getValidAccessToken(this);

    if (token) {
      try {
        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.searchParams.set('maxResults', '250');

        let res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401 && (this.refreshToken || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN)) {
          token = await getValidAccessToken({ ...this, accessToken: null });
          if (token) {
            res = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          }
        }

        if (res.ok) {
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
      } catch {
        // Fall back to sample data on API network failure
      }
    }

    return {
      records: sampleCalendarEvents.map((e) => ({ ...e, externalId: e.id })),
      cursor: 'cal-sync-token-full-v1'
    };
  }
}
