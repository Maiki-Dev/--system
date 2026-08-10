-- ============================================================
-- Migration 005 - Custom Auth: Detach profiles from auth.users,
-- add email/password_hash, create sessions table
-- ============================================================

-- Required extensions BEFORE we use citext / pgcrypto
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles: email + password_hash + drop FK to auth.users (make PK independent)
DO $$
BEGIN
    -- 1) Add email (case-insensitive unique)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='profiles' AND column_name='email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email CITEXT;
    END IF;

    -- 2) Add password_hash (bcrypt via pgcrypto)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='profiles' AND column_name='password_hash'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN password_hash TEXT;
    END IF;
END $$;

-- Drop FK to auth.users if present, make id independent with default
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'profiles'
      AND tc.constraint_type = 'FOREIGN KEY';

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

-- Make id DEFAULT independent (migrations without supabase auth)
ALTER TABLE public.profiles
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Unique email (ignore NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
    ON public.profiles(email)
    WHERE email IS NOT NULL;

-- ============================================================
-- SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON public.sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- RLS on sessions: only own session row (verified via token in RPC)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
