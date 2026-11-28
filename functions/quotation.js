'use strict';

const { createHash, randomUUID } = require('node:crypto');

const invalid = (message) => {
  const error = new Error(message);
  error.status = 400;
  throw error;
};

const text = (value, label, max, required = true, multiline = false) => {
  if (typeof value !== 'string') invalid(`${label} must be text.`);
  const result = value.trim();
  const forbidden = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if ((required && !result) || result.length > max || forbidden.test(result)) {
    invalid(`Enter a valid ${label} (maximum ${max} characters).`);
  }
  return result;
};

const decimal = (value, label, max) => {
  const input = String(value ?? '');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) {
    invalid(`${label} must be a non-negative number with at most two decimal places.`);
  }
  const [whole, fraction = ''] = input.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > max * 100) invalid(`${label} is too large.`);
  return result;
};

const roundRatio = (amount, numerator, denominator) =>
  Number((BigInt(amount) * BigInt(numerator) + BigInt(denominator / 2)) / BigInt(denominator));

const calculateQuotation = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Quotation details are required.');
  const recipient = text(input.recipient, 'customer email', 254);
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(recipient)) {
    invalid('Enter one valid customer email address.');
  }
  const customer = text(input.customer, 'customer name', 150);
  const terms = text(input.terms, 'terms and exclusions', 1000, false, true);
  const overhead = decimal(input.overhead, 'Overhead percentage', 1000);
  const markup = decimal(input.markup, 'Profit markup percentage', 1000);
  const tax = decimal(input.tax, 'Tax percentage', 100);
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    invalid('Add between 1 and 50 quotation items.');
  }
  const items = input.items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid(`Item ${index + 1} is invalid.`);
    const description = text(item.description, `item ${index + 1} description`, 150);
    if (!['security', 'housekeeping'].includes(item.service)) invalid(`Choose a valid service for item ${index + 1}.`);
    if (!['monthly', 'one_time'].includes(item.period)) invalid(`Choose a valid billing period for item ${index + 1}.`);
    const quantity = decimal(item.quantity, `Item ${index + 1} quantity`, 100000);
    const unitCost = decimal(item.unitCost, `Item ${index + 1} unit cost`, 10000000);
    if (quantity === 0) invalid(`Item ${index + 1} quantity must be greater than zero.`);
    const direct = roundRatio(unitCost, quantity, 100);
    const overheadAmount = roundRatio(direct, overhead, 10000);
    const profit = roundRatio(direct + overheadAmount, markup, 10000);
    const price = direct + overheadAmount + profit;
    const taxAmount = roundRatio(price, tax, 10000);
    if (!Number.isSafeInteger(price + taxAmount) || price + taxAmount > 1000000000000) {
      invalid(`Item ${index + 1} amount exceeds the supported limit.`);
    }
    return { description, service: item.service, period: item.period, quantity, unitCost, direct, overhead: overheadAmount, profit, price, tax: taxAmount, total: price + taxAmount };
  });
  const totals = {};
  for (const period of ['monthly', 'one_time']) {
    const matching = items.filter((item) => item.period === period);
    totals[period] = {
      direct: matching.reduce((sum, item) => sum + item.direct, 0),
      overhead: matching.reduce((sum, item) => sum + item.overhead, 0),
      profit: matching.reduce((sum, item) => sum + item.profit, 0),
      price: matching.reduce((sum, item) => sum + item.price, 0),
      tax: matching.reduce((sum, item) => sum + item.tax, 0),
      total: matching.reduce((sum, item) => sum + item.total, 0),
    };
  }
  return { customer, recipient, terms, rates: { overhead, markup, tax }, items, totals };
};

const formatMoney = (paise) => `INR ${(paise / 100).toFixed(2)}`;
const formatDecimal = (hundredths) => (hundredths / 100).toFixed(2);
const serviceLabel = (service) => service === 'security' ? 'Security' : 'Housekeeping';
const periodLabel = (period) => period === 'monthly' ? 'Monthly' : 'One-time';

const createQuotationPdf = (record) => new Promise((resolve, reject) => {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);
  doc.font('Helvetica-Bold').fontSize(18).text('Civic Pulse Services - Quotation');
  doc.moveDown().font('Helvetica').fontSize(10);
  doc.text(`Quotation ID: ${record.id}`);
  doc.text(`Created: ${record.createdAt.slice(0, 10)}`);
  doc.text(`Customer: ${record.customer}`);
  doc.text(`Site: ${record.siteName}`);
  doc.text(`Survey date: ${record.surveyDate}`);
  for (const period of ['monthly', 'one_time']) {
    const items = record.items.filter((item) => item.period === period);
    if (!items.length) continue;
    doc.moveDown().font('Helvetica-Bold').fontSize(13).text(`${periodLabel(period)} charges`);
    doc.fontSize(10);
    for (const item of items) {
      doc.moveDown(0.5).font('Helvetica-Bold').text(`${serviceLabel(item.service)} - ${item.description}`);
      doc.font('Helvetica').text(`Quantity: ${formatDecimal(item.quantity)}   |   Price before tax: ${formatMoney(item.price)}`);
    }
    const totals = record.totals[period];
    doc.moveDown(0.5).font('Helvetica').text(`Subtotal: ${formatMoney(totals.price)}`);
    doc.text(`Tax (${formatDecimal(record.rates.tax)}%): ${formatMoney(totals.tax)}`);
    doc.font('Helvetica-Bold').text(`${periodLabel(period)} total: ${formatMoney(totals.total)}`);
  }
  if (record.terms) doc.moveDown().font('Helvetica-Bold').text('Terms and exclusions').font('Helvetica').text(record.terms);
  doc.end();
});

const sendQuotationPdf = async (record, credentials) => {
  const google = require('googleapis').google;
  const auth = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
  auth.setCredentials({ refresh_token: credentials.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });
  const pdf = await createQuotationPdf(record);
  const boundary = `civicpulse_${randomUUID()}`;
  const subject = `Quotation for ${record.customer} - ${record.siteName}`;
  const encode = (buffer) => buffer.toString('base64').match(/.{1,76}/g).join('\r\n');
  const mime = [
    `To: ${record.recipient}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encode(Buffer.from(`Please find attached your quotation from Civic Pulse Services.\nQuotation ID: ${record.id}`, 'utf8')),
    `--${boundary}`,
    'Content-Type: application/pdf; name="civic-pulse-quotation.pdf"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="civic-pulse-quotation.pdf"',
    '',
    encode(pdf),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(mime).toString('base64url') } });
};

const requestHash = (siteId, surveyId, quotation) =>
  createHash('sha256').update(JSON.stringify({ siteId, surveyId, quotation })).digest('hex');

module.exports = { calculateQuotation, createQuotationPdf, sendQuotationPdf, requestHash, formatMoney };
