import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/services/supabase'
import type { UserRole } from '@/shared/types'
import { USER_ROLES } from '@/shared/types'

interface Profile {
  id: string
  organization_id: string | null
  role_name: UserRole | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  roleRank: number
  organizationId: string | null
  isLoading: boolean
  error: AuthError | null
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasMinRank: (rank: number) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const res = await supabase
        .from('profiles')
        .select(`
          id,
          organization_id,
          first_name,
          last_name,
          avatar_url,
          organization_members (
            roles ( name, rank )
          )
        `)
        .eq('id', userId)
        .maybeSingle()

      if (res.error && res.error.code !== 'PGRST116') throw res.error

      const data = res.data as unknown as (null | {
        id: string
        organization_id: string | null
        first_name: string | null
        last_name: string | null
        avatar_url: string | null
        organization_members: Array<{ roles: { name: string; rank: number } }> | null
      })

      if (data) {
        const member = (data.organization_members ?? [])?.[0]
        setProfile({
          id: data.id,
          organization_id: data.organization_id,
          role_name: (member?.roles?.name as UserRole) ?? null,
          first_name: data.first_name,
          last_name: data.last_name,
          avatar_url: data.avatar_url,
        })
      }
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const initAuth = async () => {
      setIsLoading(true)
      const { data: { session: s } } = await supabase.auth.getSession()
      if (mounted) {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchProfile(s.user.id)
        }
        setIsLoading(false)
      }
    }
    void initAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (mounted) {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchProfile(s.user.id)
        } else {
          setProfile(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error: e } = await supabase.auth.signInWithPassword({ email, password })
    if (e) {
      setError(e)
      throw e
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
    if (e) {
      setError(e)
      throw e
    }
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    setError(null)
    const { error: e } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (e) {
      setError(e)
      throw e
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    setError(null)
    const { error: e, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    })
    if (e) {
      setError(e)
      throw e
    }
    if (data.user) {
      await fetchProfile(data.user.id)
    }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    const { error: e } = await supabase.auth.signOut()
    if (e) {
      setError(e)
      throw e
    }
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const role = useMemo<UserRole | null>(() => profile?.role_name ?? null, [profile])
  const roleRank = useMemo(() => (role ? USER_ROLES[role].rank : 0), [role])
  const organizationId = useMemo(() => profile?.organization_id ?? null, [profile])

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
    [user, session, profile, role, roleRank, organizationId, isLoading, error, signIn, signInWithGoogle, signInWithMagicLink, signUp, signOut, refreshProfile, hasRole, hasMinRank]
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
