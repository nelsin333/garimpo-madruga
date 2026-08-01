import type { Database } from '@garimpo/db';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (.env)');
  }
  client = createClient<Database>(url, anonKey);
  return client;
}

export const REFERENCE_BUCKET = 'reference-photos';
