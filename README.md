# NSEYIN website

Static site + Supabase backend. See **docs/SETUP.md** for the simple step-by-step setup (and docs/TECHNICAL.md for developer notes), and **docs/REPORT.md** for what was built, what was tested and what is still open.

```
index.html            the whole site as one app-style page (services, how we work, booking, FAQ, contact)
policies.html         privacy notice, booking terms, cancellations, consent (drafts for legal review)
404.html
_headers / vercel.json   security headers + caching (Netlify / Vercel)
css/app.css           design system (one stylesheet, also used by /admin/)
js/app.js             chip filters, service sheet, scroll-spy, floating Book button
js/booking.js         3-step guest booking form
js/contact.js         contact form
js/config.js          public settings (endpoints, anon key) — no secrets
admin/                staff admin (login required)
supabase/migrations/  database schema + row-level security
supabase/functions/   submit-booking, submit-contact (server-side validation, spam protection, email)
img/                  optimised images (img/originals = your untouched files)
fonts/                self-hosted Syne + DM Sans
```
