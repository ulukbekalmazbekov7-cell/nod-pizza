import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured && process.env.NODE_ENV === "development") {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY не заданы — запросы к API не сработают."
  );
}

/**
 * Браузерный клиент с cookie-сессией (совместим с middleware и RLS для authenticated).
 * Импортировать только из клиентских компонентов («use client»).
 * Секретный service_role ключ сюда никогда не подставлять — только anon / publishable.
 */
const url = supabaseUrl ?? "https://placeholder.local";
const key = supabaseKey ?? "placeholder-anon-key";

export const supabase = createBrowserClient(url, key);
