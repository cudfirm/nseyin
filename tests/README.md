Automated checks for the backend. Need Node 22+ and Deno (`npm i -g deno`).
`cd tests && npm i && npm test`
- db-rls.test.mjs: runs the migration in an in-process Postgres and proves who can read/write what.
- validate.test.ts: server-side input validation.
- functions.test.ts: runs both Edge Functions against an in-memory stand-in for Supabase and a fake email API.
These do not replace a live end-to-end test after deployment (see docs/SETUP.md step 5).
