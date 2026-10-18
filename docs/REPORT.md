# NSEYIN — implementation report (v3)

**v3 changes (18 Oct 2026).** Applied the business details you supplied: practitioner Nseyin with your qualification summary (shown as written, with no certifying body claimed), `utibedc@gmail.com`, +234 905 631 7709 (tap-to-call and WhatsApp links), "Lagos, Nigeria", the tagline "Mindfulness & Service", and the domain `https://nseyin.netlify.app` (canonical, Open Graph, JSON-LD, sitemap, robots). Replaced the service photos with your four 1408×768 illustrations, shown in their original proportions with no cropping, and added the picture to each details sheet. Added a staff "Message on WhatsApp" button on each booking, a `vercel.json` that mirrors `_headers`, and shorter cache times for CSS/JS (they were set to cache for a year, which would have kept returning visitors on old styles). Prices and durations remain placeholders.

## v2 (app-style redesign)

**v2 note.** The first version used a conventional multi-page layout, which you found too ordinary. v2 takes the layout language of your CUDFIRM portfolio template (a dark canvas with large rounded cards, pill filter chips, tile grids, a sticky side rail and a detail sheet) and applies it to NSEYIN as **one page plus a policies page**. Only the HTML shell, CSS and UI script changed; booking, admin, database, functions and tests are as before. Only the portfolio's HTML was uploaded, not its CSS or JS, so the look is a faithful adaptation of its structure, not a pixel copy. Upload `portfolio.css`/`.js` if you want it closer.


## What changed from the template
The template was one static page with a Tailwind-CDN build, five third-party scripts, fake testimonials/statistics/therapists, a fake chatbot, and booking buttons pointing at a section that did not exist. I kept the stack (static HTML/CSS/JS, no framework), the page-section order and the mobile-menu / back-to-top ideas, and rebuilt the rest.

| Area | Result |
|---|---|
| Pages | One page of cards: Our massage (filter chips, 4 service tiles, detail sheet), How we work (consent), Book (3-step guest form), Questions (filtered FAQ), Get in touch. Plus Policies and 404 |
| Styling | One hand-written stylesheet: deep forest canvas, ivory cards, gold accent, arch-shaped photo frames; Syne + DM Sans self-hosted. Sticky chip nav (scroll-spy), desktop side rail, floating Book button on mobile. No Tailwind or CDN |
| Removed (invented content) | testimonials, "98% satisfaction", session counts, named therapists and their emails, "certified / 8+ years", durations, "basalt stones", "Thai", chatbot |
| Booking | 3-step guest request form → server function → database → emails. Honest states: not-connected, loading, field errors, server errors, success with reference |
| Admin | `/admin/`: staff login, new requests, all bookings, customers (repeat clients, history), contact messages, status + agreed time, contact-attempt notes, email-delivery log, owner-only CSV export and anonymise |
| Security | Row-level security on every table; anonymous visitors can read nothing; server-side validation; rate limits (salted hash, no raw IPs); honeypot + timing trap; idempotency keys; strict CORS; CSP and security headers (`_headers`); HTML-escaped emails; admin text rendered via `textContent`; CSV formula-injection guard |
| SEO | Unique titles/descriptions, canonical, Open Graph, `sitemap.xml`, `robots.txt` (admin disallowed + `noindex`), JSON-LD: WebSite, Organization, Service ×4, BreadcrumbList |
| Accessibility | Skip link, keyboard-operable menu with `aria-expanded` and Esc, visible focus, labelled fields, errors tied to inputs, `<details>` FAQ, ≥44px targets, reduced-motion support |

## Images and asset inventory
Your originals are untouched in `img/originals/`. Optimised copies (WebP, 400/640/1024 wide, explicit width/height, fixed-ratio frames so nothing shifts) are used on the site. Total shipped images ≈ 400 KB (was 6.2 MB).

| Original (`img/originals/`) | Used for | Treatment |
|---|---|---|
| `deep-tissue.jpeg`, `swedish-massage.jpeg`, `sport-massage.jpeg`, `shiatsu-massage.jpeg` (1408×768) | Service tiles and details sheets | WebP at 480/800/1408 px wide, same 1408×768 ratio, explicit width/height |
| `header.jpeg` (1024×1024) | Intro card (arch) | WebP at 400/640/1024 |
| (logo) | Logo, favicon, social card | Unchanged from v1 |
Layout frames now match the images' ratio, so nothing is cropped; each new frame has a fixed aspect ratio and `object-position` focal points.

## Testing performed (and results)
| Check | How | Result |
|---|---|---|
| Database + access rules | 41 tests on a real Postgres engine (in-process), simulating anonymous, signed-in non-staff, staff, owner, deactivated staff | 41/41 pass |
| Input validation | 27 unit tests | 27/27 |
| Booking & contact functions | 34 tests: valid booking, stored data, both emails, idempotent retries, duplicate guard, repeat-customer linking, bots, rate limits, CORS, oversized/invalid input, email provider failure, HTML injection, missing email config | 34/34. Type-checked with Deno |
| Admin page | Real browser against a stand-in Supabase API: login/refusal, roles, search/filter, status + schedule rules, notes, hostile-text rendering, export, sign-out | All pass (found and fixed 3 bugs) |
| Public site | Chromium at 360/768/1440 px, index, policies, 404 and admin, under the real CSP: no horizontal overflow, no console errors/warnings, no failed requests | Clean |
| Booking form | Validation, steps, service sheet → preselect and jump to details, filters, past date, double-submit guard, success, not-connected state, no scroll on load, Esc and focus return | Pass |
| Links/SEO | Every internal link and anchor, image files, JSON-LD parses, one `<h1>`, unique titles/descriptions, canonicals | All OK |
| Lighthouse (local server, mobile & desktop) | Home (mobile and desktop) after v3 | Performance 98–100, Accessibility 100, Best practices 100, SEO 100 (CLS 0, LCP 0.5–2.1 s). Local numbers are indicative; re-run on the live site |

## NOT verified (needs you, after deployment)
- Nothing has run against a **live Supabase project** or **real Resend account**: I have no credentials. Access rules were proven on real Postgres with simulated sign-in; the functions on stand-ins. Follow `docs/SETUP.md` Part 5 ("Try it out") before announcing the site.
- Real email delivery and spam-folder placement (depends on your domain's DNS records).
- Browsers other than Chromium; real phones; a screen reader (VoiceOver/NVDA). Automated accessibility checks pass, but they cover only part of WCAG 2.2 AA.
- Structured data in Google's Rich Results Test and Schema Markup Validator (blocked from this sandbox).
- Legal text: privacy, terms and consent wording are drafts for lawyer review.
- No availability calendar exists, by design: the site never claims a time is free.

## Image issues to fix (your call)
The illustrations contain text I cannot edit: the Deep Tissue therapist's shirt reads "WELLNESS SPA" (not NSEYIN), the Swedish poster text is garbled ("Idleze are wellness…"), and the Sports shirt reads "Nseyin Sports Massage". Regenerating those three with clean text would look more professional. The Shiatsu image shows a clothed client on a floor mat; confirm that is how you work before I write it into the Shiatsu details.

## Business details still needed (yellow `[… — to be confirmed]` markers on the site)
Opening hours · full studio address or home-visit area · session durations · prices · Shiatsu techniques, pressure style, mat/table and clothing · preparation guidance · typical reply time · cancellation/no-show/reschedule policy · payment methods and deposits (Paystack planned) · complaints process · data-retention period · providers list · legal business name · social links (none shown yet).

## Decisions for you
1. Decided: palette follows the brief (forest green), with your gold owl as the accent. Say if you prefer the brown/gold brand sheet.
2. Decided: tagline "Mindfulness & Service" is in the brand card.
3. WhatsApp follow-up: done as a click-to-chat button for staff (free, manual). Fully automatic messages would need the paid WhatsApp Business Platform.
4. Analytics: recommended Umami Cloud free plan, not installed (see docs/TECHNICAL.md).
5. **Sending customer emails needs a domain you own.** `nseyin.netlify.app` cannot be verified with Resend. Until you have one, only your own alerts at utibedc@gmail.com can be delivered (via Resend's test sender).
6. Decided: Netlify is the public site (Vercel copy should be ignored or deleted).
7. Paystack: not built; needs prices and a deposit decision first.