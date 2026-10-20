# NSEYIN — technical setup notes (for developers)

> Looking for the simple step-by-step guide? Open `docs/SETUP.md`.

The public site is plain HTML/CSS/JS (no build step). Bookings, contact messages and the staff admin use Supabase.
Do the steps in order. Until step 3 is finished, the booking and contact forms say honestly that they are **not connected**.

## 0. Preview locally
```
cd nseyin-site
python3 -m http.server 8000      # then open http://localhost:8000
```

## 1. Create the Supabase project (free tier is enough to start)
1. Sign up at supabase.com → New project. Pick the region closest to your customers. Save the database password.
2. **SQL Editor** → paste all of `supabase/migrations/001_init.sql` → Run. (Tables, row-level security, history triggers.)
3. **Authentication → Providers → Email**: keep Email on, turn **"Allow new users to sign up" OFF** (only people you invite can ever log in).
4. **Authentication → Users → Add user** for the owner (email + strong password), and for each staff member.
5. Make them staff. In the SQL Editor (replace the email):
   ```sql
   insert into staff (user_id, role, display_name)
   select id, 'owner', 'Owner' from auth.users where email = 'owner@example.com';
   -- for others use role 'staff'
   ```
   A person who can log in but is not in `staff` sees nothing.
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
   The anon key is safe in browser code because every table denies access to it. Never put the `service_role` key in the site.

## 2. Email (Resend — free tier covers small volumes)
1. resend.com → create account (use `utibedc@gmail.com`).
2. **API Keys → Create** a key with "Sending access".
3. **Sender address: important.** `nseyin.netlify.app` is a Netlify subdomain, so you cannot add the DNS records Resend needs to verify it, and you cannot send from a Gmail address either. Two options:
   - **Quick start (owner emails only):** use `EMAIL_FROM=NSEYIN <onboarding@resend.dev>`. Resend only delivers this sender to the email you registered with, so *you* get new-booking alerts at `utibedc@gmail.com`, but customers will **not** receive confirmation emails. The booking itself is still saved and the failed customer email is logged in `notification_log`.
   - **Proper setup:** buy a domain (about $10–15/year, e.g. `nseyin.com` or `nseyin.ng`), add it in Resend → Domains, add the DNS records, and use `NSEYIN <bookings@yourdomain>`. You can then also point the website at it.

## 3. Deploy the two functions
> Run `002_session_details.sql` and `003_daily_cleanup.sql` after `001_init.sql` (003 defines `purge_old_records()`: 30 days for messages and unconfirmed requests, 12 months after the session date for confirmed/completed/cancelled/no-show bookings; it schedules itself with pg_cron if that extension is on). 002 (adds `bookings.duration` and `bookings.session_location`, and the new CSV export). After editing anything in `supabase/functions/`, run `python3 supabase/make-paste-files.py` to rebuild the one-file bundles.

> No-terminal alternative: `supabase/paste-into-dashboard/*.ts` are single-file bundles of both functions (generated from `supabase/functions/`; type-checked and run through the same 34 function tests). Paste each into Dashboard → Edge Functions → Via Editor, and turn off JWT verification. If you change anything in `supabase/functions/`, regenerate the bundles.
Install the CLI (`npm i -g supabase`), then from the `nseyin-site` folder:
```
supabase login
supabase link --project-ref YOUR_PROJECT_REF
cp supabase/functions/.env.example supabase/functions/.env     # fill in every value
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy submit-booking
supabase functions deploy submit-contact
```
Function URLs look like `https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-booking`.

Edit `js/config.js`:
```js
supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
supabaseAnonKey: "…anon public key…",
bookingEndpoint: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-booking",
contactEndpoint: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-contact",
```
`ALLOWED_ORIGINS` (in the functions' secrets) must list the exact site address(es), comma-separated, or the browser will block the form. It is pre-filled with `https://nseyin.netlify.app`. If you also serve the site from Vercel, add that exact URL (for example `https://nseyin.vercel.app`) after a comma. `NOTIFY_EMAIL_TO` is pre-filled with `utibedc@gmail.com`.

## 4. Deploy the website
The site is already set to `https://nseyin.netlify.app` (canonical URLs, Open Graph, structured data, `sitemap.xml`, `robots.txt`).
- **Netlify** reads `_headers` (security headers and caching) automatically. Publish directory: the repository root, no build command.
- **Vercel** reads `vercel.json` (the same headers). Framework preset: "Other", no build command, output directory: root.
- **Pick one as the public site.** Search engines treat two live copies as duplicate content, and canonical tags all point to the Netlify address. Either redirect the Vercel site to Netlify or switch the canonical address (see below).
- **Do not commit** `supabase/functions/.env` (only `.env.example` is meant to be in the repository; add `.env` to `.gitignore`).
- When you move to a custom domain, run: `grep -rl "nseyin.netlify.app" . | xargs sed -i 's#nseyin.netlify.app#www.yourdomain.com#g'` and update `ALLOWED_ORIGINS` and `ADMIN_URL`. If you change the page structure, regenerate nothing: the pages are plain HTML files you can edit directly.

## 5. Test it for real (do not skip)
1. Submit a booking on the live site. Check: the confirmation shows a reference; the owner email arrives; the customer email arrives.
2. Open `/admin/`, sign in, find the request, change its status, add a contact note.
3. In Supabase **Table Editor → notification_log** confirm both emails show `sent`. `failed`/`skipped` rows include the reason.
4. Try signing in with a user who is not in `staff`: they must be refused.

## Daily use (admin at `/admin/`)
- **New requests** tab lists unconfirmed requests. Contact the customer, then set status **Contacted**; when a time is agreed, set the date/time and status **Confirmed**.
- Afterwards mark **Completed**, **Cancelled**, **Declined** or **No-show**. Every status change is logged automatically with who made it.
- **Customers** shows repeat clients and their full booking history. Customers are linked by an internal ID (matched on email, or phone + name), so clients never need accounts.
- Only the **owner** can export CSV and anonymise a customer. To permanently delete a customer, anonymise first, or delete in the Supabase Table Editor (delete their bookings first).
- Staff are signed out after 30 minutes of inactivity.

## Editing content
- The site is `index.html` (one page of cards) plus `policies.html` in the root. Search for `class="todo"` to find every placeholder. When a fact is confirmed, replace the whole `<span class="todo">…</span>` with the real text.
- Colours and spacing are variables at the top of `css/app.css`.
- The four service illustrations are `img/originals/{deep-tissue,swedish-massage,sport-massage,shiatsu-massage}.jpeg` (1408×768). The site uses WebP copies at 480/800/1408 px wide in `img/`. To swap one, replace the file in `img/originals/` and re-export the three WebP widths with the same names (`deep-*.webp`, `swedish-*.webp`, `sports-*.webp`, `shiatsu-*.webp`), keeping the 1408×768 ratio.
- Contact details live in the Contact card and `policies.html`, and in the JSON-LD block of `index.html` (search for `+2349056317709` and `utibedc@gmail.com`).

## Search and analytics tools (all free; all need an account except the validators)
| Tool | What for | Notes |
|---|---|---|
| Google Search Console | Submit `sitemap.xml`, see search queries | Verify with DNS record or an HTML-tag meta added to `<head>` |
| Bing Webmaster Tools | Same for Bing | Can import from Search Console |
| Google Business Profile | Local search and Maps listing | You create and verify it; keep name/address/phone identical to the site |
| PageSpeed Insights, Lighthouse (Chrome DevTools) | Performance checks | No account |
| Rich Results Test, Schema Markup Validator | Check structured data | No account |
| Analytics | **Not installed.** Recommended: Umami Cloud's free Hobby plan (see below). |

Once the address and hours are confirmed, add a `LocalBusiness` (or `HealthAndBeautyBusiness`) JSON-LD block to `index.html` with exactly those details. It was deliberately left out because the details are unconfirmed.

## Analytics recommendation
**Umami Cloud, free Hobby plan.** At the time of writing its pricing page lists 100,000 events a month, 1 website, 6 months of data and no cookies, so no consent banner is needed. That is plenty for a local massage business, and it needs no personal data. It can also count a custom event when a booking request is sent, which tells you what actually matters (requests, not just visits). Runner-up: Cloudflare Web Analytics (free, cookieless, page views only). Avoid Google Analytics 4 for now: it needs a consent banner and is heavier than this site needs. Check current pricing before signing up.

It is **not installed** because I have no account ID and the security policy (CSP) blocks third-party scripts until you allow one. To add it later: create the site in Umami, add `<script defer src="https://cloud.umami.is/script.js" data-website-id="YOUR-ID"></script>` to the `<head>` of `index.html` and `policies.html`, add `https://cloud.umami.is` to `script-src` and `https://api-gateway.umami.dev` to `connect-src` in both `_headers` and `vercel.json`, then update the privacy notice's "Cookies and analytics" paragraph. Ask me and I will do it once you have the ID.

## Following up on WhatsApp
Customers can choose WhatsApp as their preferred contact. In the admin, each booking shows a **Message on WhatsApp** button that opens a chat with the customer's number and a short greeting that includes their reference. You press send yourself, so it is free and nothing is automated. Fully automatic WhatsApp messages would need the WhatsApp Business Platform (paid, template approval). We use WhatsApp, not SMS, as you asked.

## Paystack (online payment) — not built yet
Paystack is not connected, and the site does not claim online payment. Before it can be added you need confirmed prices and a decision on whether customers pay a deposit when they request, or pay after you confirm a time. The safest first version is a payment link you send when you confirm (Paystack Payment Pages or links, no code, no card data on this site). Online checkout inside the site would need a new Supabase function that creates a Paystack transaction and a webhook that verifies Paystack's signature before marking a booking as paid.

## Replacing the GitHub repository
From a copy of this folder, with your repository cloned elsewhere:
```
cd path/to/your-repo
git checkout -b nseyin-v2                      # work on a branch first
git rm -rq .                                   # remove the old files from the working tree
cp -R path/to/nseyin-site/. .                  # copy the new project in (includes img/originals)
printf 'supabase/functions/.env\nnode_modules/\n' >> .gitignore
git add -A && git commit -m "NSEYIN v2: card-based redesign, guest booking, secure admin"
git push -u origin nseyin-v2                   # open a pull request, check the deploy preview, then merge
```
Merging to your main branch redeploys Netlify and Vercel automatically.

## Costs to expect
Supabase free tier (pauses after a week of no use on free plans — upgrade to Pro, about $25/month, for a live business); Resend free tier (limited emails per day/month); static hosting free on Netlify/Cloudflare; domain about $10–15/year (also needed to send customer emails). Check current pricing before committing; plans change.

## Privacy and legal
`policies.html` (privacy, booking terms, cancellations, consent) is a starting draft with placeholders. Have them reviewed for Nigerian law (including the Nigeria Data Protection Act 2023) before launch. The booking form deliberately collects no health information.
