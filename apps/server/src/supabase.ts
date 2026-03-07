// ─── Supabase Client ────────────────────────────────────────────────────────
// Used for Storage (bucket uploads). DB access stays on pg Pool.

import { createClient } from "@supabase/supabase-js";
import { ENV } from "./utils/env.ts";

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_KEY);
