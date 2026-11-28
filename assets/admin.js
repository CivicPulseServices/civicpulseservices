import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBiazLQv32gQ1YmN5EvGFA5cekNH7Om96I',
  authDomain: 'civic-pulse-services-bc10c.firebaseapp.com',
  projectId: 'civic-pulse-services-bc10c',
  storageBucket: 'civic-pulse-services-bc10c.firebasestorage.app',
  messagingSenderId: '291991563764',
  appId: '1:291991563764:web:8ed9c9d878c605f13edda1',
  measurementId: 'G-XWLCEB1PJ8',
};
const apiBase = 'https://us-central1-civic-pulse-services-bc10c.cloudfunctions.net/adminApi';
const app = initializeApp(firebaseConfig, 'civic-pulse-admin');
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const root = document.querySelector('#admin-content');
const workspace = document.querySelector('#admin-workspace');
const status = document.querySelector('#admin-auth-status');
const authButton = document.querySelector('#admin-auth-button');
const accountLabel = document.querySelector('#admin-account-label');
const sitePicker = document.querySelector('#admin-site-picker');
const dialog = document.querySelector('#record-dialog');
const surveyPageLink = document.querySelector('[data-survey-page-link]');
const pageTitle = document.querySelector('#admin-page-title');
const isSurveyPage = document.body.dataset.page === 'site-survey';
if (!root || !workspace || !status || !authButton || !sitePicker || !dialog) {
  throw new Error('Admin portal elements are missing from the page.');
}
const maxSurveyDrawingPhotos = 10;

const views = {
  overview: { title: 'Overview', description: 'A quick view of your sites and daily operations.' },
  sites: { title: 'Sites', description: 'Manage sites and their Firebase project references.', singular: 'site', tab: 'Sites' },
  access: { title: 'Access', description: 'Assign verified Google accounts to portal roles and sites.', singular: 'access assignment', tab: 'Access' },
  users: { title: 'Users', description: 'View app user profiles associated with each site.', singular: 'user', tab: 'Users' },
  properties: { title: 'Properties', description: 'Manage properties within the selected site.', singular: 'property', tab: 'Properties' },
  residents: { title: 'Residents', description: 'Manage resident profiles and property assignments.', singular: 'resident', tab: 'Residents' },
  staff: { title: 'Staff', description: 'Manage staff profiles, service roles, and RFID assignments.', singular: 'staff member', tab: 'Staff' },
  operations: { title: 'Operations', description: 'Create and track service tasks across the selected site.', singular: 'task', tab: 'Operations' },
  attendance: { title: 'Attendance', description: 'Review attendance records and approval status.', singular: 'attendance record', tab: 'Attendance' },
  survey: { title: 'Site survey', description: 'Complete the integrated site survey and scope discovery checklist.' },
};

const surveyServices = [
  ['estate_manager', 'Estate manager / admin'],
  ['housekeeping', 'Housekeeping & cleaning'],
  ['security', 'Security & traffic'],
  ['gardening', 'Gardening & OWC'],
  ['stp_wtp', 'STP & WTP'],
  ['water', 'Water supply & tankers'],
  ['garbage', 'Garbage & scrap management'],
  ['mep', 'MEP (electrical / plumbing)'],
  ['dg_lifts_fire_solar', 'DG, lifts, fire & solar'],
  ['amenities', 'Clubhouse & amenities'],
  ['pest_control', 'Pest control & tanks'],
  ['software_accounting', 'Software / accounting'],
  ['common_infrastructure', 'Common infrastructure / roads / lights'],
  ['commercial', 'Commercial & pricing inputs'],
];

const radioAnswer = (label, options, other = true) => ({
  type: 'radio',
  label,
  options: options.filter((option) => option.toLowerCase() !== 'other')
    .map((option) => [option.toLowerCase().replace(/[^a-z0-9]+/g, '_'), option]),
  ...(other ? { other: true } : {}),
});
const multiAnswer = (label, options, other = true) => ({
  type: 'multi',
  label,
  options: options.filter((option) => option.toLowerCase() !== 'other')
    .map((option) => [option.toLowerCase().replace(/[^a-z0-9]+/g, '_'), option]),
  ...(other ? { other: true } : {}),
});
const detailAnswer = (hint) => ({ type: 'detail', hint, other: true });

const surveyCheckpointAnswers = {
  '1.1': radioAnswer('Contracting structure', ['Federation master contract', 'Separate society contracts', 'Hybrid'], true),
  '1.2': radioAnswer('Is an estate / facility manager required?', ['Required', 'Not required', 'To be decided']),
  '1.3': multiAnswer('Certificates / audits available', ['MPCB CTO', 'Fire NOC', 'Lift licences', 'DG CPCB', 'Electrical audit'], true),
  '1.4': radioAnswer('Existing staff plan', ['Retain', 'Absorb', 'Replace', 'Mixed approach', 'To be decided']),
  '1.5': multiAnswer('Current pain points', ['Service quality', 'Staffing', 'Response time', 'Cost / billing', 'Supervision', 'Compliance'], true),
  '1.6': multiAnswer('Shared assets / infrastructure', ['Roads', 'Street lights', 'Water systems', 'Drainage', 'Boundary / gates', 'Utilities'], true),
  '1.7': radioAnswer('Common-cost split basis', ['Equal split', 'Per flat / unit', 'Area based', 'Usage based', 'Agreed share'], true),
  '1.8': radioAnswer('Federation / approval status', ['Registered', 'Registration in progress', 'Not registered', 'Approval process defined', 'To be decided']),
  '1.9': multiAnswer('Outgoing-vendor details to capture', ['Vendor names', 'Rates', 'Contract end dates', 'Notice periods', 'Handover', 'Disputes'], true),
  '1.10': radioAnswer('Takeover plan', ['Single-date takeover', 'Phased takeover', 'To be decided']),
  '1.11': multiAnswer('Employer / compliance responsibilities', ['PF', 'ESIC', 'Labour licence', 'Insurance', 'Employer responsibility agreed'], true),
  '1.12': multiAnswer('Known risks', ['Disputes / notices', 'Complaints', 'Vendor issues', 'Resident concerns', 'Operational risks'], true),
  '2.1': multiAnswer('Water sources', ['Municipal', 'Borewell', 'Tanker'], true),
  '2.2': radioAnswer('Tanker ordering responsibility', ['Society', 'Vendor', 'Shared', 'To be decided']),
  '2.3': multiAnswer('Water infrastructure', ['UGT', 'OHT', 'Level controllers', 'Transfer pumps', 'Booster pumps'], true),
  '2.4': radioAnswer('Pump-room equipment condition', ['Good', 'Needs repair', 'Replace', 'Not inspected']),
  '2.5': radioAnswer('Mechanized tank-cleaning frequency', ['Quarterly', 'Half-yearly', 'Annual', 'As required'], true),
  '2.6': multiAnswer('Water checks required', ['Water meter', 'Borewell yield', 'TDS', 'Monthly cost', 'Leakage / water loss'], true),
  '3.1': radioAnswer('STP technology', ['MBBR', 'SBR', 'ASP', 'MBR', 'Other']),
  '3.2': multiAnswer('WTP treatment stages', ['Pressure sand filter', 'Activated carbon', 'Softener', 'RO', 'UV / disinfection'], true),
  '3.3': multiAnswer('Equipment / automation present', ['Pumps', 'Blowers', 'PLC', 'VFD', 'Automation', 'Sensors'], true),
  '3.4': radioAnswer('Treated-water laboratory reports', ['Available and compliant', 'Available with issues', 'Not available', 'To be requested']),
  '3.5': radioAnswer('Sludge handling responsibility', ['Society', 'Vendor', 'Shared', 'To be decided']),
  '3.6': radioAnswer('MPCB consent status', ['Valid', 'Expired', 'Renewal in progress', 'Not available', 'To be verified']),
  '3.7': multiAnswer('Observed issues', ['Overload', 'Overflow / bypass', 'Odour', 'Treated-water quality', 'Complaints'], true),
  '3.8': radioAnswer('Electricity / backup setup', ['Dedicated meter with DG backup', 'Dedicated meter, no DG backup', 'Shared meter with DG backup', 'Shared meter, no DG backup', 'To be confirmed']),
  '3.9': multiAnswer('Operations / commercial coverage', ['Technical partner', 'Operator shifts', 'Payroll', 'Chemicals / spares', 'SLA', 'Response time', 'Uptime'], true),
  '3.10': multiAnswer('Safety / handover checks', ['Confined-space safety', 'PPE', 'Earthing', 'Chemical storage', 'Documents', 'Handover stock'], true),
  '3.11': multiAnswer('Outgoing-operator / equipment handover', ['Operator cooperation', 'Equipment warranty', 'AMC details', 'Supplier details', 'Equipment age'], true),
  '4.1': radioAnswer('Collection arrangement', ['Door-to-door', 'Central collection', 'Mixed'], true),
  '4.2': multiAnswer('Waste processing / collection', ['OWC', 'Vermicompost', 'Municipal pickup', 'Shredder', 'Curing space'], true),
  '4.3': radioAnswer('Dry-waste / scrap arrangement', ['Municipal pickup', 'Recycler', 'Society-managed', 'Vendor-managed'], true),
  '4.4': radioAnswer('Consumables responsibility', ['Society', 'Vendor', 'Shared', 'To be decided']),
  '5.2': radioAnswer('Gardening machinery / tools', ['Society-owned', 'Vendor-owned', 'Mixed', 'Not available']),
  '5.1': multiAnswer('Landscape checks', ['Green areas', 'Irrigation', 'Garden area', 'Treated-water pressure'], true),
  '5.3': multiAnswer('Tree / garden compliance', ['Tree permissions', 'Protected trees', 'Garden-waste disposal arranged'], true),
  '5.4': multiAnswer('Irrigation / staffing needs', ['Municipal water', 'Borewell', 'Treated water', 'Seasonal plan', 'Leakage risk', 'Dedicated gardeners'], true),
  '6.1': multiAnswer('Areas / floor types present', ['Tiles / stone', 'Epoxy / concrete', 'Basements', 'Lifts', 'Clubhouse', 'Multiple towers'], true),
  '6.2': multiAnswer('Machine facilities available', ['Power points', 'Water points', 'Storage room', 'Access constraints'], true),
  '6.3': multiAnswer('Equipment / facilities', ['Society machines available', 'Consumables provided', 'Staff facilities available', 'Civic Pulse equipment required'], true),
  '7.1': multiAnswer('Security locations / risks', ['Main gates', 'Pedestrian gates', 'Boundary', 'Blind spots', 'Open plots', 'Guard posts'], true),
  '7.2': multiAnswer('Access-control systems', ['Visitor app', 'Barriers', 'RFID', 'Intercom', 'Mobile signal available'], true),
  '7.3': radioAnswer('PSARA / guard readiness', ['Compliant', 'Action required', 'Not applicable', 'To be verified']),
  '8.1': multiAnswer('Technical roles required', ['Electrician', 'Plumber', 'Multi-skilled technician'], true),
  '8.2': multiAnswer('AMCs / equipment present', ['DG', 'Lifts', 'Fire systems', 'Solar'], true),
  '8.3': multiAnswer('Amenities present', ['Clubhouse', 'Gym', 'Swimming pool', 'Sports facilities', 'Booking system'], true),
  '8.4': multiAnswer('Pest-control coverage', ['Common areas', 'Tanks', 'Basements', 'Individual units'], true),
  '8.5': multiAnswer('Admin / software services required', ['Accounting', 'Billing', 'Statutory filings', 'Helpdesk', 'Society software'], true),
  '8.6': multiAnswer('Shared infrastructure present', ['Street lights', 'Roads', 'Drainage', 'Boundary walls'], true),
  '9.1': radioAnswer('Pricing basis', ['Fixed monthly fee', 'Per unit', 'Cost plus / management fee', 'Pass-through costs'], true),
  '9.2': multiAnswer('Exclusions to confirm', ['CapEx', 'Civil repairs', 'Legacy fines', 'Resident damage', 'Statutory fees'], true),
  '9.3': multiAnswer('Manpower planning', ['Service-wise headcount', 'Shift coverage', 'Weekly-off relief', 'Supervisor coverage'], true),
  '9.4': multiAnswer('Commercial terms to agree', ['Security deposit', 'Payment terms', 'SLA penalties', 'Review cycle', 'Termination', 'Lock-in'], true),
  '9.5': multiAnswer('Documents to collect', ['Consent', 'Drawings', 'Contracts', 'Bills', 'Reports', 'Resolutions'], true),
  '10.1': detailAnswer('Inlet flow reading / date / time / photo'),
  '10.2': detailAnswer('Outlet flow reading / date / time / photo'),
  '10.3': detailAnswer('WTP reading / date / time / photo'),
  '10.4': detailAnswer('Electricity reading / date / time / photo'),
  '10.5': detailAnswer('Meter / UGT / OHT reading / photo'),
  '10.6': detailAnswer('pH / DO / colour / odour / photo'),
  '10.7': detailAnswer('Sludge level / lifting date / photo'),
  '10.8': detailAnswer('Chemical / spares / quantity'),
  '10.9': detailAnswer('Fault / equipment / photo reference'),
};

const surveySections = [
  { id: '1', title: 'Governance, shared infrastructure & estate manager', checkpoints: [
    ['1.1', 'Contracting structure'],
    ['1.2', 'Estate / facility manager requirement, reporting line, duties and office facilities', 'estate_manager'],
    ['1.3', 'Statutory certificates: MPCB CTO, Fire NOC, lift licences, DG CPCB and electrical audit'],
    ['1.4', 'Current headcount and whether staff are retained, absorbed or replaced'],
    ['1.5', 'Top pain points with outgoing vendor(s)'],
    ['1.6', 'Shared infrastructure, ownership boundaries and assets serving neighbouring sites', 'common_infrastructure'],
    ['1.7', 'Common-cost split, invoice responsibility, default handling and payment cycle'],
    ['1.8', 'Federation registration, approval process, signatories and decision timeline'],
    ['1.9', 'Outgoing vendor names, rates, contract end dates, notice periods, handover and disputes'],
    ['1.10', 'Target takeover date, phased services, tenure, escalation and mobilisation lead time'],
    ['1.11', 'Employer responsibility, PF / ESIC, labour licence and insurance readiness'],
    ['1.12', 'Pending disputes, notices, complaints, resident sentiment and risks'],
  ] },
  { id: '2', title: 'Water supply, tanker management & pump room operations', service: 'water', checkpoints: [
    ['2.1', 'Municipal / borewell / tanker sources, daily consumption and summer tanker demand'],
    ['2.2', 'Tanker ordering responsibility, TDS checks, unloading points and flow meters'],
    ['2.3', 'UGT / OHT counts, level controllers, pump operation and shift coverage'],
    ['2.4', 'Booster / transfer pump condition, make, HP, valves and pressure issues'],
    ['2.5', 'Quarterly / half-yearly mechanized tank cleaning scope'],
    ['2.6', 'Water metering, borewell yield / TDS, monthly cost, suspected leakage or losses'],
  ] },
  { id: '3', title: 'STP & WTP technical audit', service: 'stp_wtp', checkpoints: [
    ['3.1', 'STP technology, design capacity and actual daily flow'],
    ['3.2', 'WTP filtration stages, capacity and raw / treated hardness or TDS issues'],
    ['3.3', 'Pump / blower health, PLC / VFD, automation and faulty sensors or equipment'],
    ['3.4', 'Treated-water lab results, operating scope and monthly chemical usage'],
    ['3.5', 'Sludge dewatering, disposal responsibility, lifting frequency and reuse'],
    ['3.6', 'MPCB consent holder, validity, consented KLD, conditions and filing ownership'],
    ['3.7', 'Inflow versus design load, overflow / bypass, odour, treated-water quality and complaints'],
    ['3.8', 'Dedicated electricity meter, DG backup, monthly units / bill and payer'],
    ['3.9', 'Technical partner, operator shifts, payroll, chemicals / spares, SLA, response and uptime'],
    ['3.10', 'Confined-space safety, PPE, earthing, chemical storage, documents and handover stock'],
    ['3.11', 'Outgoing operator cooperation, equipment warranty / AMC, supplier and equipment age'],
  ] },
  { id: '4', title: 'Garbage, OWC & dry-waste / scrap management', service: 'garbage', checkpoints: [
    ['4.1', 'Collection mode, segregation, timings, service lift and central garbage room'],
    ['4.2', 'OWC / vermicompost / municipal pickup, machine capacity, shredder and curing space'],
    ['4.3', 'Municipal pickup / recycler, scrap revenue share and lifting charges'],
    ['4.4', 'Garbage bags, sawdust / bio-culture and monthly consumables responsibility'],
  ] },
  { id: '5', title: 'Gardening & landscaping', service: 'gardening', checkpoints: [
    ['5.1', 'Green areas, irrigation condition, garden area and treated-water pressure'],
    ['5.2', 'Society machinery, consumables billing, CapEx tools and maintenance backlog'],
    ['5.3', 'Tree count / species, permissions, protected trees and garden-waste disposal'],
    ['5.4', 'Irrigation source, seasonal plan, leakage risk, gardeners and shift timings'],
  ] },
  { id: '6', title: 'Housekeeping & mechanized cleaning', service: 'housekeeping', checkpoints: [
    ['6.1', 'Flooring types, towers, floors, basements, lifts and clubhouse area'],
    ['6.2', 'Machine power / water points, storage room and access constraints'],
    ['6.3', 'Available machines, consumables, staff facilities and equipment Civic Pulse must supply'],
  ] },
  { id: '7', title: 'Security, access control & night patrol', service: 'security', checkpoints: [
    ['7.1', 'Gates, boundary, blind spots, open plots and guard-post counts'],
    ['7.2', 'Visitor app, barriers / RFID / intercom, peak-hour cover, guard facilities and mobile signal'],
    ['7.3', 'PSARA agency requirement, existing guard verification, training, uniform and equipment'],
  ] },
  { id: '8', title: 'Other society operations & technical AMC', checkpoints: [
    ['8.1', 'Electrician / plumber / multi-skilled technician requirement, scope and shift timings', 'mep'],
    ['8.2', 'DG, lifts, fire systems, solar, capacities and AMC coordination', 'dg_lifts_fire_solar'],
    ['8.3', 'Clubhouse, gym, pool, sports, bookings, operating hours and staffing', 'amenities'],
    ['8.4', 'Pest-control scope and covered locations', 'pest_control'],
    ['8.5', 'Accounting, billing, statutory filings, helpdesk and society software', 'software_accounting'],
    ['8.6', 'Street lights, roads, drainage, boundary walls, repair payer and defects', 'common_infrastructure'],
  ] },
  { id: '9', title: 'Commercial assumptions, exclusions & pricing inputs', checkpoints: [
    ['9.1', 'Pricing basis, pass-through costs, management fee / markup and escalation'],
    ['9.2', 'Explicit exclusions: CapEx, civil repairs, legacy fines, resident damage and statutory fees'],
    ['9.3', 'Manpower by service, shifts and weekly-off / relief coverage'],
    ['9.4', 'Security deposit, payment terms, SLA penalties, reviews, termination and lock-in'],
    ['9.5', 'Documents still to collect: consent, drawings, contracts, bills, reports and resolutions'],
  ] },
  { id: '10', title: 'Baseline readings & handover sign-off', service: 'stp_wtp', checkpoints: [
    ['10.1', 'STP inlet flow-meter reading, date / time and photo reference'],
    ['10.2', 'STP treated-outlet flow-meter reading, date / time and photo reference'],
    ['10.3', 'WTP output / treated-water meter reading, date / time and photo reference'],
    ['10.4', 'STP / WTP electricity meter reading, date / time and photo reference'],
    ['10.5', 'Borewell / tanker meter and UGT / OHT levels, date / time and photo reference'],
    ['10.6', 'STP field test (pH / DO / colour / odour), date / time and photo reference'],
    ['10.7', 'Sludge level and last lifting date, date / time and photo reference'],
    ['10.8', 'Chemical and spares stock at handover, date / time and photo reference'],
    ['10.9', 'Faulty / non-working equipment, date / time and photo reference'],
  ] },
];

const fieldDefinitions = {
  Sites: [
    ['site_id', 'Site ID', 'text'],
    ['site_name', 'Site name', 'text'],
    ['firebase_project_id', 'Firebase project ID', 'text'],
    ['timezone', 'Time zone', 'text'],
    ['active', 'Active', 'select', ['TRUE', 'FALSE']],
  ],
  Access: [
    ['google_email', 'Google account email', 'email'],
    ['role', 'Role', 'select', ['super_admin', 'site_admin', 'viewer']],
    ['site_id', 'Site', 'site-select'],
    ['active', 'Active', 'select', ['TRUE', 'FALSE']],
    ['notes', 'Notes', 'text'],
  ],
  Users: [
    ['uid', 'Firebase Auth UID', 'text'],
    ['email', 'Email', 'email'],
    ['display_name', 'Display name', 'text'],
    ['role', 'App role', 'select', ['admin', 'provider', 'supervisor', 'client', 'staff', 'resident']],
  ],
  Properties: [
    ['property_id', 'Property ID', 'text'],
    ['name', 'Property name', 'text'],
    ['type', 'Property type', 'select', ['Housing society', 'Mall or retail park', 'Commercial building', 'Other']],
    ['address', 'Address', 'text'],
    ['active', 'Active', 'select', ['TRUE', 'FALSE']],
  ],
  Staff: [
    ['staff_id', 'Staff ID', 'text'],
    ['full_name', 'Full name', 'text'],
    ['phone', 'Phone', 'tel'],
    ['email', 'Email', 'email'],
    ['service_role', 'Service role', 'select', ['Security', 'Housekeeping', 'Facility', 'Supervisor', 'Other']],
    ['rfid_card_id', 'RFID card ID', 'text'],
    ['property_id', 'Property ID', 'text'],
    ['active', 'Active', 'select', ['TRUE', 'FALSE']],
  ],
  Residents: [
    ['resident_id', 'Resident ID', 'text'],
    ['property_id', 'Property ID', 'text'],
    ['full_name', 'Full name', 'text'],
    ['unit', 'Flat or unit', 'text'],
    ['email', 'Email', 'email'],
    ['phone', 'Phone', 'tel'],
    ['active', 'Active', 'select', ['TRUE', 'FALSE']],
  ],
  Operations: [
    ['operation_id', 'Task ID', 'text'],
    ['property_id', 'Property ID', 'text'],
    ['title', 'Task', 'text'],
    ['category', 'Category', 'select', ['Security', 'Housekeeping', 'Facility', 'General']],
    ['assigned_staff_id', 'Assigned staff ID', 'text'],
    ['status', 'Status', 'select', ['open', 'in_progress', 'completed', 'cancelled']],
    ['due_at', 'Due date', 'date'],
    ['created_at', 'Created at', 'datetime-local'],
  ],
  Attendance: [
    ['attendance_id', 'Attendance ID', 'text'],
    ['staff_id', 'Staff ID', 'text'],
    ['date', 'Date', 'date'],
    ['check_in_at', 'Check-in time', 'datetime-local'],
    ['check_out_at', 'Check-out time', 'datetime-local'],
    ['status', 'Approval status', 'select', ['pending', 'approved', 'rejected']],
    ['source', 'Source', 'text'],
    ['supervisor_approver_email', 'Supervisor approver email', 'email'],
    ['supervisor_approved_at', 'Supervisor approved at', 'datetime-local'],
    ['final_approver_email', 'Final approver email', 'email'],
    ['final_approved_at', 'Final approved at', 'datetime-local'],
    ['notes', 'Notes', 'text'],
  ],
};

const columns = {
  Sites: [['site_id', 'Site ID'], ['site_name', 'Site'], ['firebase_project_id', 'Firebase project'], ['timezone', 'Time zone'], ['active', 'Active']],
  Access: [['google_email', 'Google account'], ['role', 'Role'], ['site_id', 'Site'], ['active', 'Active'], ['notes', 'Notes']],
  Users: [['uid', 'Auth UID'], ['email', 'Email'], ['display_name', 'Name'], ['role', 'App role'], ['site_id', 'Site']],
  Properties: [['property_id', 'Property ID'], ['name', 'Property'], ['type', 'Type'], ['address', 'Address'], ['active', 'Active']],
  Staff: [['staff_id', 'Staff ID'], ['full_name', 'Staff member'], ['service_role', 'Service role'], ['phone', 'Phone'], ['rfid_card_id', 'RFID card'], ['property_id', 'Property'], ['active', 'Active']],
  Residents: [['resident_id', 'Resident ID'], ['full_name', 'Resident'], ['unit', 'Unit'], ['email', 'Email'], ['phone', 'Phone'], ['property_id', 'Property'], ['active', 'Active']],
  Operations: [['operation_id', 'Task ID'], ['title', 'Task'], ['category', 'Category'], ['assigned_staff_id', 'Assigned to'], ['status', 'Status'], ['due_at', 'Due']],
  Attendance: [['attendance_id', 'Attendance ID'], ['staff_id', 'Staff ID'], ['date', 'Date'], ['check_in_at', 'Check-in'], ['check_out_at', 'Check-out'], ['status', 'Approval'], ['source', 'Source'], ['supervisor_approver_email', 'Supervisor approved by'], ['final_approver_email', 'Final approved by']],
};

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const valueOrDash = (value) => escapeHTML(value || '—');
const isGlobalAdmin = () => bootstrap?.role === 'super_admin';
const canEditSelectedSite = () => isGlobalAdmin()
  || (selectedSiteId !== '*' && bootstrap?.siteRoles?.[selectedSiteId] === 'site_admin');
let bootstrap = null;
let currentView = isSurveyPage ? 'survey' : 'overview';
let selectedSiteId = '';
let currentRecords = [];
let currentSearch = '';
let surveyRecords = [];
let surveyFormOpen = false;
let surveyChoice = 'choose';
let surveyEditId = '';
let surveyDraftId = '';
let surveyStep = 1;
let surveySubmissionId = '';
let activeSurveyId = '';
let surveyDrawingPhotos = [];
let surveyDrawingPreviewUrls = new Map();
let surveyDrawingSiteId = '';
let surveyDrawingNewPhotoIds = new Set();

const setStatus = (message, state = 'info') => {
  status.textContent = message;
  status.dataset.state = state;
};

const showSignedOut = () => {
  bootstrap = null;
  currentView = isSurveyPage ? 'survey' : 'overview';
  selectedSiteId = '';
  currentRecords = [];
  currentSearch = '';
  surveyFormOpen = false;
  surveyChoice = 'choose';
  surveyEditId = '';
  surveyDraftId = '';
  surveyStep = 1;
  surveySubmissionId = '';
  activeSurveyId = '';
  surveyDrawingPhotos = [];
  surveyDrawingSiteId = '';
  surveyDrawingNewPhotoIds = new Set();
  clearSurveyDrawingPreviewUrls();
  if (isSurveyPage) {
    pageTitle.textContent = 'Admin portal';
    document.title = 'Admin portal | Civic Pulse Services';
  }
  workspace.hidden = true;
  accountLabel.textContent = 'Sign in with an authorized Google account to continue.';
  authButton.textContent = 'Sign in with Google';
  authButton.disabled = false;
  setStatus('Your access will be checked against the restricted Access sheet.');
};

const request = async (path, options = {}) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Your session expired. Sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    credentials: 'omit',
  });
  let body;
  try {
    body = await response.json();
  } catch (error) {
    console.error('Admin API returned invalid JSON:', error);
    throw new Error('The admin service returned an invalid response.');
  }
  if (!response.ok) {
    const error = new Error(body.error || 'The admin request failed.');
    error.saved = body.saved === true;
    error.emailSent = body.emailSent === true;
    throw error;
  }
  return body;
};

const requestImage = async (path) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Your session expired. Sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!response.ok) {
    let message = 'Could not load the site drawing image.';
    try {
      const body = await response.json();
      message = body.error || message;
    } catch (error) {
      console.error('Admin API returned invalid image response:', error);
    }
    throw new Error(message);
  }
  return response.blob();
};

const clearSurveyDrawingPreviewUrls = () => {
  surveyDrawingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  surveyDrawingPreviewUrls = new Map();
};

const renderSurveyDrawingPhotos = async (form) => {
  const list = form.querySelector('#survey-drawing-photos');
  if (!list) return;
  clearSurveyDrawingPreviewUrls();
  list.innerHTML = surveyDrawingPhotos.map((photo) => `<article class="survey-drawing-photo" data-photo-card="${escapeHTML(photo.id)}"><img alt="${escapeHTML(photo.name)}" data-photo-preview="${escapeHTML(photo.id)}"><div><span>${escapeHTML(photo.name)}</span><button class="admin-cancel" type="button" data-action="remove-survey-drawing" data-file-id="${escapeHTML(photo.id)}">Remove</button></div><p class="survey-drawing-error" role="status" hidden></p></article>`).join('');
  const siteId = form.elements.namedItem('site_id').value;
  await Promise.all(surveyDrawingPhotos.map(async (photo) => {
    const image = [...list.querySelectorAll('[data-photo-preview]')]
      .find((entry) => entry.dataset.photoPreview === photo.id);
    if (!image) return;
    try {
      const query = new URLSearchParams({ siteId, fileId: photo.id });
      const url = URL.createObjectURL(await requestImage(`/survey-drawings?${query}`));
      if (!surveyDrawingPhotos.some((entry) => entry.id === photo.id)) {
        URL.revokeObjectURL(url);
        return;
      }
      surveyDrawingPreviewUrls.set(photo.id, url);
      image.src = url;
    } catch (error) {
      console.error('Could not load site drawing preview:', error);
      const message = image.closest('.survey-drawing-photo').querySelector('.survey-drawing-error');
      message.textContent = error.message;
      message.hidden = false;
    }
  }));
};

const compressSurveyDrawing = async (file) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP image.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 25 MB before compression.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    throw new Error('This image could not be opened. Choose a JPG, PNG or WebP photo.');
  }
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser cannot prepare the selected image.');
  }
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
  if (!compressed) throw new Error('This browser could not compress the selected image.');
  if (compressed.size > 8 * 1024 * 1024) {
    throw new Error('This image is still larger than 8 MB after compression. Choose a smaller image.');
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(compressed);
  });
  return {
    name: `${file.name.replace(/\.[^.]+$/, '') || 'site-drawing'}.jpg`,
    mimeType: 'image/jpeg',
    base64: String(dataUrl).split(',')[1],
  };
};

const uploadSurveyDrawingFiles = async (form, input) => {
  const files = [...input.files];
  input.value = '';
  if (!files.length) return;
  if (surveyDrawingPhotos.length + files.length > maxSurveyDrawingPhotos) {
    setStatus(`A survey can include up to ${maxSurveyDrawingPhotos} site drawing photos.`, 'error');
    return;
  }
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    for (const [index, file] of files.entries()) {
      setStatus(`Preparing site drawing ${index + 1} of ${files.length}…`);
      const prepared = await compressSurveyDrawing(file);
      setStatus(`Uploading site drawing ${index + 1} of ${files.length}…`);
      const uploaded = await request('/survey-drawings', {
        method: 'POST',
        body: JSON.stringify({
          siteId: form.elements.namedItem('site_id').value,
          surveyId: surveyDraftId,
          file: prepared,
        }),
      });
      surveyDrawingSiteId = form.elements.namedItem('site_id').value;
      surveyDrawingPhotos.push(uploaded);
      surveyDrawingNewPhotoIds.add(uploaded.id);
    }
    setStatus(`${files.length} site drawing photo${files.length === 1 ? '' : 's'} uploaded to Google Drive.`, 'success');
  } catch (error) {
    console.error('Could not upload site drawing:', error);
    setStatus(error.message, 'error');
  } finally {
    await renderSurveyDrawingPhotos(form);
    buttons.forEach((button) => { button.disabled = false; });
  }
};

const selectedSiteName = () => {
  if (selectedSiteId === '*') return 'All sites';
  return bootstrap?.sites.find((site) => site.site_id === selectedSiteId)?.site_name || 'Select a site';
};

const updateSitePicker = () => {
  const options = bootstrap.sites.map((site) => `<option value="${escapeHTML(site.site_id)}">${escapeHTML(site.site_name || site.site_id)}</option>`);
  if (isGlobalAdmin()) options.unshift('<option value="*">All sites</option>');
  sitePicker.innerHTML = options.join('');
  sitePicker.value = selectedSiteId;
  sitePicker.closest('.admin-site-picker').hidden = bootstrap.sites.length < 2 && !isGlobalAdmin();
};

const updateNavigation = () => {
  document.querySelectorAll('.admin-nav[data-view="sites"], .admin-nav[data-view="access"]').forEach((button) => {
    button.hidden = !isGlobalAdmin();
  });
  if (surveyPageLink) surveyPageLink.hidden = !canUseSurveys();
};

const canUseSurveys = () => isGlobalAdmin()
  || Object.values(bootstrap?.siteRoles || {}).includes('site_admin');

const loadData = async (tab, siteId = selectedSiteId) => {
  const params = new URLSearchParams({ tab });
  if (siteId) params.set('siteId', siteId);
  const result = await request(`/data?${params}`);
  return result.records;
};

const ensureSiteForCreate = (view) => {
  if (view === 'Sites' || view === 'Access') return true;
  if (selectedSiteId && selectedSiteId !== '*') return true;
  setStatus('Select one site before adding or editing site records.', 'error');
  return false;
};

const heading = (view, action = '') => `<div class="admin-page-heading"><div><h2>${escapeHTML(views[view].title)}</h2><p>${escapeHTML(views[view].description)}</p></div>${action}</div>`;

const renderTable = (tab, records, withActions = true) => {
  const headings = columns[tab];
  if (!headings) return '<p class="admin-storage-warning">No columns are configured for this sheet.</p>';
  const canEdit = withActions && (tab === 'Sites' || tab === 'Access'
    ? isGlobalAdmin()
    : canEditSelectedSite() && selectedSiteId !== '*');
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headings.map(([, label]) => `<th>${escapeHTML(label)}</th>`).join('')}${canEdit ? '<th>Actions</th>' : ''}</tr></thead><tbody>${records.length ? records.map((record) => `<tr>${headings.map(([key]) => `<td>${valueOrDash(key === 'site_id' ? (record.site_name || record[key]) : record[key])}</td>`).join('')}${canEdit ? `<td><div class="admin-actions"><button class="admin-action" data-action="edit" data-row="${record._rowNumber}">Edit</button><button class="admin-action" data-action="delete" data-row="${record._rowNumber}">Delete</button></div></td>` : ''}</tr>`).join('') : `<tr><td class="admin-empty" colspan="${headings.length + (canEdit ? 1 : 0)}">No ${escapeHTML(views[currentView].title.toLowerCase())} found.</td></tr>`}</tbody></table></div>`;
};

const renderOverview = async () => {
  const tabs = ['Properties', 'Residents', 'Staff', 'Operations', 'Attendance'];
  const data = await Promise.all(tabs.map((tab) => loadData(tab)));
  const counts = Object.fromEntries(tabs.map((tab, index) => [tab, data[index].length]));
  const openOperations = data[3].filter((record) => !['completed', 'cancelled'].includes(String(record.status).toLowerCase()));
  return `${heading('overview')}<div class="admin-cards"><div class="admin-stat"><span>Properties</span><b>${counts.Properties}</b></div><div class="admin-stat"><span>Residents</span><b>${counts.Residents}</b></div><div class="admin-stat"><span>Staff</span><b>${counts.Staff}</b></div><div class="admin-stat"><span>Open operations</span><b>${openOperations.length}</b></div></div><div class="admin-panel"><h3>${escapeHTML(selectedSiteName())}</h3><p>Attendance records: ${counts.Attendance}</p></div><div class="admin-panel"><h3>Open operations</h3>${renderTable('Operations', openOperations.slice(0, 5), false)}</div>`;
};

const renderList = async (view) => {
  const tab = views[view].tab;
  let records = await loadData(tab, ['Sites', 'Access'].includes(tab) ? '' : selectedSiteId);
  if (tab === 'Sites' && !isGlobalAdmin()) records = bootstrap.sites;
  if (currentSearch.trim()) {
    const query = currentSearch.toLowerCase();
    records = records.filter((record) => Object.values(record).join(' ').toLowerCase().includes(query));
  }
  currentRecords = records;
  const canEdit = tab === 'Sites' || tab === 'Access'
    ? isGlobalAdmin()
    : canEditSelectedSite() && selectedSiteId !== '*';
  const addButton = canEdit ? `<button class="btn" data-action="add">Add ${escapeHTML(views[view].singular)}</button>` : '';
  return `${heading(view, addButton)}<div class="admin-toolbar"><p>${records.length} ${records.length === 1 ? 'record' : 'records'}</p><label class="admin-search-label">Search ${escapeHTML(view)}<input id="admin-search" type="search" value="${escapeHTML(currentSearch)}" placeholder="Type to filter"></label></div>${renderTable(tab, records)}`;
};

const checkpointValueHint = (id, label) => {
  const hints = {
    '1.2': 'Duties / reporting line / facilities',
    '1.4': 'Current staff count',
    '1.9': 'Vendor / contract details',
    '1.10': 'Target date / tenure / escalation',
    '2.1': 'Daily use / summer tanker demand',
    '2.2': 'TDS / unloading / meter details',
    '2.4': 'Pump make / HP / pressure',
    '2.6': 'Yield / TDS / cost / loss',
    '3.1': 'Design capacity / actual flow (KLD)',
    '3.2': 'Capacity / hardness / TDS',
    '3.4': 'Lab result / chemical usage',
    '3.6': 'Holder / validity / consented KLD',
    '3.8': 'Monthly units / bill / payer',
    '3.9': 'Operators / shifts / SLA / response',
    '4.2': 'Machine capacity / shredder',
    '4.3': 'Revenue share / lifting charges',
    '4.4': 'Monthly quantities / responsibility',
    '5.1': 'Area (sq. ft.) / water pressure',
    '5.3': 'Tree count / species / permissions',
    '5.4': 'Water source / seasonal schedule',
    '6.1': 'Towers / floors / area',
    '6.2': 'Power / water point details',
    '6.3': 'Machines / consumables / staff needs',
    '7.1': 'Gate / post count / locations',
    '7.2': 'Peak-hour cover / system details',
    '7.3': 'Agency / training / uniform / equipment',
    '8.1': 'Headcount / shift timings',
    '8.2': 'Capacity / AMC / vendor details',
    '8.3': 'Hours / staffing / booking details',
    '8.4': 'Locations / frequency',
    '8.5': 'Software / workload details',
    '8.6': 'Ownership / repair payer / defects',
    '9.1': 'Amount / markup / escalation',
    '9.2': 'Exclusion details',
    '9.3': 'Headcount / shifts / relief',
    '9.4': 'Deposit / payment / SLA terms',
    '9.5': 'Outstanding documents',
    '10.1': 'Reading / date / time / photo',
    '10.2': 'Reading / date / time / photo',
    '10.3': 'Reading / date / time / photo',
    '10.4': 'Reading / date / time / photo',
    '10.5': 'Meter / tank levels / photo',
    '10.6': 'pH / DO / colour / odour',
    '10.7': 'Sludge level / last lifting date',
    '10.8': 'Stock / quantities',
    '10.9': 'Fault / equipment / photo',
  };
  if (hints[id]) return hints[id];
  const text = label.toLowerCase();
  if (/guard|staff|headcount|manpower|gardener|technician/.test(text)) return 'Count / shifts';
  if (/pump|motor|dg|lift|flow|meter|capacity|electrical|power|borewell/.test(text)) return 'Capacity / reading (HP, kW, LPM)';
  if (/area|floor|wing|flat|tower|count|number/.test(text)) return 'Count / area';
  if (/date|timing|hours|schedule|cycle/.test(text)) return 'Date / timing';
  if (id.startsWith('9.')) return 'Amount / term';
  return 'Short detail';
};

const renderCheckpointAnswer = (id, label) => {
  const answer = surveyCheckpointAnswers[id];
  if (!answer || answer.type === 'detail') {
    const hint = answer?.hint || checkpointValueHint(id, label);
    const otherOption = answer?.other
      ? `<label class="survey-radio-other"><input type="checkbox" name="checkpoint.${id}.choices" value="other"><span>Other</span><input type="text" name="checkpoint.${id}.other" data-other-for="${id}" maxlength="200" aria-label="Specify other ${escapeHTML(label.toLowerCase())}" placeholder="Please specify" disabled></label>`
      : '';
    return `<div class="survey-checkpoint-detail"><label class="survey-checkpoint-item"><input type="checkbox" name="checkpoint.${id}.checked"><span>${escapeHTML(id)} ${escapeHTML(label)}</span></label><input class="survey-checkpoint-value" name="checkpoint.${id}.value" maxlength="200" aria-label="${escapeHTML(id)} short detail" placeholder="${escapeHTML(hint)}">${otherOption}</div>`;
  }
  const otherName = `checkpoint.${id}.other`;
  const inputType = answer.type === 'radio' ? 'radio' : 'checkbox';
  const fieldName = answer.type === 'radio' ? `checkpoint.${id}.choice` : `checkpoint.${id}.choices`;
  const inputOptions = answer.options.map(([value, optionLabel]) => `<label><input type="${inputType}" name="${fieldName}" value="${value}"><span>${escapeHTML(optionLabel)}</span></label>`).join('');
  const otherOption = answer.other
    ? `<label class="survey-radio-other"><input type="${inputType}" name="${fieldName}" value="other"><span>Other</span><input type="text" name="${otherName}" data-other-for="${id}" maxlength="200" aria-label="Specify other ${escapeHTML(answer.label.toLowerCase())}" placeholder="Please specify" disabled></label>`
    : '';
  const prompt = answer.label === label ? '' : `<p class="survey-answer-prompt">${escapeHTML(answer.label)}</p>`;
  return `<div class="survey-checkpoint-choice" data-answer-type="${answer.type}"><h4>${escapeHTML(id)} ${escapeHTML(label)}</h4>${prompt}<div class="${inputType === 'radio' ? 'survey-radio-options' : 'survey-multi-options'}">${inputOptions}${otherOption}</div><input class="survey-checkpoint-value" name="checkpoint.${id}.value" maxlength="200" aria-label="${escapeHTML(id)} details" placeholder="${escapeHTML(checkpointValueHint(id, label))}"></div>`;
};

const updateSurveyRelevance = (form) => {
  const isServiceSelected = (service) => !service
    || form.elements.namedItem(`service_scope.${service}`)?.checked === true;
  form.querySelectorAll('.survey-checkpoint').forEach((checkpoint) => {
    checkpoint.hidden = !isServiceSelected(checkpoint.dataset.service);
  });
  form.querySelectorAll('.survey-section').forEach((section) => {
    const hasVisibleCheckpoints = [...section.querySelectorAll('.survey-checkpoint')]
      .some((checkpoint) => !checkpoint.hidden);
    section.hidden = !hasVisibleCheckpoints;
  });
  form.querySelectorAll('[data-other-for]').forEach((input) => {
    const id = input.dataset.otherFor;
    const selected = form.querySelectorAll(`input[name="checkpoint.${id}.choice"]:checked, input[name="checkpoint.${id}.choices"]:checked`);
    const isOtherSelected = !input.closest('.survey-checkpoint').hidden
      && [...selected].some((option) => option.value === 'other');
    input.disabled = !isOtherSelected;
    input.required = isOtherSelected;
    if (input.disabled) input.value = '';
  });
  form.querySelectorAll('[data-additional-scope]').forEach((scope) => {
    const name = form.elements.namedItem(`additional_scope.${scope.dataset.additionalScope}`)?.value.trim();
    scope.hidden = !name;
    const heading = scope.querySelector('[data-additional-scope-heading]');
    if (heading) heading.textContent = name || 'Additional scope';
  });
};

const renderSurveyForm = () => {
  const today = new Date().toISOString().slice(0, 10);
  const selectedSurveySite = selectedSiteId === '*' ? bootstrap.sites[0]?.site_id : selectedSiteId;
  const metadata = [
    ['surveyor_name', 'Surveyor name', 'text', true],
    ['society_name', 'Federation / society name', 'text', true],
    ['survey_date', 'Survey date', 'date', true],
    ['location_landmark', 'Location / landmark', 'text'],
    ['total_wings_flats', 'Total wings / flats', 'text'],
    ['mc_admin_contact', 'MC / admin contact', 'text'],
    ['phone_email', 'Phone / email', 'text'],
    ['civic_pulse_lead', 'Civic Pulse lead', 'text'],
    ['technical_partner_lead', 'Technical partner lead', 'text'],
  ];
  return `<form id="survey-form" class="survey-form">
    <div class="survey-form-heading"><div><h3>${surveyEditId ? 'Edit saved site survey' : 'New integrated site survey'}</h3><p>Complete each step. The final submission saves the survey and emails a PDF copy to info@civicpulseservices.com.</p></div><button class="admin-cancel" type="button" data-action="cancel-survey">Cancel</button></div>
    <section class="survey-stage" data-survey-step="1"${surveyStep === 1 ? '' : ' hidden'}><fieldset class="survey-panel"><legend>Step 1: Site and survey details</legend><div class="survey-grid"><label>Site<select name="site_id" required>${bootstrap.sites.map((site) => `<option value="${escapeHTML(site.site_id)}"${selectedSurveySite === site.site_id ? ' selected' : ''}>${escapeHTML(site.site_name || site.site_id)}</option>`).join('')}</select></label>${metadata.map(([key, label, type, required]) => `<label>${label}<input name="${key}" type="${type}"${key === 'survey_date' ? ` value="${today}"` : ''}${required ? ' required' : ''} maxlength="200"></label>`).join('')}</div></fieldset><div class="admin-form-actions"><button class="btn" type="button" data-action="survey-next">Continue to scope matrix</button></div></section>
    <section class="survey-stage" data-survey-step="2"${surveyStep === 2 ? '' : ' hidden'}><details class="survey-panel" open><summary>Step 2: Quick scope matrix</summary><p class="survey-help">Check each service required for this site. Only the matching survey questions will be shown. Leave a service unchecked if it is not required.</p><div class="survey-scope-grid">${surveyServices.map(([id, label]) => `<label class="survey-scope-option"><input type="checkbox" name="service_scope.${id}" value="true"><span>${escapeHTML(label)}</span></label>`).join('')}${['other_1', 'other_2'].map((id, index) => `<label class="survey-custom-scope">Additional scope ${index + 1}<input type="text" name="additional_scope.${id}" maxlength="100" placeholder="Describe an additional service"></label>`).join('')}</div></details><div class="admin-form-actions"><button class="admin-cancel" type="button" data-action="survey-back">Back</button><button class="btn" type="button" data-action="survey-next">Continue to survey questions</button></div></section>
    <section class="survey-stage" data-survey-step="3"${surveyStep === 3 ? '' : ' hidden'}><p class="survey-help">Step 3: Tick each item you inspected and add a short count, reading, capacity or finding. Add longer observations in the notes box at the end of each section.</p>
    ${surveySections.map((section) => `<details class="survey-panel survey-section" data-section="${section.id}"><summary>Section ${section.id}: ${escapeHTML(section.title)}</summary><div class="survey-checkpoints">${section.checkpoints.map(([id, label, service]) => `<div class="survey-checkpoint${surveyCheckpointAnswers[id] ? ' survey-checkpoint-radio' : ''}" data-checkpoint="${id}" data-service="${service || section.service || ''}">${renderCheckpointAnswer(id, label)}</div>`).join('')}</div><label class="survey-section-notes">Additional notes for Section ${section.id}<textarea name="section_notes.${section.id}" rows="3" maxlength="2000" placeholder="Record observations, issues, photo references and follow-up details for this section"></textarea></label></details>`).join('')}
    ${['other_1', 'other_2'].map((id) => `<details class="survey-panel" data-additional-scope="${id}" hidden><summary><span data-additional-scope-heading>Additional scope</span></summary><div class="survey-checkpoints"><fieldset class="survey-checkpoint"><legend>Assessment</legend><label>Status<select name="additional_scope_detail.${id}.status"><option value="not_assessed">Not assessed</option><option value="ok">No issue noted</option><option value="issue">Issue / risk noted</option><option value="follow_up">Follow-up required</option></select></label><label>Requirements, measurements and notes<textarea name="additional_scope_detail.${id}.notes" rows="2" maxlength="300"></textarea></label></fieldset></div></details>`).join('')}
    <details class="survey-panel"><summary>Pre-takeover snag list and sign-off</summary><div class="survey-grid">${[1, 2, 3].map((n) => `<label>Critical snag ${n}<textarea name="snag_${n}" rows="2" maxlength="300"></textarea></label>`).join('')}<label>Society representative<input name="society_representative" maxlength="200"></label><label>Technical partner<input name="partner_technician" maxlength="200"></label><label>Civic Pulse representative<input name="civic_pulse_representative" maxlength="200"></label><label>Sign-off date<input name="signoff_date" type="date"></label></div></details>
    <details class="survey-panel"><summary>Annex A: site sketch and shared-infrastructure map</summary><p class="survey-help">Describe boundaries, gates, STP, WTP, UGT / OHT, borewells, DG, pump rooms, garbage / OWC and garden zones. Upload up to ${maxSurveyDrawingPhotos} JPG, PNG or WebP photos; they are stored in the site’s private Google Drive folder.</p><label>Map notes, shared-asset ownership, drawn by, date and approximate scale<textarea name="annex_a_map_notes" rows="5" maxlength="2000"></textarea></label><div class="survey-drawing-upload"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple data-survey-drawing-input hidden><button class="btn" type="button" data-action="select-survey-drawings">Take or upload site drawing photos</button><span>Images are resized before upload. Maximum 8 MB each.</span></div><div id="survey-drawing-photos" class="survey-drawing-photos" aria-live="polite"></div></details>
    <details class="survey-panel"><summary>Annex B: additional notes and action items</summary><label>Follow-up actions, owner and due date<textarea name="annex_b_actions" rows="5" maxlength="2000"></textarea></label></details>
    <p class="survey-help">The final submission saves the survey in the restricted Google Sheet and emails a PDF to info@civicpulseservices.com. Avoid entering sensitive personal information that is not needed for the site assessment.</p>
    <p class="admin-status" id="survey-form-status" role="alert"></p><div class="admin-form-actions"><button class="admin-cancel" type="button" data-action="survey-back">Back to scope matrix</button><button class="btn" type="submit">Submit survey and email PDF</button></div></section>
  </form>`;
};

const surveyStatusLabel = (value) => ({
  not_assessed: 'Not assessed',
  in_scope: 'In scope',
  out_of_scope: 'Out of scope / N/A',
  ok: 'No issue noted',
  issue: 'Issue / risk noted',
  follow_up: 'Follow-up required',
  not_applicable: 'Not applicable',
}[value] || value);

const populateSurveyForm = async (form, record) => {
  const survey = JSON.parse(record.survey_json);
  const setValue = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field && value !== undefined && value !== null) field.value = value;
  };
  setValue('site_id', record.site_id);
  [
    'surveyor_name', 'society_name', 'survey_date', 'location_landmark', 'total_wings_flats',
    'mc_admin_contact', 'phone_email', 'civic_pulse_lead', 'technical_partner_lead',
    'annex_a_map_notes', 'annex_b_actions',
  ].forEach((key) => setValue(key, survey[key]));
  surveyDrawingPhotos = Array.isArray(survey.annex_a_drawing_photos)
    ? survey.annex_a_drawing_photos.filter((photo) => photo && typeof photo.id === 'string' && typeof photo.name === 'string')
    : [];
  surveyDrawingSiteId = surveyDrawingPhotos.length ? record.site_id : '';
  await renderSurveyDrawingPhotos(form);
  surveyServices.forEach(([id]) => {
    const checkbox = form.elements.namedItem(`service_scope.${id}`);
    if (checkbox) checkbox.checked = survey.services?.[id] === true;
  });
  ['other_1', 'other_2'].forEach((id, index) => {
    const scope = survey.additional_scopes?.[index];
    setValue(`additional_scope.${id}`, scope?.name || '');
    setValue(`additional_scope_detail.${id}.status`, scope?.status || 'not_assessed');
    setValue(`additional_scope_detail.${id}.notes`, scope?.notes || '');
  });
  Object.entries(survey.section_notes || {}).forEach(([id, value]) => setValue(`section_notes.${id}`, value));
  Object.entries(survey.checkpoints || {}).forEach(([id, checkpoint]) => {
    const checked = form.elements.namedItem(`checkpoint.${id}.checked`);
    if (checked) {
      checked.checked = checkpoint.checked ?? !['not_assessed', 'not_applicable'].includes(checkpoint.status);
    }
    const answerDefinition = surveyCheckpointAnswers[id];
    if (answerDefinition?.type === 'radio') {
      [...form.querySelectorAll(`input[name="checkpoint.${id}.choice"]`)]
        .forEach((radio) => { radio.checked = radio.value === checkpoint.choice; });
      setValue(`checkpoint.${id}.other`, checkpoint.other ?? '');
      setValue(`checkpoint.${id}.value`, checkpoint.value ?? '');
    } else if (answerDefinition?.type === 'multi') {
      const selectedChoices = new Set(checkpoint.choices || []);
      form.querySelectorAll(`input[name="checkpoint.${id}.choices"]`)
        .forEach((checkbox) => { checkbox.checked = selectedChoices.has(checkbox.value); });
      setValue(`checkpoint.${id}.other`, checkpoint.other ?? '');
      setValue(`checkpoint.${id}.value`, checkpoint.value ?? '');
    } else if (answerDefinition?.type === 'detail') {
      const otherSelected = (checkpoint.choices || []).includes('other') || checkpoint.other_selected === true;
      const otherCheckbox = form.querySelector(`input[name="checkpoint.${id}.choices"][value="other"]`);
      if (otherCheckbox) otherCheckbox.checked = otherSelected;
      setValue(`checkpoint.${id}.other`, checkpoint.other ?? '');
    }
    setValue(`checkpoint.${id}.value`, checkpoint.value ?? checkpoint.notes ?? '');
  });
  (survey.critical_snags || []).forEach((snag, index) => setValue(`snag_${index + 1}`, snag));
  setValue('society_representative', survey.sign_off?.society_representative);
  setValue('partner_technician', survey.sign_off?.technical_partner);
  setValue('civic_pulse_representative', survey.sign_off?.civic_pulse_representative);
  setValue('signoff_date', survey.sign_off?.date);
};

const renderSurvey = async () => {
  const params = new URLSearchParams({ siteId: selectedSiteId });
  const result = await request(`/surveys?${params}`);
  surveyRecords = result.records.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  const records = surveyRecords.map((record) => {
    const detail = activeSurveyId === record.survey_id
      ? `<details class="survey-record-detail" open><summary>Saved checklist answers</summary><pre>${escapeHTML(JSON.stringify(JSON.parse(record.survey_json), null, 2))}</pre></details>`
      : '';
    const editButton = surveyChoice === 'edit'
      ? `<button class="btn" type="button" data-action="edit-survey" data-survey-id="${escapeHTML(record.survey_id)}">Edit survey</button>`
      : '';
    return `<article class="survey-record"><div class="survey-record-summary"><div><h3>${escapeHTML(record.site_name || record.site_id)} — ${escapeHTML(record.survey_date)}</h3><p>Submitted by ${escapeHTML(record.surveyor_email)} on ${escapeHTML(record.submitted_at)}</p></div><div class="survey-record-actions"><button class="admin-action" type="button" data-action="view-survey" data-survey-id="${escapeHTML(record.survey_id)}">${activeSurveyId === record.survey_id ? 'Hide details' : 'View details'}</button>${editButton}</div></div>${detail}</article>`;
  }).join('');
  const choices = !surveyFormOpen ? `<section class="survey-choice"><h3>What would you like to do?</h3><div class="admin-form-actions"><button class="btn" type="button" data-action="start-survey">Conduct a new survey</button><button class="admin-cancel" type="button" data-action="choose-existing">Edit an existing survey</button></div></section>` : '';
  const editPrompt = surveyChoice === 'edit' && !surveyFormOpen
    ? `<section class="survey-history"><h3>Select a survey to edit</h3>${records || '<p class="admin-empty">No surveys are available to edit.</p>'}</section>`
    : '';
  return `${heading('survey')}${selectedSiteId === '*' ? '<p class="survey-help">You are viewing surveys from all sites. Select the site for a new survey in its first step.</p>' : ''}${choices}${editPrompt}${surveyFormOpen ? renderSurveyForm() : ''}`;
};

const render = async () => {
  if (!bootstrap) return;
  if (currentView === 'survey' && !canUseSurveys()) {
    if (isSurveyPage) {
      root.innerHTML = '';
      setStatus('Site surveys are available to site admins and Civic Pulse admins only.', 'error');
      return;
    }
    currentView = 'overview';
  }
  root.innerHTML = '<p class="admin-loading" role="status">Loading sheet data…</p>';
  try {
    const content = currentView === 'overview'
      ? await renderOverview()
      : currentView === 'survey'
        ? await renderSurvey()
        : await renderList(currentView);
    root.innerHTML = `<div class="admin-content">${content}</div>`;
    const surveyForm = root.querySelector('#survey-form');
    if (surveyForm) {
      if (surveyEditId) {
        const record = surveyRecords.find((entry) => entry.survey_id === surveyEditId);
        if (record) await populateSurveyForm(surveyForm, record);
      }
      updateSurveyRelevance(surveyForm);
    }
    document.querySelectorAll('.admin-nav').forEach((button) => {
      const active = button.dataset.view === currentView;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    setStatus(`Connected to Google Sheets as ${auth.currentUser.email}.`, 'success');
  } catch (error) {
    console.error('Could not render admin data:', error);
    root.innerHTML = `<p class="admin-storage-warning" role="alert">${escapeHTML(error.message)}</p>`;
    setStatus('Could not load the requested sheet data.', 'error');
  }
};

const renderField = (definition, record, isNew) => {
  const [key, label, type, options] = definition;
  const id = `record-${key}`;
  let value = record[key] || '';
  if (isNew && key.endsWith('_id') && key !== 'site_id' && key !== 'uid') value = crypto.randomUUID();
  if (key === 'created_at' && isNew && !value) value = new Date().toISOString().slice(0, 16);
  const required = ['notes', 'due_at', 'check_in_at', 'check_out_at', 'supervisor_approver_email', 'supervisor_approved_at', 'final_approver_email', 'final_approved_at'].includes(key) ? '' : ' required';
  if (type === 'site-select') {
    const sites = bootstrap.sites;
    const allSites = isGlobalAdmin() ? `<option value="*"${record[key] === '*' ? ' selected' : ''}>All sites</option>` : '';
    return `<label for="${id}">${escapeHTML(label)}<select id="${id}" name="${key}"${required}>${allSites}${sites.map((site) => `<option value="${escapeHTML(site.site_id)}"${record[key] === site.site_id ? ' selected' : ''}>${escapeHTML(site.site_name || site.site_id)}</option>`).join('')}</select></label>`;
  }
  if (type === 'select') {
    return `<label for="${id}">${escapeHTML(label)}<select id="${id}" name="${key}"${required}>${options.map((option) => `<option value="${escapeHTML(option)}"${String(value).toLowerCase() === option.toLowerCase() ? ' selected' : ''}>${escapeHTML(option)}</option>`).join('')}</select></label>`;
  }
  const readOnly = isNew && key.endsWith('_id') && key !== 'site_id' && key !== 'uid' ? ' readonly' : '';
  return `<label for="${id}">${escapeHTML(label)}<input id="${id}" name="${key}" type="${type}" value="${escapeHTML(value)}"${required}${readOnly}></label>`;
};

const openForm = (view, rowNumber) => {
  const tab = views[view].tab;
  const existing = rowNumber ? currentRecords.find((record) => record._rowNumber === Number(rowNumber)) : null;
  const record = existing ? { ...existing } : {};
  const definitions = fieldDefinitions[tab] || [];
  dialog.innerHTML = `<div class="admin-dialog-content"><div class="admin-dialog-heading"><h3>${existing ? 'Edit' : 'Add'} ${escapeHTML(views[view].singular)}</h3><button class="admin-dialog-close" type="button" aria-label="Close" data-action="close">&times;</button></div><form class="admin-form" id="record-form">${definitions.map((field) => renderField(field, record, !existing)).join('')}<p class="admin-status" id="form-status" role="alert"></p><div class="admin-form-actions"><button class="admin-cancel" type="button" data-action="close">Cancel</button><button class="btn" type="submit">Save to Google Sheets</button></div></form></div>`;
  dialog.showModal();
  dialog.querySelector('input,select')?.focus();
  dialog.querySelector('#record-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ensureSiteForCreate(tab)) return;
    const formData = new FormData(event.currentTarget);
    const record = Object.fromEntries(formData.entries());
    const saveButton = event.currentTarget.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    try {
      await request('/records', {
        method: 'POST',
        body: JSON.stringify({
          action: existing ? 'update' : 'create',
          tab,
          siteId: ['Sites', 'Access'].includes(tab) ? '' : selectedSiteId,
          rowNumber: existing?._rowNumber,
          record,
        }),
      });
      dialog.close();
      currentSearch = '';
      await render();
    } catch (error) {
      console.error('Could not save sheet record:', error);
      dialog.querySelector('#form-status').textContent = error.message;
      saveButton.disabled = false;
    }
  });
};

const loadWorkspace = async (user) => {
  currentView = isSurveyPage ? 'survey' : 'overview';
  currentSearch = '';
  authButton.disabled = true;
  authButton.textContent = 'Checking access…';
  setStatus('Checking your account in the Access sheet…');
  try {
    bootstrap = await request('/bootstrap');
    if (!bootstrap.sites.length && bootstrap.role !== 'super_admin') throw new Error('Your account has no active site access.');
    selectedSiteId = bootstrap.role === 'super_admin' ? '*' : bootstrap.sites[0].site_id;
    accountLabel.textContent = `${user.displayName || user.email} · ${bootstrap.role.replace('_', ' ')}`;
    authButton.textContent = 'Sign out';
    authButton.disabled = false;
    if (isSurveyPage && !canUseSurveys()) {
      workspace.hidden = true;
      pageTitle.textContent = 'Admin portal';
      setStatus('This account does not have permission to access site surveys.', 'error');
      return;
    }
    if (isSurveyPage) {
      pageTitle.textContent = 'Site survey';
      document.title = 'Site survey | Civic Pulse Services';
    }
    workspace.hidden = false;
    updateSitePicker();
    updateNavigation();
    await render();
  } catch (error) {
    console.error('Could not authorize admin user:', error);
    bootstrap = null;
    workspace.hidden = true;
    if (pageTitle) pageTitle.textContent = 'Admin portal';
    if (isSurveyPage) document.title = 'Admin portal | Civic Pulse Services';
    accountLabel.textContent = user.email;
    authButton.textContent = 'Sign out';
    authButton.disabled = false;
    setStatus(error.message, 'error');
  }
};

authButton.addEventListener('click', async () => {
  if (auth.currentUser) {
    try {
      await signOut(auth);
      showSignedOut();
    } catch (error) {
      console.error('Could not sign out:', error);
      setStatus('Sign out failed. Please try again.', 'error');
    }
    return;
  }
  authButton.disabled = true;
  setStatus('Opening Google sign-in…');
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Google sign-in failed:', error);
    const messages = {
      'auth/unauthorized-domain': `The domain ${window.location.hostname} is not authorized in Firebase Authentication. Add it under Authentication → Settings → Authorized domains.`,
      'auth/operation-not-allowed': 'Google sign-in is disabled for this Firebase project. In Firebase Console, open Authentication → Sign-in method, select Google, and enable it.',
      'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.',
      'auth/popup-closed-by-user': 'The Google sign-in window was closed before sign-in completed. Try again when ready.',
    };
    setStatus(messages[error.code] || `Google sign-in failed (${error.code || 'unknown error'}). Check Firebase Authentication settings and try again.`, 'error');
    authButton.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadWorkspace(user);
  } else {
    showSignedOut();
  }
}, (error) => {
  console.error('Firebase authentication state error:', error);
  setStatus('Could not verify the sign-in session. Reload the page and try again.', 'error');
});

sitePicker.addEventListener('change', async () => {
  selectedSiteId = sitePicker.value;
  currentSearch = '';
  surveyFormOpen = false;
  surveyChoice = 'choose';
  surveyEditId = '';
  surveyDraftId = '';
  surveyStep = 1;
  surveySubmissionId = '';
  activeSurveyId = '';
  await render();
});

document.querySelector('.admin-sidebar')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  currentView = button.dataset.view;
  currentSearch = '';
  await render();
});

root.addEventListener('input', async (event) => {
  const surveyForm = event.target.closest('#survey-form');
  if (surveyForm) {
    updateSurveyRelevance(surveyForm);
    return;
  }
  if (event.target.id !== 'admin-search') return;
  currentSearch = event.target.value;
  const cursor = event.target.selectionStart;
  await render();
  const input = document.querySelector('#admin-search');
  input?.focus();
  input?.setSelectionRange(cursor, cursor);
});

root.addEventListener('change', (event) => {
  const surveyForm = event.target.closest('#survey-form');
  if (!surveyForm) return;
  if (event.target.name === 'site_id' && surveyDrawingPhotos.length
    && event.target.value !== surveyDrawingSiteId) {
    event.target.value = surveyDrawingSiteId;
    setStatus('Remove the current site drawing photos before changing the survey site.', 'error');
    return;
  }
  updateSurveyRelevance(surveyForm);
  if (event.target.matches('[data-survey-drawing-input]')) {
    void uploadSurveyDrawingFiles(surveyForm, event.target);
  }
});

root.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  if (actionButton.dataset.action === 'select-survey-drawings') {
    root.querySelector('[data-survey-drawing-input]')?.click();
  } else if (actionButton.dataset.action === 'remove-survey-drawing') {
    const form = root.querySelector('#survey-form');
    const fileId = actionButton.dataset.fileId;
    actionButton.disabled = true;
    try {
      await request('/survey-drawings', {
        method: 'DELETE',
        body: JSON.stringify({
          siteId: form.elements.namedItem('site_id').value,
          fileId,
        }),
      });
      surveyDrawingPhotos = surveyDrawingPhotos.filter((photo) => photo.id !== fileId);
      surveyDrawingNewPhotoIds.delete(fileId);
      if (!surveyDrawingPhotos.length) surveyDrawingSiteId = '';
      await renderSurveyDrawingPhotos(form);
      setStatus('Site drawing photo removed from Google Drive.', 'success');
    } catch (error) {
      console.error('Could not remove site drawing:', error);
      setStatus(error.message, 'error');
      actionButton.disabled = false;
    }
  } else if (actionButton.dataset.action === 'start-survey') {
    surveyDrawingPhotos = [];
    surveyDrawingSiteId = '';
    surveyDrawingNewPhotoIds = new Set();
    clearSurveyDrawingPreviewUrls();
    surveyFormOpen = true;
    surveyChoice = 'choose';
    surveyEditId = '';
    surveyDraftId = crypto.randomUUID();
    surveyStep = 1;
    surveySubmissionId = '';
    await render();
  } else if (actionButton.dataset.action === 'choose-existing') {
    surveyChoice = 'edit';
    activeSurveyId = '';
    await render();
  } else if (actionButton.dataset.action === 'edit-survey') {
    surveyDrawingPhotos = [];
    surveyDrawingSiteId = '';
    surveyDrawingNewPhotoIds = new Set();
    clearSurveyDrawingPreviewUrls();
    surveyFormOpen = true;
    surveyEditId = actionButton.dataset.surveyId;
    surveyDraftId = surveyEditId;
    surveyStep = 1;
    surveySubmissionId = '';
    await render();
  } else if (actionButton.dataset.action === 'survey-next' || actionButton.dataset.action === 'survey-back') {
    const form = root.querySelector('#survey-form');
    const delta = actionButton.dataset.action === 'survey-next' ? 1 : -1;
    if (actionButton.dataset.action === 'survey-next' && surveyStep === 1 && !form.reportValidity()) return;
    surveyStep = Math.max(1, Math.min(3, surveyStep + delta));
    form.querySelectorAll('[data-survey-step]').forEach((stage) => {
      stage.hidden = Number(stage.dataset.surveyStep) !== surveyStep;
    });
    updateSurveyRelevance(form);
    root.querySelector(`[data-survey-step="${surveyStep}"] h3, [data-survey-step="${surveyStep}"] summary`)?.focus();
  } else if (actionButton.dataset.action === 'cancel-survey') {
    const siteId = surveyDrawingSiteId;
    let cleanupFailed = false;
    for (const fileId of surveyDrawingNewPhotoIds) {
      try {
        await request('/survey-drawings', {
          method: 'DELETE',
          body: JSON.stringify({ siteId, fileId }),
        });
      } catch (error) {
        console.error('Could not clean up an unsaved site drawing:', error);
        cleanupFailed = true;
      }
    }
    surveyDrawingPhotos = [];
    surveyDrawingSiteId = '';
    surveyDrawingNewPhotoIds = new Set();
    clearSurveyDrawingPreviewUrls();
    surveyFormOpen = false;
    surveyEditId = '';
    surveyDraftId = '';
    surveySubmissionId = '';
    surveyChoice = 'choose';
    await render();
    if (cleanupFailed) setStatus('Survey canceled, but one or more uploaded photos could not be removed from Google Drive.', 'error');
  } else if (actionButton.dataset.action === 'view-survey') {
    activeSurveyId = activeSurveyId === actionButton.dataset.surveyId ? '' : actionButton.dataset.surveyId;
    await render();
  } else if (actionButton.dataset.action === 'add') {
    if (!ensureSiteForCreate(views[currentView].tab)) return;
    openForm(currentView);
  } else if (actionButton.dataset.action === 'edit') {
    openForm(currentView, actionButton.dataset.row);
  } else if (actionButton.dataset.action === 'delete') {
    const rowNumber = Number(actionButton.dataset.row);
    if (!window.confirm('Delete this sheet row? This change affects the shared Google Sheet.')) return;
    actionButton.disabled = true;
    try {
      await request('/records', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          tab: views[currentView].tab,
          siteId: ['Sites', 'Access'].includes(views[currentView].tab) ? '' : selectedSiteId,
          rowNumber,
        }),
      });
      await render();
    } catch (error) {
      console.error('Could not delete sheet record:', error);
      setStatus(error.message, 'error');
      actionButton.disabled = false;
    }
  }
});

root.addEventListener('submit', async (event) => {
  if (event.target.id !== 'survey-form') return;
  event.preventDefault();
  if (!canUseSurveys()) {
    setStatus('Site surveys are available to site admins and Civic Pulse admins only.', 'error');
    return;
  }
  const form = event.target;
  const formData = new FormData(form);
  const value = (name) => String(formData.get(name) || '').trim();
  const survey = {
    surveyor_name: value('surveyor_name'),
    society_name: value('society_name'),
    survey_date: value('survey_date'),
    location_landmark: value('location_landmark'),
    total_wings_flats: value('total_wings_flats'),
    mc_admin_contact: value('mc_admin_contact'),
    phone_email: value('phone_email'),
    civic_pulse_lead: value('civic_pulse_lead'),
    technical_partner_lead: value('technical_partner_lead'),
    services: Object.fromEntries(surveyServices.map(([id]) => [id, formData.has(`service_scope.${id}`)])),
    additional_scopes: ['other_1', 'other_2'].map((id) => ({
      name: value(`additional_scope.${id}`),
      status: value(`additional_scope_detail.${id}.status`),
      notes: value(`additional_scope_detail.${id}.notes`),
    })).filter((scope) => scope.name),
    section_notes: Object.fromEntries([...form.querySelectorAll('.survey-section:not([hidden])')]
      .map((section) => [section.dataset.section, value(`section_notes.${section.dataset.section}`)])),
    checkpoints: Object.fromEntries([...form.querySelectorAll('.survey-checkpoint[data-checkpoint]:not([hidden])')]
      .map((checkpoint) => {
        const id = checkpoint.dataset.checkpoint;
        const rawLabel = checkpoint.querySelector('.survey-checkpoint-item span, .survey-checkpoint-choice h4')?.textContent.trim()
          || checkpoint.querySelector('.survey-checkpoint-choice .survey-answer-prompt')?.textContent.trim()
          || id;
        const label = rawLabel.startsWith(`${id} `) ? rawLabel.slice(id.length + 1) : rawLabel;
        return [id, {
          question: label,
          section: checkpoint.closest('.survey-section').querySelector('summary').textContent.trim(),
          ...(surveyCheckpointAnswers[id]?.type === 'radio'
            ? {
              choice: value(`checkpoint.${id}.choice`),
              choice_label: value(`checkpoint.${id}.choice`) === 'other'
                ? 'Other'
                : surveyCheckpointAnswers[id].options.find(([option]) => option === value(`checkpoint.${id}.choice`))?.[1] || '',
              other: value(`checkpoint.${id}.other`),
              value: value(`checkpoint.${id}.value`),
            }
            : surveyCheckpointAnswers[id]?.type === 'multi'
              ? {
                choices: formData.getAll(`checkpoint.${id}.choices`).map(String),
                choice_labels: formData.getAll(`checkpoint.${id}.choices`).map(String).map((selected) => selected === 'other'
                  ? `Other: ${value(`checkpoint.${id}.other`)}`
                  : surveyCheckpointAnswers[id].options.find(([option]) => option === selected)?.[1] || selected),
                other: value(`checkpoint.${id}.other`),
                value: value(`checkpoint.${id}.value`),
              }
              : {
                checked: form.elements.namedItem(`checkpoint.${id}.checked`).checked,
                ...(surveyCheckpointAnswers[id]?.type === 'detail'
                  ? {
                    other_selected: formData.getAll(`checkpoint.${id}.choices`).includes('other'),
                    other: value(`checkpoint.${id}.other`),
                  }
                  : {}),
                value: value(`checkpoint.${id}.value`),
              }),
        }];
      })),
    critical_snags: [1, 2, 3].map((n) => value(`snag_${n}`)).filter(Boolean),
    sign_off: {
      society_representative: value('society_representative'),
      technical_partner: value('partner_technician'),
      civic_pulse_representative: value('civic_pulse_representative'),
      date: value('signoff_date'),
    },
    annex_a_map_notes: value('annex_a_map_notes'),
    annex_a_drawing_photos: surveyDrawingPhotos.map(({ id, name, mimeType, createdTime }) => ({
      id, name, mimeType, createdTime,
    })),
    annex_b_actions: value('annex_b_actions'),
  };
  const saveButton = form.querySelector('button[type="submit"]');
  const formStatus = form.querySelector('#survey-form-status');
  if (!surveySubmissionId) surveySubmissionId = crypto.randomUUID();
  saveButton.disabled = true;
  try {
    await request('/surveys', {
      method: 'POST',
      body: JSON.stringify({
        siteId: value('site_id'),
        surveyId: surveyDraftId,
        submissionId: surveySubmissionId,
        survey,
      }),
    });
    surveyFormOpen = false;
    surveyDrawingPhotos = [];
    clearSurveyDrawingPreviewUrls();
    surveyDrawingNewPhotoIds = new Set();
    surveyEditId = '';
    surveyDraftId = '';
    surveySubmissionId = '';
    surveyChoice = 'choose';
    activeSurveyId = '';
    setStatus('Site survey saved and the PDF email was sent.', 'success');
    await render();
  } catch (error) {
    console.error('Could not save site survey:', error);
    formStatus.textContent = error.message;
    saveButton.disabled = error.emailSent === true;
  }
});

dialog.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="close"]') || event.target === dialog) dialog.close();
});
