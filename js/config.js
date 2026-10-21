/* NSEYIN — public configuration. Nothing secret belongs in this file.
   The publishable (anon) key is meant to be public: every table is locked by row-level security. */
window.NSEYIN_CONFIG = {
  supabaseUrl: "https://nnwpsbtjagnmuzanpdnr.supabase.co",
  bookingEndpoint: "https://nnwpsbtjagnmuzanpdnr.supabase.co/functions/v1/submit-booking",
  contactEndpoint: "https://nnwpsbtjagnmuzanpdnr.supabase.co/functions/v1/submit-contact",
  // Optional Google Analytics ID, like "G-ABC123XYZ". Leave empty for no analytics (and no banner).
  gaMeasurementId: "",
  supabaseAnonKey: "sb_publishable_w2kgfs-8qbvaX1HKk1xC6Q_LnYrigQe"
};
