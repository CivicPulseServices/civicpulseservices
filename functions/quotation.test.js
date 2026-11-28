'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { calculateQuotation, createQuotationPdf, requestHash } = require('./quotation');
const { deliverQuotation } = require('./quotation-delivery');

const input = () => ({
  customer: 'Example Society', recipient: 'client@example.com', terms: 'Pay monthly.\nNo civil work.',
  overhead: '10', markup: '20', tax: '18',
  items: [
    { service: 'security', period: 'monthly', description: 'Security guards', quantity: '2', unitCost: '10000' },
    { service: 'housekeeping', period: 'one_time', description: 'Machine setup', quantity: '1', unitCost: '5000' },
  ],
});

test('calculates monthly and one-time totals using line-level paise rounding', () => {
  const quote = calculateQuotation(input());
  assert.deepEqual(quote.totals.monthly, { direct: 2000000, overhead: 200000, profit: 440000, price: 2640000, tax: 475200, total: 3115200 });
  assert.deepEqual(quote.totals.one_time, { direct: 500000, overhead: 50000, profit: 110000, price: 660000, tax: 118800, total: 778800 });
  const fractional = input();
  fractional.overhead = '0'; fractional.markup = '0'; fractional.tax = '0';
  fractional.items = [{ service: 'security', period: 'monthly', description: 'Partial', quantity: '0.50', unitCost: '0.01' }];
  assert.equal(calculateQuotation(fractional).totals.monthly.total, 1);
});

test('rejects invalid pricing, recipients, and header injection', () => {
  for (const [field, value] of [['tax', '101'], ['markup', '-1'], ['overhead', '1.001'], ['recipient', 'client@example.com\r\nBcc: other@example.com']]) {
    const data = input(); data[field] = value;
    assert.throws(() => calculateQuotation(data), { status: 400 });
  }
  for (const [field, value] of [['quantity', '0'], ['unitCost', '1e9'], ['service', 'facility'], ['period', 'weekly']]) {
    const data = input(); data.items[0][field] = value;
    assert.throws(() => calculateQuotation(data), { status: 400 });
  }
  assert.notEqual(requestHash('one', 'survey', calculateQuotation(input())), requestHash('two', 'survey', calculateQuotation(input())));
});

test('creates an actual PDF and customer PDF text omits internal cost and profit', async () => {
  const record = { ...calculateQuotation(input()), id: 'quote-1', siteName: 'Example', surveyDate: '2026-01-01', createdAt: '2026-01-02T00:00:00Z' };
  const pdf = await createQuotationPdf(record);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const lines = [];
  class FakePdf extends EventEmitter {
    font() { return this; }
    fontSize() { return this; }
    moveDown() { return this; }
    text(value) { lines.push(value); return this; }
    end() { this.emit('data', Buffer.from('PDF')); this.emit('end'); }
  }
  const original = Module._load;
  Module._load = function (name, ...args) {
    return name === 'pdfkit' ? FakePdf : original.call(this, name, ...args);
  };
  try {
    await createQuotationPdf(record);
  } finally {
    Module._load = original;
  }
  const customerText = lines.join('\n');
  assert.match(customerText, /Security guards/);
  assert.match(customerText, /Monthly total: INR 31152\.00/);
  assert.match(customerText, /One-time total: INR 7788\.00/);
  assert.doesNotMatch(customerText, /overhead|markup|profit|unit cost/i);
  assert.doesNotMatch(customerText, /INR 10000\.00|INR 5000\.00/);
});

const fakeDb = (initial, failSentUpdate = false) => {
  let state = initial ? { ...initial } : null;
  let lock = Promise.resolve();
  const ref = {
    update: async (value) => {
      if (failSentUpdate && value.status === 'sent') throw new Error('tracking unavailable');
      Object.assign(state, value);
    },
  };
  return {
    state: () => state,
    collection: () => ({ doc: () => ref }),
    runTransaction: (callback) => {
      const task = lock.then(() => callback({
        get: async () => ({ exists: !!state, data: () => ({ ...state }) }),
        update: (_ref, value) => Object.assign(state, value),
      }));
      lock = task.catch(() => {});
      return task;
    },
  };
};

test('claims delivery once, including concurrent sends', async () => {
  const db = fakeDb({ status: 'draft' });
  let sends = 0;
  let finish;
  const sending = new Promise((resolve) => { finish = resolve; });
  const send = async () => { sends += 1; await sending; };
  const first = deliverQuotation({ db, id: 'one', send });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(deliverQuotation({ db, id: 'one', send }), { status: 409 });
  finish();
  await first;
  assert.equal(db.state().status, 'sent');
  assert.equal(sends, 1);
  await assert.rejects(deliverQuotation({ db, id: 'one', send }), { status: 409 });
});

test('does not automatically retry uncertain delivery or failed tracking', async () => {
  const oldError = console.error;
  console.error = () => {};
  try {
    const db = fakeDb({ status: 'draft' });
    await assert.rejects(deliverQuotation({ db, id: 'one', send: async () => { throw new Error('timeout'); } }), { saved: true });
    assert.equal(db.state().status, 'delivery_unknown');
    await assert.rejects(deliverQuotation({ db, id: 'one', send: async () => {} }), { status: 409 });
    const tracking = fakeDb({ status: 'draft' }, true);
    await assert.rejects(deliverQuotation({ db: tracking, id: 'one', send: async () => {} }), { saved: true, emailSent: true });
    assert.equal(tracking.state().status, 'sending');
    await assert.rejects(deliverQuotation({ db: tracking, id: 'one', send: async () => {} }), { status: 409 });
  } finally {
    console.error = oldError;
  }
});
