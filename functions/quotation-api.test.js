'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const setup = () => {
  let role = 'super_admin';
  let sends = 0;
  const documents = new Map();
  const survey = {
    society_name: 'Example Society',
    services: { security: true, housekeeping: false },
    checkpoints: {},
  };
  const rows = {
    Access: [['google_email', 'role', 'site_id', 'active'], ['admin@example.com', role, 'site-1', 'TRUE']],
    Sites: [['site_id', 'site_name', 'active'], ['site-1', 'Example', 'TRUE']],
    'Site Surveys': [['survey_id', 'site_id', 'site_name', 'survey_date', 'surveyor_email', 'submitted_at', 'survey_json'], ['survey-1', 'site-1', 'Example', '2026-01-01', 'admin@example.com', '2026-01-01T00:00:00Z', JSON.stringify(survey)]],
  };
  const sheets = { spreadsheets: {
    get: async () => ({ data: { sheets: [{ properties: { title: 'Site Surveys' } }] } }),
    values: {
      get: async ({ range }) => {
        const name = range.match(/^'([^']+)'/)[1];
        if (name === 'Access') rows.Access[1][1] = role;
        return { data: { values: rows[name] } };
      },
      update: async () => ({}),
    },
  } };
  const db = {
    collection: () => ({
      doc: (id) => ({
        id,
        get: async () => ({ exists: documents.has(id), data: () => documents.get(id) }),
        update: async (value) => documents.set(id, { ...documents.get(id), ...value }),
      }),
      get: async () => ({ docs: [...documents.values()].map((record) => ({ data: () => record })) }),
      where: (_field, _operator, siteId) => ({
        get: async () => ({ docs: [...documents.values()].filter((record) => record.siteId === siteId).map((record) => ({ data: () => record })) }),
      }),
    }),
    runTransaction: async (callback) => callback({
      get: async (ref) => ref.get(),
      create: (ref, value) => documents.set(ref.id, value),
      update: (ref, value) => documents.set(ref.id, { ...documents.get(ref.id), ...value }),
    }),
  };
  const quotation = require('./quotation');
  const stubs = {
    'firebase-admin/app': { initializeApp: () => {} },
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async () => ({ uid: 'user', email: 'admin@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }) }) },
    'firebase-admin/firestore': { getFirestore: () => db },
    'firebase-functions/params': { defineString: () => ({ value: () => '' }), defineSecret: () => ({ value: () => 'secret' }) },
    'firebase-functions/v2/https': { onRequest: (_options, handler) => handler },
    googleapis: { google: { auth: { GoogleAuth: class {} }, sheets: () => sheets } },
    './quotation': { ...quotation, sendQuotationPdf: async () => { sends += 1; } },
    './quotation-delivery': require('./quotation-delivery'),
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  vm.runInNewContext(source, {
    exports, Buffer, console,
    require: (name) => stubs[name] || require(name),
  }, { filename: 'index.js' });
  const call = async (method, endpoint, body = {}, query = {}) => {
    const req = { method, path: endpoint, body, query, get: (name) => name === 'authorization' ? 'Bearer token' : '' };
    const res = {
      statusCode: 200,
      set() { return this; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
      send(value) { this.body = value; return this; },
    };
    await exports.adminApi(req, res);
    return res;
  };
  return { call, setRole: (value) => { role = value; }, documents, sends: () => sends };
};

const quote = () => ({
  customer: 'Example Society', recipient: 'client@example.com', terms: '', overhead: '10', markup: '20', tax: '18',
  items: [{ service: 'security', period: 'monthly', description: 'Guard', quantity: '2', unitCost: '10000' }],
});

test('only super-admins can use all quotation endpoints', async () => {
  const api = setup();
  for (const role of ['site_admin', 'viewer']) {
    api.setRole(role);
    for (const [method, endpoint, body, query] of [
      ['GET', '/quotations', {}, { siteId: 'site-1' }],
      ['GET', '/quotations/pdf', {}, { id: 'one' }],
      ['POST', '/quotations/calculate', { quotation: quote() }, {}],
      ['POST', '/quotations', { id: 'one', siteId: 'site-1', surveyId: 'survey-1', quotation: quote() }, {}],
      ['POST', '/quotations/send', { id: 'one' }, {}],
    ]) {
      assert.equal((await api.call(method, endpoint, body, query)).statusCode, 403, `${role} ${endpoint}`);
    }
  }
  assert.equal(api.documents.size, 0);
});

test('creates an immutable survey-linked quote, serves PDF, and sends only once', async () => {
  const api = setup();
  const body = { id: 'one', siteId: 'site-1', surveyId: 'survey-1', quotation: quote() };
  assert.equal((await api.call('POST', '/quotations', body)).statusCode, 200);
  assert.equal(api.documents.get('one').surveySnapshot.society_name, 'Example Society');
  assert.equal((await api.call('POST', '/quotations', body)).statusCode, 200);
  const changed = { ...body, quotation: { ...body.quotation, customer: 'Changed' } };
  assert.equal((await api.call('POST', '/quotations', changed)).statusCode, 409);
  const invalid = { ...body, id: 'two', quotation: { ...quote(), items: [{ ...quote().items[0], service: 'housekeeping' }] } };
  assert.equal((await api.call('POST', '/quotations', invalid)).statusCode, 400);
  const pdf = await api.call('GET', '/quotations/pdf', {}, { id: 'one' });
  assert.equal(pdf.statusCode, 200);
  assert.equal(pdf.body.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await api.call('POST', '/quotations/send', { id: 'one' })).statusCode, 200);
  assert.equal((await api.call('POST', '/quotations/send', { id: 'one' })).statusCode, 409);
  assert.equal(api.sends(), 1);
});
