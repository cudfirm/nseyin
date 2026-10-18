/* NSEYIN — public configuration. Nothing secret belongs in this file.
   After deploying the Supabase Edge Function (see docs/SETUP.md), paste its URL here. */
window.NSEYIN_CONFIG = {
  // e.g. "https://abcdxyz.supabase.co" — used by the staff admin page only
  supabaseUrl: "",
  // e.g. "https://abcdxyz.supabase.co/functions/v1/submit-booking"
  bookingEndpoint: "",
  // e.g. "https://abcdxyz.supabase.co/functions/v1/submit-contact"
  contactEndpoint: "",
  // Public anon key is safe to expose ONLY with row-level security enabled (it is, see supabase/migrations).
  supabaseAnonKey: ""
};
