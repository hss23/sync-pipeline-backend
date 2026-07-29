const samplePayments = [
  { id: 'pay-101', invoiceNo: 'INV-2026-001', amount: 1250.00, status: 'paid', createdAt: '2026-07-29T12:00:00Z', currency: 'USD' },
  { id: 'pay-102', invoiceNo: 'INV-2026-002', amount: 890.50, status: 'pending', createdAt: '2026-07-29T13:00:00Z', currency: 'USD' },
  { id: 'pay-103', invoiceNo: 'INV-2026-003', amount: 3400.00, status: 'paid', createdAt: '2026-07-29T15:30:00Z', currency: 'USD' }
];

export class PaymentsAdapter {
  constructor() {
    this.source = 'payments';
  }

  async fetchIncremental(cursor, options = {}) {
    if (options.forceStaleCursor) {
      const err = new Error('Payments incremental cursor is stale or invalid');
      err.code = 'stale_cursor';
      err.status = 410;
      throw err;
    }

    if (cursor === 'stale-token-expired') {
      const err = new Error('Payments cursor expired (410)');
      err.code = '410';
      err.status = 410;
      throw err;
    }

    const nextCursor = cursor ? `${cursor}-next` : 'pay-cursor-v1';
    return {
      records: samplePayments.map((p) => ({ ...p, externalId: p.id })),
      cursor: nextCursor
    };
  }

  async fetchFull() {
    return {
      records: samplePayments.map((p) => ({ ...p, externalId: p.id })),
      cursor: 'pay-cursor-full-v1'
    };
  }
}
