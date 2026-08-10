-- ============================================================
-- Migration 006 - Custom Auth RPC Functions
-- Security definer so anon key can call them (no service role in browser)
-- ============================================================

-- Make sure citext extension exists for email
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------
-- 1) AUTH.SIGNUP
-- Creates profile + hash password + return session token
-- ------------------------------
CREATE OR REPLACE FUNCTION public.auth_signup(
    p_email TEXT,
    p_password TEXT,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    token UUID,
    profile_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role_name TEXT,
    role_rank INTEGER,
    organization_id UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
    v_profile_id UUID;
    v_role_name TEXT;
    v_role_rank INTEGER;
    v_org_id UUID;
    v_token UUID;
    v_expires TIMESTAMPTZ;
BEGIN
    -- Trim + normalize
    p_email := lower(trim(p_email));

    IF p_email IS NULL OR length(p_email) < 3 THEN
        RAISE EXCEPTION 'И-мэйл хаяг оруулна уу';
    END IF;

    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Нууц үг дор хаяж 6 тэмдэгт байна';
    END IF;

    -- Existing check
    IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.email = p_email::CITEXT) THEN
        RAISE EXCEPTION 'И-мэйл бүртгэлтэй байна';
    END IF;

    -- Insert profile
    INSERT INTO public.profiles (email, password_hash, first_name, last_name, role_id)
    VALUES (
        p_email::CITEXT,
        crypt(p_password, gen_salt('bf')),
        p_first_name,
        p_last_name,
        (SELECT id FROM public.roles WHERE name = 'resident' LIMIT 1)
    )
    RETURNING id INTO v_profile_id;

    -- Create org-less resident role (profile.role_id FK handles basic role)
    SELECT r.name, r.rank, pr.organization_id
    INTO v_role_name, v_role_rank, v_org_id
    FROM public.profiles pr
    LEFT JOIN public.roles r ON r.id = pr.role_id
    WHERE pr.id = v_profile_id;

    v_role_name := COALESCE(v_role_name, 'resident');
    v_role_rank := COALESCE(v_role_rank, 10);

    -- Session
    INSERT INTO public.sessions (profile_id)
    VALUES (v_profile_id)
    RETURNING sessions.token, sessions.expires_at INTO v_token, v_expires;

    -- update last_login_at
    UPDATE public.profiles SET last_login_at = NOW() WHERE id = v_profile_id;

    RETURN QUERY
    SELECT
        v_token,
        v_profile_id,
        p_email,
        p_first_name,
        p_last_name,
        (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = v_profile_id),
        v_role_name,
        v_role_rank,
        v_org_id,
        v_expires;
END;
$$;

-- ------------------------------
-- 2) AUTH.LOGIN
-- ------------------------------
CREATE OR REPLACE FUNCTION public.auth_login(
    p_email TEXT,
    p_password TEXT
)
RETURNS TABLE (
    token UUID,
    profile_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role_name TEXT,
    role_rank INTEGER,
    organization_id UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
    v_profile_id UUID;
    v_role_name TEXT;
    v_role_rank INTEGER;
    v_org_id UUID;
    v_token UUID;
    v_expires TIMESTAMPTZ;
    v_hash TEXT;
    v_email CITEXT;
    v_fname TEXT;
    v_lname TEXT;
    v_avatar TEXT;
BEGIN
    p_email := lower(trim(p_email));

    IF p_email IS NULL THEN
        RAISE EXCEPTION 'И-мэйл хаяг оруулна уу';
    END IF;

    IF p_password IS NULL THEN
        RAISE EXCEPTION 'Нууц үг оруулна уу';
    END IF;

    SELECT pr.id, pr.password_hash, pr.email, pr.first_name, pr.last_name, pr.avatar_url, pr.organization_id
      INTO v_profile_id, v_hash, v_email, v_fname, v_lname, v_avatar, v_org_id
    FROM public.profiles pr
    WHERE pr.email = p_email::CITEXT;

    IF v_profile_id IS NULL OR v_hash IS NULL THEN
        RAISE EXCEPTION 'И-мэйл эсвэл нууц үг буруу';
    END IF;

    IF crypt(p_password, v_hash) <> v_hash THEN
        RAISE EXCEPTION 'И-мэйл эсвэл нууц үг буруу';
    END IF;

    -- Expire old sessions? Keep: sessions have own expires_at

    INSERT INTO public.sessions (profile_id)
    VALUES (v_profile_id)
    RETURNING sessions.token, sessions.expires_at INTO v_token, v_expires;

    UPDATE public.profiles SET last_login_at = NOW() WHERE id = v_profile_id;

    SELECT r.name, r.rank INTO v_role_name, v_role_rank
    FROM public.roles r
    WHERE r.id = (SELECT pr.role_id FROM public.profiles pr WHERE pr.id = v_profile_id);

    -- Fallback role name
    IF v_role_name IS NULL THEN
        v_role_name := 'resident';
        v_role_rank := 10;
    END IF;

    RETURN QUERY
    SELECT
        v_token,
        v_profile_id,
        v_email::TEXT,
        v_fname,
        v_lname,
        v_avatar,
        v_role_name,
        v_role_rank,
        v_org_id,
        v_expires;
END;
$$;

-- ------------------------------
-- 3) AUTH.GET_SESSION
-- ------------------------------
CREATE OR REPLACE FUNCTION public.auth_get_session(p_token UUID)
RETURNS TABLE (
    profile_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role_name TEXT,
    role_rank INTEGER,
    organization_id UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
BEGIN
    IF p_token IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        pr.id,
        pr.email::TEXT,
        pr.first_name,
        pr.last_name,
        pr.avatar_url,
        COALESCE(r.name, 'resident'),
        COALESCE(r.rank, 10),
        pr.organization_id,
        s.expires_at
    FROM public.sessions s
    JOIN public.profiles pr ON pr.id = s.profile_id
    LEFT JOIN public.roles r ON r.id = pr.role_id
    WHERE s.token = p_token
      AND s.expires_at > NOW();

    IF NOT FOUND THEN
        DELETE FROM public.sessions WHERE token = p_token;
    END IF;
END;
$$;

-- ------------------------------
-- 4) AUTH.LOGOUT
-- ------------------------------
CREATE OR REPLACE FUNCTION public.auth_logout(p_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
BEGIN
    IF p_token IS NULL THEN RETURN; END IF;
    DELETE FROM public.sessions WHERE token = p_token;
END;
$$;

-- ------------------------------
-- 5) Seed: default org_admin user (so app has login)
-- Email: admin@suh.mn / Password: admin123
-- ------------------------------
DO $$
DECLARE
    v_org_id UUID;
    v_role_id UUID;
    v_profile_id UUID;
BEGIN
    SET LOCAL search_path TO public, extensions;
    -- Make sure super_admin / org_admin / resident roles exist (idempotent)
    INSERT INTO public.roles (name, description, rank, permissions) VALUES
        ('super_admin', 'System-wide super administrator', 100, '{"*": true}'::jsonb),
        ('org_admin', 'HOA / СӨХ organization administrator', 90, '{"organization":"*"}'::jsonb),
        ('resident', 'Resident / Apartment owner or tenant', 10, '{"self":"read"}'::jsonb)
    ON CONFLICT (name) DO NOTHING;

    -- Default org
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
    IF v_org_id IS NULL THEN
        INSERT INTO public.organizations (name, email, address, primary_color)
        VALUES ('SUH HOA Management', 'admin@suh.mn', 'Ulaanbaatar', '#0d9488')
        RETURNING id INTO v_org_id;
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE name = 'org_admin' LIMIT 1;
    IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM public.roles ORDER BY rank DESC NULLS LAST LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'admin@suh.mn'::CITEXT) THEN
        INSERT INTO public.profiles (email, password_hash, first_name, last_name, organization_id, role_id)
        VALUES (
            'admin@suh.mn'::CITEXT,
            crypt('admin123', gen_salt('bf')),
            'System',
            'Administrator',
            v_org_id,
            v_role_id
        ) RETURNING id INTO v_profile_id;

        IF v_org_id IS NOT NULL AND v_profile_id IS NOT NULL AND v_role_id IS NOT NULL THEN
            INSERT INTO public.organization_members (organization_id, profile_id, role_id)
            VALUES (v_org_id, v_profile_id, v_role_id)
            ON CONFLICT (organization_id, profile_id) DO UPDATE SET role_id = EXCLUDED.role_id;
        END IF;
    END IF;
END $$;

-- Grant execution to anon + authenticated (for browser publishable key)
GRANT EXECUTE ON FUNCTION public.auth_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_signup(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_get_session(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_logout(UUID) TO anon, authenticated;
