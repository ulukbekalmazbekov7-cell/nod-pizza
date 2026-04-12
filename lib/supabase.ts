import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hbgytfndindsuakidqbn.supabase.co";
const supabaseKey = "sb_publishable_V2kEeAXIc_sqSD6GFgeefQ_xQZuErKj";

export const supabase = createClient(supabaseUrl, supabaseKey);