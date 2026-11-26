import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Public client credentials only. Never place a service-role or secret key here.
const SUPABASE_URL = "https://dnbkxtqnojjsntxteuqu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zWFni55o6oA710nmB3IP3g_2f_KACL4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
