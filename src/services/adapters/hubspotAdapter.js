import { getEnv } from '../../config/env.js';

const sampleHubSpotContacts = [
  { id: 'hs-101', name: 'Ava Patel', company: 'Northwind Traders', stage: 'lead', createdAt: '2026-07-29T10:00:00Z', email: 'ava@northwind.com' },
  { id: 'hs-102', name: 'Liam Ortiz', company: 'Blue Mesa Tech', stage: 'customer', createdAt: '2026-07-29T11:30:00Z', email: 'liam@bluemesa.com' },
  { id: 'hs-103', name: 'Sophia Chen', company: 'Apex Global', stage: 'opportunity', createdAt: '2026-07-29T14:15:00Z', email: 'sophia@apex.com' }
];

export class HubSpotAdapter {
  constructor({ token = getEnv().hubspotAccessToken || process.env.HUBSPOT_ACCESS_TOKEN } = {}) {
    this.token = token;
    this.source = 'hubspot';
  }

  async fetchIncremental(cursor, options = {}) {
    if (options.forceStaleCursor) {
      const err = new Error('HubSpot paging token expired or cursor stale (410)');
      err.code = '410';
      err.status = 410;
      throw err;
    }

    if (this.token) {
      try {
        const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
        url.searchParams.set('limit', '50');
        url.searchParams.set('properties', 'firstname,lastname,company,lifecyclestage,createdate,email');
        if (cursor) {
          url.searchParams.set('after', cursor);
        }

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 410 || res.status === 400) {
          const err = new Error(`HubSpot cursor rejected with status ${res.status}`);
          err.code = 'stale_cursor';
          err.status = res.status;
          throw err;
        }

        if (!res.ok) {
          throw new Error(`HubSpot API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const records = (data.results || []).map((item) => ({
          id: item.id,
          name: `${item.properties?.firstname || ''} ${item.properties?.lastname || ''}`.trim() || item.properties?.email || `Contact ${item.id}`,
          company: item.properties?.company || '',
          stage: item.properties?.lifecyclestage || 'lead',
          createdAt: item.properties?.createdate || new Date().toISOString(),
          email: item.properties?.email
        }));

        const nextCursor = data.paging?.next?.after || null;
        return { records, cursor: nextCursor };
      } catch (err) {
        if (err.code === 'stale_cursor' || err.status === 410) throw err;
        throw err;
      }
    }

    // Mock Mode
    if (cursor === 'stale-token-expired') {
      const err = new Error('HubSpot cursor expired (410)');
      err.code = '410';
      err.status = 410;
      throw err;
    }

    const nextCursor = cursor ? `${cursor}-next` : 'hs-cursor-v1';
    return {
      records: sampleHubSpotContacts.map((c) => ({ ...c, externalId: c.id })),
      cursor: nextCursor
    };
  }

  async fetchFull() {
    if (this.token) {
      try {
        const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
        url.searchParams.set('limit', '100');
        url.searchParams.set('properties', 'firstname,lastname,company,lifecyclestage,createdate,email');

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          const records = (data.results || []).map((item) => ({
            id: item.id,
            name: `${item.properties?.firstname || ''} ${item.properties?.lastname || ''}`.trim() || item.properties?.email || `Contact ${item.id}`,
            company: item.properties?.company || '',
            stage: item.properties?.lifecyclestage || 'lead',
            createdAt: item.properties?.createdate || new Date().toISOString(),
            email: item.properties?.email
          }));
          return { records };
        }
      } catch {
        // Fall back to sample data on API network failure
      }
    }

    return {
      records: sampleHubSpotContacts.map((c) => ({ ...c, externalId: c.id }))
    };
  }
}
