-- ============================================================
-- TEST QUERY — Custom Auth Migrations + RPC
-- Supabase SQL Editor-руу шууд paste хийж RUN хийнэ үү
-- Мөр бүр нь шууд ажиллана, ямар ч алдаа гарвал мөр дугаартаа заана
-- ============================================================

-- ================================================================
-- 1. SANITY: extension + basic tables exist
-- ================================================================
DO $$
DECLARE
    v_citext BOOL;
    v_pgcrypto BOOL;
BEGIN
    v_citext := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext');
    v_pgcrypto := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto');
    IF NOT v_citext THEN RAISE EXCEPTION '1. FAIL — citext extension суугдаагүй. Migration 005 run хийхгүй байна.'; END IF;
    IF NOT v_pgcrypto THEN RAISE EXCEPTION '1. FAIL — pgcrypto extension суугдаагүй.'; END IF;
    RAISE NOTICE '1. PASS — citext + pgcrypto суугдсан.';
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='profiles' AND column_name='email') THEN
        RAISE EXCEPTION '1b. FAIL — profiles.email column байхгүй. Migration 005 run хийхгүй.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='profiles' AND column_name='password_hash') THEN
        RAISE EXCEPTION '1b. FAIL — profiles.password_hash байхгүй.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='sessions') THEN
        RAISE EXCEPTION '1b. FAIL — sessions table байхгүй.';
    END IF;
    RAISE NOTICE '1b. PASS — profiles columns + sessions table үүссэн.';
END $$;

-- ================================================================
-- 2. SEED USER (admin@suh.mn) + hash байгаа эсэх
-- ================================================================
DO $$
DECLARE
    cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt FROM public.profiles WHERE email = 'admin@suh.mn'::CITEXT;
    IF cnt = 0 THEN
        RAISE NOTICE '2. WARN — admin@suh.mn seed user байхгүй. Migration 006 seed part run хийхгүй?';
    ELSE
        IF EXISTS (SELECT 1 FROM public.profiles WHERE email='admin@suh.mn'::CITEXT AND password_hash IS NULL) THEN
            RAISE EXCEPTION '2. FAIL — admin@suh.mn password_hash NULL байна.';
        END IF;
        RAISE NOTICE '2. PASS — admin@suh.mn бүртгэлтэй + password_hash байгаа.';
    END IF;
END $$;

-- ================================================================
-- 3. RPC function-ууд definition байгаа эсэх
-- ================================================================
DO $$
DECLARE
    missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_login' AND pronamespace='public'::regnamespace) THEN
        missing := array_append(missing, 'auth_login');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_signup' AND pronamespace='public'::regnamespace) THEN
        missing := array_append(missing, 'auth_signup');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_get_session' AND pronamespace='public'::regnamespace) THEN
        missing := array_append(missing, 'auth_get_session');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_logout' AND pronamespace='public'::regnamespace) THEN
        missing := array_append(missing, 'auth_logout');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_profile_id' AND pronamespace='public'::regnamespace) THEN
        missing := array_append(missing, 'current_profile_id');
    END IF;
    IF array_length(missing,1) > 0 THEN
        RAISE EXCEPTION '3. FAIL — missing RPC functions: %', array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE '3. PASS — бүх RPC functions (auth_login/auth_signup/auth_get_session/auth_logout/current_profile_id) байхаа илрүүлсэн.';
END $$;

-- ================================================================
-- 4. auth_login RPC LIVE TEST — admin@suh.mn / admin123
-- ================================================================
-- NOTE: pgcrypto crypt() нь 1 round-д ~100ms хугацаа тул удаан ажиллах боломжтой
SELECT '4. auth_login RPC result:' as step, token, profile_id, email, role_name, role_rank, organization_id, expires_at
FROM public.auth_login('admin@suh.mn', 'admin123');

-- ================================================================
-- 5. Take token from step 4 → test auth_get_session
--    (Доорх <TOKEN_ЭНД_ӨРҮҮЛНЭ> placehold-ийг 4. дэх гарсан token_uuid-ээр солино)
-- ================================================================
-- SELECT '5. auth_get_session:' as step, profile_id, email, role_name, organization_id
-- FROM public.auth_get_session('<TOKEN_ЭНД_ӨРҮҮЛНЭ>'::UUID);

-- ================================================================
-- 6. RLS — current_profile_id() header-гүйгээр NULL буцна (энийг нь баталгаажуулах)
--    Энэ нь PostgREST request-ээс гадна SQL Editor-аас шууд ажиллуулахад default NULL
-- ================================================================
DO $$
DECLARE
    v UUID;
BEGIN
    v := public.current_profile_id();
    IF v IS NOT NULL THEN
        RAISE NOTICE '6. INFO — current_profile_id() = % — editor session state-аас байна (олон тохиолдолд NULL байна, зүгээр).', v;
    ELSE
        RAISE NOTICE '6. PASS — current_profile_id() = NULL (RLS headerгүй default).';
    END IF;
END $$;

-- ================================================================
-- 7. Test RLS реал дугуй: Set local session token → RLS select organizations
--    (Энэ нь PostgREST рестээс X-Suh-Token header-тэй request хийх simulation юм)
-- ================================================================
DO $$
DECLARE
    sess UUID;
    tok UUID;
    pid UUID;
    orgs_cnt INTEGER;
BEGIN
    -- create ephemeral session for admin
    SELECT pr.id INTO pid FROM public.profiles pr WHERE pr.email='admin@suh.mn'::CITEXT LIMIT 1;
    IF pid IS NULL THEN RETURN; END IF;

    INSERT INTO public.sessions (profile_id) VALUES (pid) RETURNING token INTO tok;
    PERFORM set_config('app.suh_session_token', tok::TEXT, true);

    SELECT public.current_profile_id() INTO sess;
    IF sess <> pid THEN
        RAISE EXCEPTION '7. FAIL — setConfig+current_profile_id simulation алдаа: %, expected %', sess, pid;
    END IF;

    SELECT COUNT(*) INTO orgs_cnt FROM public.organizations;
    RAISE NOTICE '7. PASS — Session header simulation: profile=% visible orgs=%', sess, orgs_cnt;

    -- tidy
    DELETE FROM public.sessions WHERE token = tok;
    PERFORM set_config('app.suh_session_token', '', true);
END $$;

-- ================================================================
-- 8. anon authenticated role-д RPC execute permission байгаа эсэх
-- ================================================================
DO $$
DECLARE
    missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF NOT has_function_privilege('anon', 'public.auth_login(text,text)', 'EXECUTE') THEN
        missing := array_append(missing, 'anon:auth_login');
    END IF;
    IF NOT has_function_privilege('anon', 'public.auth_signup(text,text,text,text)', 'EXECUTE') THEN
        missing := array_append(missing, 'anon:auth_signup');
    END IF;
    IF NOT has_function_privilege('anon', 'public.auth_get_session(uuid)', 'EXECUTE') THEN
        missing := array_append(missing, 'anon:auth_get_session');
    END IF;
    IF NOT has_function_privilege('anon', 'public.current_profile_id()', 'EXECUTE') THEN
        missing := array_append(missing, 'anon:current_profile_id');
    END IF;
    IF array_length(missing,1) > 0 THEN
        RAISE EXCEPTION '8. FAIL — anon role-д execute байхгүй: %', array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE '8. PASS — anon role execute permission бүг нь байгаа.';
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Бүх шалгалтууд дууслаа. Мөр дээр NOTICE-үүдээс харна уу.';
END $$;
