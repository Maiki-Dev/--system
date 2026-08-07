import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLIC_KEY: string | undefined = import.meta.env.VITE_SUPABASE_PUBLIC_KEY
const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY
const ACTIVE_SUPABASE_KEY = SUPABASE_ANON_KEY || SUPABASE_PUBLIC_KEY

const HAS_ENV = !!(SUPABASE_URL && ACTIVE_SUPABASE_KEY)

let singletonClient: SupabaseClient<Database> | null = null

export function createClientInstance(): SupabaseClient<Database> {
  if (singletonClient) return singletonClient

  if (!HAS_ENV) {
    console.warn(
      '⚠️ VITE_SUPABASE_URL эсвэл Supabase түлш тохируулаагүй. .env файл шалгана уу. http://localhost fallback ашиглаж байна.'
    )
  }

  if (SUPABASE_ANON_KEY?.startsWith('sb_secret_')) {
    console.warn('⚠️ VITE_SUPABASE_ANON_KEY-д service role key ашиглагдаж байна. Browser auth-д publishable anon key ашиглана уу.')
  }

  const url = HAS_ENV ? SUPABASE_URL! : 'http://localhost'
  const key = HAS_ENV ? ACTIVE_SUPABASE_KEY! : 'dev-dummy-key'

  singletonClient = createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Application-Name': 'suh-hoa-platform',
      },
    },
  })
  return singletonClient
}

export const supabase: SupabaseClient<Database> = createClientInstance()

export function getSupabaseOrThrow(): SupabaseClient<Database> {
  if (!HAS_ENV) throw new Error('Supabase client тохируулаагүй байна. .env файл шалгана уу.')
  return supabase
}
