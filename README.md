# Civic Pulse Services Website

Website for **Civic Pulse Services**, the mother company of three service brands. Domain: `civicpulseservices.com` (bought on GoDaddy).

## Site structure

| URL | Brand | Focus |
|---|---|---|
| `/` | Civic Pulse Services | Landing page, overview of all services |
| `/security` | Security Pulse | Guards, body cams, walkie-talkies, GPS tracking |
| `/housekeeping` | Clean Pulse | Mechanized floor care, eco-friendly cleaning |
| `/facility` | Facility Pulse | MEP, STP/WTP, lift and fire-system AMC |
| `/admin` | Civic Pulse Services | Google-authenticated admin portal for site management, operations, attendance, and restricted site surveys |

## Files

```
civic-pulse-site/
  index.html
  admin/
    index.html
    survey.html
  security/index.html
  housekeeping/index.html
  facility/index.html
  assets/
  functions/
```

Marketing pages share styles and rendering in `assets/`. The admin portal uses Firebase Authentication in the browser and a Firebase Cloud Function backend to read and write the configured Google Sheet.

## Technology promise (key messages)

- **Body-worn cameras:** every guard records the shift.
- **Walkie-talkie network:** posts, supervisors and the control desk on one channel.
- **GPS and QR patrol tracking:** every round is logged and verified.
- **Mechanized cleaning:** ride-on auto-scrubbers and advanced equipment.
- **Resident app and IoT alerts:** bills, bookings, complaints, and sensor alerts for tanks, pumps and lifts.

## Go live

1. Upload the `civic-pulse-site` folder to Netlify, Cloudflare Pages or Vercel.
2. In the host, add the custom domain `civicpulseservices.com`.
3. In GoDaddy, open the domain's DNS settings and add the records the host shows (usually an A record for the root and a CNAME for `www`).
4. Wait for DNS to update, then confirm HTTPS works on the root domain, `www`, and each service path.
5. Set up email (`info@civicpulseservices.com`) separately with Google Workspace, Microsoft 365 or GoDaddy email.

## Replace before launch

- [x] Phone number: +91 9595132150
- [x] Office address: B2 901, Nyati Elan, Wagholi, Pune - 412207
- [ ] Email address, if not `info@civicpulseservices.com`
- [ ] Stats (15 min response, 100% tracking, 24/7 desk, 25% savings) match what you can deliver
- [ ] Claims such as "PSARA-licensed" and "background-verified" are true for your company
- [ ] Add real photos of guards, machines and sites
- [ ] Add a logo, if you have one

## Known limits

- The quote form opens the visitor's email app. It does not store enquiries. For a form that saves submissions, use a service such as Formspree or Netlify Forms.
- The admin portal is not usable until the setup steps below are completed and the Cloud Function is deployed.
- The dedicated Site survey page at `/admin/survey.html` is linked from the admin portal only after an authorized `site_admin` or `super_admin` signs in. Direct visits require the same Firebase sign-in, and the backend enforces the role and site restrictions.
- The Site survey workflow lets authorized admins start a new survey or select an existing one to edit. It collects site and surveyor details first, then scope selections, then relevant checklist questions. Each question uses a fitting response control (single-choice radio buttons, multi-select checkboxes, or an inspection checkbox with a compact reading/detail field), and every question includes an Other option with a text box enabled when selected. A larger notes field appears at the end of each section. Final submissions update the same survey row when editing, generate a PDF on the backend, and email it to `info@civicpulseservices.com`. Surveys are stored in the restricted Google Sheet's `Site Surveys` tab; the backend creates this tab and its header row on first use. The form follows the supplied Integrated Site Survey checklist, filters relevant checkpoints from the quick scope selections, and supports two named additional scopes. Authorized survey admins can take or select up to ten site drawing photos; the backend stores them in a private, per-site Google Drive folder and proxies previews through the authenticated API.
- The admin quotation workflow is restricted to `super_admin` accounts. It uses a saved survey with security and/or housekeeping selected, but staffing and costs must be entered and verified manually. Saved quotations and a copy of the source survey are stored in Firestore, not the Google Sheet.
- All site records in the current design are stored in the Civic Pulse Google Sheet. A `firebase_project_id` in the Sites tab is metadata only; this implementation does not synchronize records to separate site Firebase projects.
- The sheet's `Access` tab grants portal roles; it does not create Google or Firebase Authentication accounts. Users must sign in with a verified Google account, and a backend checks their email, role, active state, and site on each request.
- Never share the spreadsheet with site admins or public link users. They should use the portal; only trusted spreadsheet owners and the backend service account should have direct sheet access.
- Do not store passwords, service-account keys, or OAuth client secrets in the sheet or browser code.
- Pages are illustration-based. No external images are used.

## Admin portal setup

The portal is configured to use spreadsheet `1cIEb465oatAm05eEOLMVO1aRfRMaVI8qQ2WjU_QZZ_c` and Firebase project `civic-pulse-services-bc10c`.

1. In Firebase Console for `civic-pulse-services-bc10c`, enable **Google** as a sign-in provider under **Authentication → Sign-in method**. Add `localhost`, `127.0.0.1`, and the deployed website hostname under **Authentication → Settings → Authorized domains**. For local testing, open `http://localhost:8765/admin/`; if using `http://127.0.0.1:8765/admin/`, `127.0.0.1` must also be authorized.
2. The `adminApi` Cloud Function is deployed in `us-central1` at `https://us-central1-civic-pulse-services-bc10c.cloudfunctions.net/adminApi`. Its HTTP endpoint allows public invocation so browsers can reach it; every application request still requires a valid Firebase ID token and a role in the `Access` sheet.
3. Keep the spreadsheet restricted. Share it as **Editor** with the Function runtime service account `291991563764-compute@developer.gserviceaccount.com`. Do not grant direct sheet access to site admins; the backend must be their only sheet access path.
4. The Google Sheets API, Google Drive API, Cloud Functions APIs, and Artifact Registry are enabled for the project. The project must remain on the **Blaze** (pay-as-you-go) plan with billing enabled for Cloud Functions operation.

   ```powershell
   firebase deploy --only functions:admin-api:adminApi --project civic-pulse-services-bc10c
   ```

   Redeploy after backend code changes. The project-specific parameters are stored in the ignored local file `functions/.env.civic-pulse-services-bc10c`; it sets `SPREADSHEET_ID` to `1cIEb465oatAm05eEOLMVO1aRfRMaVI8qQ2WjU_QZZ_c` and lists the permitted development and production origins.
   For site drawing uploads, create a folder in a Google Shared Drive, grant **Content manager** access to `291991563764-compute@developer.gserviceaccount.com`, and set `SURVEY_DRAWINGS_DRIVE_FOLDER_ID` in that same ignored environment file to the folder ID. The API automatically creates a private subfolder for each site. Do not make the folder or photos public.
5. To confirm the service account, view the `adminApi` function's runtime identity in Google Cloud Console or with:

   ```powershell
   gcloud functions describe adminApi --gen2 --region us-central1 --project civic-pulse-services-bc10c --format="value(serviceConfig.serviceAccountEmail)"
   ```

   The spreadsheet must remain restricted; do not make it link-accessible. Cloud Functions deployment and operation may incur charges under the Blaze plan.
6. Add the first `Access` row for the trusted Civic Pulse administrator: `google_email` = verified Google email, `role` = `super_admin`, `site_id` = `*`, `active` = `TRUE`. Add active site rows in `Sites`; give site admins and viewers one `Access` row per site with role `site_admin` or `viewer`.
7. Deploy the static website to its hosting provider and test sign-in plus a read/write using demo records. An authorized site admin or Civic Pulse super-admin can open **Site survey** from the admin portal or visit `/admin/survey.html`, start or edit a survey, complete the checklist, and submit it to `Site Surveys`; successful submissions also email the generated PDF to the configured mailbox. The standalone survey page remains hidden until the account passes sign-in and survey-role checks. Do not enter real resident data until access scoping and sheet permissions have been verified.

### Survey PDF email setup

The `adminApi` function uses the Gmail API authenticated as the primary Workspace mailbox `tech@civicpulseservices.com` to send completed survey PDFs to `info@civicpulseservices.com` (an alias). Gmail API OAuth must be authorized as the primary mailbox, not the alias. No OAuth tokens or mailbox passwords belong in source code.

1. Enable the **Gmail API** in the Google Cloud project (alongside the Sheets, Functions and Artifact Registry APIs listed above).
2. Create an OAuth client in Google Cloud, configure its consent screen for your Workspace, and authorize the primary mailbox `tech@civicpulseservices.com` with the `https://www.googleapis.com/auth/gmail.send` scope. The Gmail API sends to the `info@civicpulseservices.com` alias. The OAuth app must be trusted/allowed by your Workspace administrator. Use OAuth Playground with your own OAuth client credentials if you need to obtain an offline refresh token.
3. Store the OAuth client ID, OAuth client secret and mailbox refresh token as Firebase Function secrets (never paste them into the repository or chat):

   ```powershell
   firebase functions:secrets:set GMAIL_OAUTH_CLIENT_ID --project civic-pulse-services-bc10c
   firebase functions:secrets:set GMAIL_OAUTH_CLIENT_SECRET --project civic-pulse-services-bc10c
   firebase functions:secrets:set GMAIL_REFRESH_TOKEN --project civic-pulse-services-bc10c
   ```

4. Deploy the function again so it receives the secrets. The survey is saved before email delivery; if Gmail delivery fails, the page reports that it was saved and allows submission again to retry the PDF email. Email status and submission identifiers are tracked in the `Site Surveys` tab to avoid duplicate sends when the same submission is retried.

The Cloud Function verifies Firebase ID tokens, checks the `Access` tab for every request, restricts site admins to the assigned site, and grants cross-site access only to active `super_admin` rows. The sheet itself is not a security boundary: anyone with direct editor access can see all tabs.

### Security and housekeeping quotations

1. Create a Firestore **Standard** `(default)` database in the Firebase project. Keep its security rules in production mode so browsers and mobile clients cannot directly read or write quotation data. Check that no existing permissive rule also grants access to the `quotations` collection; Firestore rules are additive. The Cloud Function uses its runtime identity and must have permission to read and write Firestore (for example, the **Cloud Datastore User** IAM role). Firestore usage may incur charges.
2. Deploy the updated Cloud Function and static website. The existing Gmail OAuth secrets and Gmail API setup above are also used to email customers; the sender is the authorized Workspace mailbox. A saved site survey must select security or housekeeping.
3. Sign in as a Civic Pulse super-admin and select **Quotations** in the admin portal. Choose a survey, review its requirements, enter the customer and their verified email address, and add cost items. Use separate monthly and one-time items for labour, relief coverage, statutory costs, consumables, equipment and other costs as applicable. No rates, tax or staffing are automatically inferred from the survey.
4. Enter overhead, profit **markup**, and tax percentages. For each item, the backend calculates direct cost as quantity multiplied by unit cost; overhead as a percentage of direct cost; markup as a percentage of direct cost plus overhead; and tax as a percentage of the selling price. Each calculation is rounded to the nearest paise per item before period totals are summed. The same rates apply to all items. Review the internal breakdown, terms, recipient and totals, then confirm **Save and email quotation**. The customer PDF includes item selling prices and tax but not the internal cost, overhead or profit. Quotations are immutable; create a new quotation to change details.
5. Firestore records track `draft`, `sending`, `sent` or `delivery_unknown`. A draft can be sent from the quotation list. If the status remains `sending`, becomes `delivery_unknown`, or the page reports an uncertain delivery, **check the sender's mailbox before sending a new quotation**. Automatic retries are intentionally blocked because Gmail might have accepted the original email. A `sent` status means Gmail accepted the message, not that it reached the customer. PDFs can be downloaded from the quotation list.

Run the focused checks from the repository root with `node --test functions/quotation.test.js functions/quotation-api.test.js`. The tests use simulated Firestore and Gmail; they do not verify deployed services, permissions or actual delivery.

## Possible next steps

- About, Careers and Contact pages
- Client logos and testimonials
- Google Analytics and a Google Business Profile
- Hindi or other regional language versions
