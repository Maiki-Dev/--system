import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, setSessionToken as applySessionToken } from '@/shared/services/supabase'
import type { UserRole } from '@/shared/types'
import { USER_ROLES } from '@/shared/types'

export interface AuthUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: UserRole | null
  role_rank: number
  organization_id: string | null
  phone: string | null
  created_at: string | null
}

export interface AuthSession {
  token: string
  expires_at: string
}

interface Profile {
  id: string
  organization_id: string | null
  role_name: UserRole | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface RpcLoginResult {
  token: string
  profile_id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role_name: string | null
  role_rank: number
  organization_id: string | null
  expires_at: string
}

interface RpcSessionResult {
  profile_id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role_name: string | null
  role_rank: number
  organization_id: string | null
  expires_at: string
}

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSession | null
  profile: Profile | null
  role: UserRole | null
  roleRank: number
  organizationId: string | null
  isLoading: boolean
  error: Error | null
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ user: AuthUser | null; session: AuthSession | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasMinRank: (rank: number) => boolean
  isAuthenticated: boolean
}

function normalizeRoleName(name: string | null | undefined): UserRole | null {
  if (!name) return null
  const n = name.trim()
  const keys = Object.keys(USER_ROLES) as UserRole[]
  const match = keys.find((k) => k.toLowerCase() === n.toLowerCase())
  return match ?? null
}

function mapRpcToUser(
  rpc: Pick<RpcLoginResult, 'profile_id' | 'email' | 'first_name' | 'last_name' | 'avatar_url' | 'role_name' | 'role_rank' | 'organization_id'>,
): AuthUser {
  const role = normalizeRoleName(rpc.role_name)
  return {
    id: rpc.profile_id,
    email: rpc.email,
    first_name: rpc.first_name ?? null,
    last_name: rpc.last_name ?? null,
    avatar_url: rpc.avatar_url ?? null,
    role,
    role_rank: Number.isFinite(rpc.role_rank) ? rpc.role_rank : (role ? USER_ROLES[role].rank : 0),
    organization_id: rpc.organization_id ?? null,
    phone: null,
    created_at: null,
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

function rpcErrorCode(e: unknown): string | null {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code?: unknown }).code === 'string') {
    return (e as { code: string }).code
  }
  return null
}

function normalizeAuthError(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback
  const code = rpcErrorCode(error)

  let hint = ''
  if (rawMessage && typeof rawMessage === 'string') {
    try {
      // PostgreSQL RPC errors often come wrapped like: 'db error: ERROR:  Мессеж'
      const m = rawMessage.match(/ERROR:\s*([^\n]+)/i)
      if (m && m[1]) hint = m[1].trim()
    } catch {
      // noop
    }
  }
  const lower = (hint || rawMessage || '').toLowerCase()

  if (lower.includes('бүртгэлтэй байна')) return hint || rawMessage || fallback
  if (lower.includes('имэйл эсвэл нууц үг буруу')) return hint || rawMessage || fallback
  if (lower.includes('имэйл') && lower.includes('оруулна')) return hint || rawMessage || fallback
  if (lower.includes('нууц үг') && lower.includes('дор хаяж')) return hint || rawMessage || fallback
  if (code === 'P0001') return hint || rawMessage || fallback
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Имэйл илгээхэд түр хүлээнэ үү. Дараа дахин оролдоно уу.'
  }

  return hint || rawMessage || fallback
}

function unwrapSingleRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return null
    const first = data[0]
    return first && typeof first === 'object' ? (first as T) : null
  }
  return data && typeof data === 'object' ? (data as T) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const applyRpcToState = useCallback((rpc: RpcLoginResult | RpcSessionResult) => {
    const profileId = rpc.profile_id
    const roleName = normalizeRoleName(rpc.role_name)
    const roleRank = Number.isFinite(rpc.role_rank) ? rpc.role_rank : (roleName ? USER_ROLES[roleName].rank : 0)
    const expiresAt = new Date(rpc.expires_at).toISOString()

    const u: AuthUser = {
      id: profileId,
      email: rpc.email,
      first_name: rpc.first_name ?? null,
      last_name: rpc.last_name ?? null,
      avatar_url: rpc.avatar_url ?? null,
      role: roleName,
      role_rank: roleRank,
      organization_id: rpc.organization_id ?? null,
      phone: null,
      created_at: null,
    }

    let token: string | null = null
    if ('token' in rpc) token = rpc.token

    if (token) {
      applySessionToken(token, true)
      setSession({ token, expires_at: expiresAt })
    }

    setUser(u)
    setProfile({
      id: profileId,
      organization_id: rpc.organization_id ?? null,
      role_name: roleName,
      first_name: rpc.first_name ?? null,
      last_name: rpc.last_name ?? null,
      avatar_url: rpc.avatar_url ?? null,
    })
  }, [])

  const clearAllState = useCallback(() => {
    applySessionToken(null, true)
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const restoreFromToken = useCallback(async (token: string) => {
    try {
      const res = await supabase.rpc('auth_get_session', { p_token: token } as any)
      if (res.error) throw res.error

      const data = unwrapSingleRpcRow<RpcSessionResult>(res.data)
      if (!data || !data.profile_id) {
        clearAllState()
        return false
      }

      const enriched = {
        token,
        ...data,
      } satisfies RpcLoginResult
      applyRpcToState(enriched)
      return true
    } catch {
      clearAllState()
      return false
    }
  }, [applyRpcToState, clearAllState])

  const tryRefreshFromStorage = useCallback(async () => {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      setIsLoading(false)
      return
    }
    let token: string | null = null
    try {
      const raw = window.localStorage.getItem('suh.auth.session')
      if (raw) {
        const parsed = JSON.parse(raw) as { token?: string }
        if (parsed && typeof parsed.token === 'string') token = parsed.token
      }
    } catch {
      token = null
    }

    if (token) {
      const ok = await restoreFromToken(token)
      if (!ok) clearAllState()
    }
    setIsLoading(false)
  }, [restoreFromToken, clearAllState])

  useEffect(() => {
    let mounted = true
    void tryRefreshFromStorage().finally(() => {
      if (mounted) setIsLoading((v) => (v ? false : v))
    })
    return () => {
      mounted = false
    }
  }, [tryRefreshFromStorage])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const res = await supabase.rpc('auth_login', { p_email: email, p_password: password } as any)
    if (res.error) {
      const message = normalizeAuthError(res.error, 'Нэвтрэхэд алдаа гарлаа.')
      setError(new Error(message))
      throw new Error(message)
    }

    const row = unwrapSingleRpcRow<RpcLoginResult>(res.data)
    if (!row || !row.token) {
      const msg = 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.'
      setError(new Error(msg))
      throw new Error(msg)
    }

    applyRpcToState(row)
  }, [applyRpcToState])

  const signInWithGoogle = useCallback(async () => {
    setError(new Error('Google-ээр нэвтрэх тохиргоог идэвхжүүлээгүй. Имэйл/нууц үгээр нэвтрэнэ үү.'))
    throw new Error('Google auth идэвхжүүлээгүй. Имэйл ашиглана уу.')
  }, [])

  const signInWithMagicLink = useCallback(async () => {
    setError(new Error('Magic Link идэвхжүүлээгүй. Имэйл/нууц үгээр нэвтрэнэ үү.'))
    throw new Error('Magic Link идэвхжүүлээгүй.')
  }, [])

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    setError(null)
    const res = await supabase.rpc('auth_signup', {
      p_email: email,
      p_password: password,
      p_first_name: firstName,
      p_last_name: lastName,
    } as any)
    if (res.error) {
      const message = normalizeAuthError(res.error, 'Бүртгүүлэхэд алдаа гарлаа.')
      setError(new Error(message))
      throw new Error(message)
    }

    const row = unwrapSingleRpcRow<RpcLoginResult>(res.data)
    if (!row || !row.token) {
      const msg = 'Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу.'
      setError(new Error(msg))
      throw new Error(msg)
    }

    applyRpcToState(row)

    const builtUser: AuthUser = mapRpcToUser(row)
    const builtSession: AuthSession = { token: row.token, expires_at: new Date(row.expires_at).toISOString() }
    return { user: builtUser, session: builtSession }
  }, [applyRpcToState])

  const signOut = useCallback(async () => {
    let tokenToRevoke: string | null = null
    try {
      const raw = typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage.getItem('suh.auth.session') : null
      if (raw) {
        const p = JSON.parse(raw) as { token?: string }
        if (p && typeof p.token === 'string') tokenToRevoke = p.token
      }
    } catch {
      tokenToRevoke = null
    }

    if (tokenToRevoke) {
      try {
        const res = await supabase.rpc('auth_logout', { p_token: tokenToRevoke } as any)
        if (res.error) throw res.error
      } catch (e) {
        console.warn('[auth] logout rpc error (non-fatal):', e)
      }
    }
    clearAllState()
  }, [clearAllState])

  const refreshProfile = useCallback(async () => {
    let token: string | null = null
    try {
      const raw = typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage.getItem('suh.auth.session') : null
      if (raw) {
        const p = JSON.parse(raw) as { token?: string }
        if (p && typeof p.token === 'string') token = p.token
      }
    } catch {
      token = null
    }

    if (!token) {
      clearAllState()
      return
    }
    await restoreFromToken(token)
  }, [restoreFromToken, clearAllState])

  const role = useMemo<UserRole | null>(() => profile?.role_name ?? user?.role ?? null, [profile, user])
  const roleRank = useMemo(() => {
    if (user?.role_rank) return user.role_rank
    if (role) return USER_ROLES[role].rank
    return 0
  }, [user, role])
  const organizationId = useMemo(() => profile?.organization_id ?? user?.organization_id ?? null, [profile, user])
  const isAuthenticated = Boolean(user || session)

  const hasRole = useCallback(
    (r: UserRole) => role === r,
    [role]
  )

  const hasMinRank = useCallback(
    (rank: number) => roleRank >= rank,
    [roleRank]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role,
      roleRank,
      organizationId,
      isLoading,
      isAuthenticated,
      error,
      signIn,
      signInWithGoogle,
      signInWithMagicLink,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
      hasMinRank,
    }),
    [
      user,
      session,
      profile,
      role,
      roleRank,
      organizationId,
      isLoading,
      isAuthenticated,
      error,
      signIn,
      signInWithGoogle,
      signInWithMagicLink,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
      hasMinRank,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be used within <AuthProvider>')
  }
  return ctx
}
