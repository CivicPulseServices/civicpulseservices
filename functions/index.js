'use strict';

const { randomUUID } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { defineSecret, defineString } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');

initializeApp();

const spreadsheetId = defineString('SPREADSHEET_ID');
const allowedWebOrigins = defineString('ALLOWED_WEB_ORIGINS');
const gmailOAuthClientId = defineSecret('GMAIL_OAUTH_CLIENT_ID');
const gmailOAuthClientSecret = defineSecret('GMAIL_OAUTH_CLIENT_SECRET');
const gmailRefreshToken = defineSecret('GMAIL_REFRESH_TOKEN');

const getGoogle = () => require('googleapis').google;

const dataTabs = new Set([
  'Users',
  'Properties',
  'Staff',
  'Residents',
  'Operations',
  'Attendance',
]);
const adminTabs = new Set(['Sites', 'Access']);
const validTabs = new Set([...dataTabs, ...adminTabs]);
const idColumns = {
  Users: 'uid',
  Properties: 'property_id',
  Staff: 'staff_id',
  Residents: 'resident_id',
  Operations: 'operation_id',
  Attendance: 'attendance_id',
  Sites: 'site_id',
};
const surveyTab = 'Site Surveys';
const surveyHeaders = [
  'survey_id',
  'site_id',
  'site_name',
  'survey_date',
  'surveyor_email',
  'submitted_at',
  'survey_json',
  'email_submission_id',
  'email_status',
];

const getSheets = async () => {
  const google = getGoogle();
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

const tabRange = (tab) => `'${tab.replace(/'/g, "''")}'`;

const readTab = async (sheets, tab) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId.value(),
    range: `${tabRange(tab)}!A:Z`,
  });
  const values = response.data.values || [];
  const headers = values[0] || [];
  if (!headers.length) {
    throw new Error(`The ${tab} sheet is missing its header row.`);
  }
  const records = values.slice(1).map((cells, index) => {
    const record = {};
    headers.forEach((header, column) => {
      if (header) record[header] = cells[column] ?? '';
    });
    record._rowNumber = index + 2;
    return record;
  }).filter((record) => Object.values(record).some((value) => value !== ''));
  return { headers, records };
};

const ensureSurveyTab = async (sheets) => {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId.value(),
    fields: 'sheets.properties.title',
  });
  const exists = (response.data.sheets || []).some((sheet) => sheet.properties?.title === surveyTab);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId.value(),
      requestBody: {
        requests: [{ addSheet: { properties: { title: surveyTab } } }],
      },
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId.value(),
    range: `${tabRange(surveyTab)}!A1:I1`,
    valueInputOption: 'RAW',
    requestBody: { values: [surveyHeaders] },
  });
};

const assertSurveyAdmin = (permission, siteId) => {
  requireSite(permission, siteId);
  if (!permission.superAdmin && permission.siteRoles[siteId] !== 'site_admin') {
    const error = new Error('Site surveys are available to site admins and Civic Pulse admins only.');
    error.status = 403;
    throw error;
  }
};

const listSurveys = async (sheets, permission, siteId) => {
  if (siteId === '*') {
    if (!permission.superAdmin) {
      const error = new Error('Only a Civic Pulse admin can view surveys across all sites.');
      error.status = 403;
      throw error;
    }
  } else {
    assertSurveyAdmin(permission, siteId);
  }
  await ensureSurveyTab(sheets);
  const { records } = await readTab(sheets, surveyTab);
  return siteId === '*'
    ? records
    : records.filter((record) => String(record.site_id) === String(siteId));
};

const createSurveyPdf = (siteName, survey) => new Promise((resolve, reject) => {
  const PDFDocument = require('pdfkit');
  const document = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks = [];
  document.on('data', (chunk) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);

  const line = (label, value) => {
    document.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    document.font('Helvetica').text(String(value || 'Not provided'));
  };
  document.fontSize(18).font('Helvetica-Bold').text('Civic Pulse Services - Integrated Site Survey');
  document.moveDown();
  document.fontSize(10);
  line('Site', siteName);
  line('Society / federation', survey.society_name);
  line('Surveyor', survey.surveyor_name);
  line('Survey date', survey.survey_date);
  line('Location', survey.location_landmark);
  line('Wings / flats', survey.total_wings_flats);
  line('MC / admin contact', survey.mc_admin_contact);
  line('Phone / email', survey.phone_email);
  line('Civic Pulse lead', survey.civic_pulse_lead);
  line('Technical partner lead', survey.technical_partner_lead);

  const serviceLabels = {
    estate_manager: 'Estate manager / admin',
    housekeeping: 'Housekeeping & cleaning',
    security: 'Security & traffic',
    gardening: 'Gardening & OWC',
    stp_wtp: 'STP & WTP',
    water: 'Water supply & tankers',
    garbage: 'Garbage & scrap management',
    mep: 'MEP (electrical / plumbing)',
    dg_lifts_fire_solar: 'DG, lifts, fire & solar',
    amenities: 'Clubhouse & amenities',
    pest_control: 'Pest control & tanks',
    software_accounting: 'Software / accounting',
    common_infrastructure: 'Common infrastructure / roads / lights',
    commercial: 'Commercial & pricing inputs',
  };
  document.moveDown().font('Helvetica-Bold').text('Selected service scope');
  const selectedServices = Object.entries(survey.services || {})
    .filter(([, selected]) => selected)
    .map(([id]) => serviceLabels[id] || id);
  document.font('Helvetica').text(selectedServices.join(', ') || 'No services selected');

  (survey.additional_scopes || []).forEach((scope, index) => {
    document.moveDown(0.5).font('Helvetica-Bold').text(`Additional scope ${index + 1}: ${scope.name}`);
    document.font('Helvetica').text(`Status: ${scope.status || 'Not assessed'}\nNotes: ${scope.notes || 'Not provided'}`);
  });

  document.moveDown().font('Helvetica-Bold').text('Survey questions and findings');
  const checkpoints = survey.checkpoints || {};
  let previousSection = '';
  let previousSectionId = '';
  const writeSectionNotes = (sectionId) => {
    const notes = survey.section_notes?.[sectionId];
    if (notes) {
      document.moveDown(0.5).font('Helvetica-Bold').text('Additional section notes');
      document.font('Helvetica').text(notes);
    }
  };
  Object.entries(checkpoints).forEach(([id, answer]) => {
    if (answer.section && answer.section !== previousSection) {
      writeSectionNotes(previousSectionId);
      document.moveDown().font('Helvetica-Bold').text(answer.section);
      previousSection = answer.section;
      previousSectionId = answer.section.match(/^Section\s+(\d+)/)?.[1] || '';
    }
    document.moveDown(0.5).font('Helvetica-Bold').text(`${id}. ${answer.question || 'Checklist item'}`);
    if (answer.choice !== undefined) {
      document.font('Helvetica').text(`Selected: ${answer.choice_label || answer.choice}${answer.choice === 'other' && answer.other ? ` — ${answer.other}` : ''}`);
    } else {
      const checked = answer.checked ?? !['not_assessed', 'not_applicable'].includes(answer.status);
      document.font('Helvetica').text(`${checked ? '[x] Inspected' : '[ ] Not inspected'}${answer.value || answer.notes ? `  |  ${answer.value || answer.notes}` : ''}`);
    }
  });
  writeSectionNotes(previousSectionId);
  Object.entries(survey.section_scope || {}).forEach(([id, scope]) => {
    document.font('Helvetica').text(`Section ${id} scope: ${scope}`);
  });

  document.moveDown().font('Helvetica-Bold').text('Critical snags');
  document.font('Helvetica').text((survey.critical_snags || []).join('\n') || 'None recorded');
  document.moveDown().font('Helvetica-Bold').text('Sign-off');
  line('Society representative', survey.sign_off?.society_representative);
  line('Technical partner', survey.sign_off?.technical_partner);
  line('Civic Pulse representative', survey.sign_off?.civic_pulse_representative);
  line('Sign-off date', survey.sign_off?.date);
  document.moveDown().font('Helvetica-Bold').text('Annex A - Site sketch / shared infrastructure');
  document.font('Helvetica').text(survey.annex_a_map_notes || 'Not provided');
  document.moveDown().font('Helvetica-Bold').text('Annex B - Follow-up actions');
  document.font('Helvetica').text(survey.annex_b_actions || 'Not provided');
  document.end();
});

const sendSurveyPdf = async (siteName, survey, surveyId) => {
  const google = getGoogle();
  const auth = new google.auth.OAuth2(
    gmailOAuthClientId.value(),
    gmailOAuthClientSecret.value(),
  );
  auth.setCredentials({ refresh_token: gmailRefreshToken.value() });
  const gmail = google.gmail({ version: 'v1', auth });
  const pdf = await createSurveyPdf(siteName, survey);
  const boundary = `civicpulse_${randomUUID()}`;
  const subject = `Site survey: ${survey.society_name} (${survey.survey_date})`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const mailText = `Attached is the completed site survey PDF for ${survey.society_name} (${survey.survey_date}).\nSurvey ID: ${surveyId}`;
  const mime = [
    'To: info@civicpulseservices.com',
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(mailText, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: application/pdf; name="civic-pulse-site-survey.pdf"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="civic-pulse-site-survey.pdf"',
    '',
    pdf.toString('base64').match(/.{1,76}/g).join('\r\n'),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(mime).toString('base64url') },
  });
};

const saveSurvey = async (sheets, permission, identity, body) => {
  const siteId = String(body.siteId || '').trim();
  assertSurveyAdmin(permission, siteId);
  const site = permission.sites.find((entry) => String(entry.site_id) === siteId);
  const survey = body.survey;
  if (!survey || typeof survey !== 'object' || Array.isArray(survey)) {
    const error = new Error('Survey details are required.');
    error.status = 400;
    throw error;
  }
  const surveyDate = String(survey.survey_date || '').trim();
  const societyName = String(survey.society_name || '').trim();
  const surveyorName = String(survey.surveyor_name || '').trim();
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(surveyDate)
    ? new Date(`${surveyDate}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== surveyDate || !societyName || !surveyorName) {
    const error = new Error('Enter the surveyor, society name and a valid survey date.');
    error.status = 400;
    throw error;
  }
  const surveyId = String(body.surveyId || randomUUID()).trim();
  const submissionId = String(body.submissionId || randomUUID()).trim();
  if (!/^[\w-]{1,80}$/.test(surveyId) || !/^[\w-]{1,80}$/.test(submissionId)) {
    const error = new Error('Survey and submission IDs must be valid.');
    error.status = 400;
    throw error;
  }
  const surveyJson = JSON.stringify(survey);
  if (surveyJson.length > 45000) {
    const error = new Error('This survey is too large to store in one Google Sheets cell. Shorten the notes and try again.');
    error.status = 400;
    throw error;
  }

  await ensureSurveyTab(sheets);
  const { records } = await readTab(sheets, surveyTab);
  const existing = records.find((record) => String(record.survey_id) === surveyId);
  if (existing && String(existing.site_id) !== siteId) {
    const error = new Error('This survey belongs to another site and cannot be edited here.');
    error.status = 403;
    throw error;
  }
  if (existing
    && String(existing.email_submission_id) === submissionId
    && String(existing.email_status) === 'sent') {
    return { ok: true, surveyId, emailSent: true, duplicate: true };
  }

  const submittedAt = new Date().toISOString();
  const row = [
    surveyId,
    siteId,
    String(site.site_name || site.site_id),
    surveyDate,
    identity.email,
    submittedAt,
    surveyJson,
    submissionId,
    'pending',
  ];
  let rowNumber = existing?._rowNumber;
  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId.value(),
      range: `${tabRange(surveyTab)}!A${rowNumber}:I${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });
  } else {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId.value(),
      range: `${tabRange(surveyTab)}!A:I`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    rowNumber = Number(response.data.updates?.updatedRange?.match(/![A-Z]+(\d+):/)?.[1]);
  }
  if (!rowNumber) throw new Error('Survey was saved, but its sheet row could not be located for email tracking.');
  try {
    await sendSurveyPdf(String(site.site_name || site.site_id), survey, surveyId);
  } catch (error) {
    console.error('Could not email survey PDF:', error);
    const emailError = new Error('The survey was saved, but Gmail could not send the PDF. Check Gmail API and Workspace OAuth setup, then submit again to retry.');
    emailError.status = 502;
    emailError.saved = true;
    throw emailError;
  }
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId.value(),
      range: `${tabRange(surveyTab)}!I${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['sent']] },
    });
  } catch (error) {
    console.error('PDF email was sent but survey email tracking failed:', error);
    const trackingError = new Error('The survey and PDF email were sent, but email tracking did not update. Do not resubmit to avoid a duplicate email; contact the administrator.');
    trackingError.status = 502;
    trackingError.saved = true;
    trackingError.emailSent = true;
    throw trackingError;
  }
  return { ok: true, surveyId, emailSent: true };
};

const isActive = (value) => ['true', 'yes', '1', 'active'].includes(String(value).trim().toLowerCase());

const lookupAccess = async (sheets, email) => {
  const { records } = await readTab(sheets, 'Access');
  return records.filter((record) =>
    String(record.google_email || '').trim().toLowerCase() === email
    && isActive(record.active),
  ).map((record) => ({ ...record, role: String(record.role || '').trim().toLowerCase(), site_id: String(record.site_id || '').trim() }));
};

const sitesForAccess = async (sheets, accessRows) => {
  const { records } = await readTab(sheets, 'Sites');
  const activeSites = records.filter((site) => isActive(site.active));
  const isSuperAdmin = accessRows.some((row) => row.role === 'super_admin');
  if (isSuperAdmin) return activeSites;
  const allowedIds = new Set(accessRows
    .filter((row) => row.role === 'site_admin' || row.role === 'viewer')
    .map((row) => String(row.site_id).trim())
    .filter(Boolean));
  return activeSites.filter((site) => allowedIds.has(String(site.site_id).trim()));
};

const getIdentity = async (req) => {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) {
    const error = new Error('Sign in is required.');
    error.status = 401;
    throw error;
  }
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(match[1], true);
  } catch (cause) {
    console.warn('Firebase ID token verification failed:', {
      code: cause.code || 'unknown',
      message: cause.message || 'No verification error message was provided.',
    });
    const error = new Error('Your sign-in session is invalid or expired. Sign in again.');
    error.status = 401;
    throw error;
  }
  const email = String(decoded.email || '').trim().toLowerCase();
  if (!email || decoded.email_verified !== true) {
    const error = new Error('Use a verified Google account.');
    error.status = 403;
    throw error;
  }
  if (decoded.firebase?.sign_in_provider !== 'google.com') {
    const error = new Error('Sign in with an authorized Google account.');
    error.status = 403;
    throw error;
  }
  return { email, uid: decoded.uid, name: decoded.name || '' };
};

const getPermission = async (sheets, identity) => {
  const rows = await lookupAccess(sheets, identity.email);
  if (!rows.length) {
    const error = new Error('Your Google account is not listed as active in the Access sheet.');
    error.status = 403;
    throw error;
  }
  const superAdmin = rows.some((row) => row.role === 'super_admin');
  const sites = await sitesForAccess(sheets, rows);
  if (!superAdmin && sites.length === 0) {
    const error = new Error('Your account has no active site access.');
    error.status = 403;
    throw error;
  }
  const activeSiteIds = new Set(sites.map((site) => String(site.site_id).trim()));
  const siteRoles = Object.fromEntries(rows
    .filter((row) => activeSiteIds.has(row.site_id) && (row.role === 'site_admin' || row.role === 'viewer'))
    .map((row) => [row.site_id, row.role]));
  return {
    role: superAdmin ? 'super_admin' : Object.values(siteRoles).includes('site_admin') ? 'site_admin' : 'viewer',
    sites,
    superAdmin,
    siteRoles,
  };
};

const canAccessSite = (permission, siteId) =>
  permission.superAdmin || permission.sites.some((site) => String(site.site_id) === String(siteId));

const requireSite = (permission, siteId, required = true) => {
  if (!siteId && required) {
    const error = new Error('Select a site before requesting this data.');
    error.status = 400;
    throw error;
  }
  if (siteId && !canAccessSite(permission, siteId)) {
    const error = new Error('You do not have access to that site.');
    error.status = 403;
    throw error;
  }
};

const sanitizeRecord = (record, headers) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    const error = new Error('A record object is required.');
    error.status = 400;
    throw error;
  }
  const sanitized = {};
  headers.forEach((header) => {
    if (!header || header === '_rowNumber') return;
    const value = record[header];
    if (value === undefined || value === null) return;
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      const error = new Error(`Invalid value for ${header}.`);
      error.status = 400;
      throw error;
    }
    const text = String(value).trim();
    if (text.length > 2000) {
      const error = new Error(`${header} exceeds the 2000 character limit.`);
      error.status = 400;
      throw error;
    }
    sanitized[header] = text;
  });
  return sanitized;
};

const assertMayEdit = (permission, tab, siteId) => {
  if (adminTabs.has(tab) && !permission.superAdmin) {
    const error = new Error('Only a Civic Pulse super-admin can manage sites or access.');
    error.status = 403;
    throw error;
  }
  if (tab === 'Sites') {
    if (!permission.superAdmin) {
      const error = new Error('Only a Civic Pulse super-admin can manage sites.');
      error.status = 403;
      throw error;
    }
    return;
  }
  if (tab === 'Access') return;
  requireSite(permission, siteId);
  if (!permission.superAdmin && permission.siteRoles[siteId] !== 'site_admin') {
    const error = new Error('Your access to this site is read-only.');
    error.status = 403;
    throw error;
  }
};

const listRecords = async (sheets, tab, permission, siteId) => {
  if (!validTabs.has(tab)) {
    const error = new Error('Unknown data sheet.');
    error.status = 400;
    throw error;
  }
  if (tab === 'Access' && !permission.superAdmin) {
    const error = new Error('Only a Civic Pulse super-admin can view access assignments.');
    error.status = 403;
    throw error;
  }
  if (tab === 'Sites') {
    return permission.superAdmin
      ? (await readTab(sheets, tab)).records
      : permission.sites;
  }
  if (tab === 'Access') return (await readTab(sheets, tab)).records;

  if (siteId === '*') {
    if (!permission.superAdmin) {
      const error = new Error('Only a Civic Pulse super-admin can view all sites.');
      error.status = 403;
      throw error;
    }
    const { records } = await readTab(sheets, tab);
    return records;
  }
  requireSite(permission, siteId);
  const { records } = await readTab(sheets, tab);
  return records.filter((record) => String(record.site_id) === String(siteId));
};

const mutateRecord = async (sheets, permission, body) => {
  const { action, tab, siteId } = body;
  if (!validTabs.has(tab)) {
    const error = new Error('Unknown data sheet.');
    error.status = 400;
    throw error;
  }
  if (!['create', 'update', 'delete'].includes(action)) {
    const error = new Error('Unknown record action.');
    error.status = 400;
    throw error;
  }
  assertMayEdit(permission, tab, siteId);

  const { headers, records } = await readTab(sheets, tab);
  const idColumn = idColumns[tab];
  if (action === 'create') {
    const record = sanitizeRecord(body.record, headers);
    if (tab !== 'Access' && tab !== 'Sites') {
      record.site_id = siteId;
    }
    if (idColumn && !record[idColumn]) {
      const error = new Error(`A ${idColumn} is required.`);
      error.status = 400;
      throw error;
    }
    if (tab === 'Access') {
      record.google_email = String(record.google_email || '').trim().toLowerCase();
      record.role = String(record.role || '').trim().toLowerCase();
      if (!record.google_email || !['super_admin', 'site_admin', 'viewer'].includes(record.role)) {
        const error = new Error('Access entries need a Google email and a supported role.');
        error.status = 400;
        throw error;
      }
      if (record.role !== 'super_admin') {
        const { records: sites } = await readTab(sheets, 'Sites');
        if (!sites.some((site) => String(site.site_id).trim() === String(record.site_id || '').trim() && isActive(site.active))) {
          const error = new Error('Choose an active site for site-admin or viewer access.');
          error.status = 400;
          throw error;
        }
      }
    }
    const values = headers.map((header) => record[header] ?? '');
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId.value(),
      range: `${tabRange(tab)}!A:${String.fromCharCode(64 + headers.length)}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
    return { ok: true };
  }

  const rowNumber = Number(body.rowNumber);
  const existing = records.find((record) => record._rowNumber === rowNumber);
  if (!existing) {
    const error = new Error('The record no longer exists. Reload the list and try again.');
    error.status = 404;
    throw error;
  }
  if (tab === 'Access' && !permission.superAdmin) {
    const error = new Error('Only a Civic Pulse super-admin can edit access assignments.');
    error.status = 403;
    throw error;
  }
  if (tab !== 'Access' && tab !== 'Sites' && !permission.superAdmin && existing.site_id !== siteId) {
    const error = new Error('You do not have permission to change that record.');
    error.status = 403;
    throw error;
  }

  if (action === 'delete') {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId.value(),
      range: `${tabRange(tab)}!A${rowNumber}:${String.fromCharCode(64 + headers.length)}${rowNumber}`,
    });
    return { ok: true };
  }

  const updates = sanitizeRecord(body.record, headers);
  if (tab !== 'Access' && tab !== 'Sites') updates.site_id = existing.site_id;
  const merged = { ...existing, ...updates };
  if (tab === 'Access') {
    merged.google_email = String(merged.google_email || '').trim().toLowerCase();
    merged.role = String(merged.role || '').trim().toLowerCase();
    if (!merged.google_email || !['super_admin', 'site_admin', 'viewer'].includes(merged.role)) {
      const error = new Error('Access entries need a Google email and a supported role.');
      error.status = 400;
      throw error;
    }
    if (merged.role !== 'super_admin') {
      const { records: sites } = await readTab(sheets, 'Sites');
      if (!sites.some((site) => String(site.site_id).trim() === String(merged.site_id || '').trim() && isActive(site.active))) {
        const error = new Error('Choose an active site for site-admin or viewer access.');
        error.status = 400;
        throw error;
      }
    }
  }
  const values = headers.map((header) => merged[header] ?? '');
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId.value(),
    range: `${tabRange(tab)}!A${rowNumber}:${String.fromCharCode(64 + headers.length)}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
  return { ok: true };
};

exports.adminApi = onRequest({
  region: 'us-central1',
  invoker: 'public',
  maxInstances: 10,
  secrets: [gmailOAuthClientId, gmailOAuthClientSecret, gmailRefreshToken],
}, async (req, res) => {
  try {
    const origin = req.get('origin') || '';
    const allowedOrigins = new Set([
      'http://localhost:8765',
      'http://127.0.0.1:8765',
      ...allowedWebOrigins.value().split(',').map((value) => value.trim()).filter(Boolean),
    ]);
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: 'This website origin is not allowed.' });
      return;
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const identity = await getIdentity(req);
    const sheets = await getSheets();
    const permission = await getPermission(sheets, identity);

    if (req.method === 'GET' && req.path === '/bootstrap') {
      res.json({
        user: { uid: identity.uid, email: identity.email, name: identity.name },
        role: permission.role,
        siteRoles: permission.siteRoles,
        sites: permission.sites,
      });
      return;
    }

    if (req.method === 'GET' && req.path === '/data') {
      const tab = String(req.query.tab || '');
      const siteId = String(req.query.siteId || '');
      const records = await listRecords(sheets, tab, permission, siteId);
      res.json({ records });
      return;
    }

    if (req.method === 'GET' && req.path === '/surveys') {
      const siteId = String(req.query.siteId || '');
      const records = await listSurveys(sheets, permission, siteId);
      res.json({ records });
      return;
    }

    if (req.method === 'POST' && req.path === '/surveys') {
      const result = await saveSurvey(sheets, permission, identity, req.body || {});
      res.json(result);
      return;
    }

    if (req.method === 'POST' && req.path === '/records') {
      const result = await mutateRecord(sheets, permission, req.body || {});
      res.json(result);
      return;
    }

    res.status(404).json({ error: 'Endpoint not found.' });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) console.error('Admin API request failed:', error);
    res.status(status).json({
      error: error.saved ? error.message : status >= 500 ? 'The admin service could not complete the request.' : error.message,
      ...(error.saved ? { saved: true } : {}),
      ...(error.emailSent ? { emailSent: true } : {}),
    });
  }
});
