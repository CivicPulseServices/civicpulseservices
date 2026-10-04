# Civic Pulse Services Website

Website for **Civic Pulse Services**, the mother company of three service brands. Domain: `civicpulseservices.com` (bought on GoDaddy).

## Site structure

| URL | Brand | Focus |
|---|---|---|
| `/` | Civic Pulse Services | Landing page, overview of all services |
| `/security` | Security Pulse | Guards, body cams, walkie-talkies, GPS tracking |
| `/housekeeping` | Clean Pulse | Mechanized floor care, eco-friendly cleaning |
| `/facility` | Facility Pulse | MEP, STP/WTP, lift and fire-system AMC |

## Files

```
civic-pulse-site/
  index.html
  security/index.html
  housekeeping/index.html
  facility/index.html
```

Each page is the same self-contained HTML file. The page shown depends on the URL path. No build step is needed.

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

- [ ] Phone number (footer and contact section)
- [ ] Office address (footer)
- [ ] Email address, if not `info@civicpulseservices.com`
- [ ] Stats (15 min response, 100% tracking, 24/7 desk, 25% savings) match what you can deliver
- [ ] Claims such as "PSARA-licensed" and "background-verified" are true for your company
- [ ] Add real photos of guards, machines and sites
- [ ] Add a logo, if you have one

## Known limits

- The quote form opens the visitor's email app. It does not store enquiries. For a form that saves submissions, use a service such as Formspree or Netlify Forms.
- Pages are illustration-based. No external images are used.

## Possible next steps

- About, Careers and Contact pages
- Client logos and testimonials
- Google Analytics and a Google Business Profile
- Hindi or other regional language versions
