import { createClient } from "@supabase/supabase-js";

const supabaseUrl = __SUPABASE_URL__.trim();
const supabasePublishableKey = __SUPABASE_PUBLISHABLE_KEY__.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
