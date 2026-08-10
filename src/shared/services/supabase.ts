import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLIC_KEY: string | undefined = import.meta.env.VITE_SUPABASE_PUBLIC_KEY
const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY
const ACTIVE_SUPABASE_KEY = SUPABASE_ANON_KEY || SUPABASE_PUBLIC_KEY

const HAS_ENV = !!(SUPABASE_URL && ACTIVE_SUPABASE_KEY)

const SESSION_HEADER_KEY = 'X-Suh-Token'
const APIKEY_HEADER_KEY = 'apikey'
const SESSION_STORAGE_KEY = 'suh.auth.session'

let singletonClient: SupabaseClient<Database> | null = null
let activeSessionToken: string | null = null

export type SessionTokenShape = string | null

export function createClientInstance(): SupabaseClient<Database> {
  if (singletonClient) return singletonClient

  if (!HAS_ENV) {
    console.warn(
      '⚠️ VITE_SUPABASE_URL эсвэл Supabase түлш тохируулаагүй. .env файл шалгана уу.'
    )
  }

  if (SUPABASE_ANON_KEY?.startsWith('sb_secret_')) {
    console.warn(
      '⚠️ VITE_SUPABASE_ANON_KEY-д service role key ашиглагдаж байна. Browser auth-д publishable / anon key ашиглана уу. Service role нь зөвхөн backend дээр л ашиглагдах ёстой.'
    )
  }
  if (SUPABASE_PUBLIC_KEY?.startsWith('sb_secret_')) {
    console.warn(
      '⚠️ VITE_SUPABASE_PUBLIC_KEY-д service role key ашиглагдаж байна. Browser дээр publishable key ашиглана уу.'
    )
  }

  const url = HAS_ENV ? SUPABASE_URL! : 'http://localhost'
  const key = HAS_ENV ? ACTIVE_SUPABASE_KEY! : 'dev-dummy-key'

  singletonClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Application-Name': 'suh-hoa-platform',
        [APIKEY_HEADER_KEY]: key,
      },
    },
  })

  const stored = safeReadLocalStorage(SESSION_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { token?: string }
      if (parsed && typeof parsed.token === 'string') {
        applySessionHeader(parsed.token)
        activeSessionToken = parsed.token
      }
    } catch {
      safeClearLocalStorage(SESSION_STORAGE_KEY)
    }
  }

  return singletonClient
}

export const supabase: SupabaseClient<Database> = createClientInstance()

export function getSupabaseOrThrow(): SupabaseClient<Database> {
  if (!HAS_ENV) throw new Error('Supabase client тохируулаагүй байна. .env файл шалгана уу.')
  return supabase
}

export function getSessionToken(): string | null {
  return activeSessionToken
}

export function setSessionToken(token: string | null, persist = true) {
  activeSessionToken = token
  applySessionHeader(token)

  if (persist) {
    if (token) {
      safeWriteLocalStorage(SESSION_STORAGE_KEY, JSON.stringify({ token }))
    } else {
      safeClearLocalStorage(SESSION_STORAGE_KEY)
    }
  }
}

function applySessionHeader(token: string | null) {
  const client = singletonClient
  if (!client) return

  const s = client as unknown as {
    rest?: { headers: Record<string, string> }
    storage?: { headers: Record<string, string> }
    functions?: { headers: Record<string, string> }
  }

  const targets: Array<Record<string, string>> = []
  if (s.rest && typeof s.rest.headers === 'object') targets.push(s.rest.headers)
  if (s.storage && typeof s.storage.headers === 'object') targets.push(s.storage.headers)
  if (s.functions && typeof s.functions.headers === 'object') targets.push(s.functions.headers)

  const key = ACTIVE_SUPABASE_KEY
  for (const h of targets) {
    if (key) h[APIKEY_HEADER_KEY] = key
    delete h['Authorization']
    if (token) {
      h[SESSION_HEADER_KEY] = token
    } else {
      delete h[SESSION_HEADER_KEY]
    }
  }
}

function safeReadLocalStorage(key: string): string | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWriteLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined' || !('localStorage' in window)) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function safeClearLocalStorage(key: string) {
  if (typeof window === 'undefined' || !('localStorage' in window)) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
