-- ============================================================
-- Migration 007 - RLS for Custom Auth (no Supabase Auth JWT)
--
-- Frontend sends session UUID in request header X-Suh-Token.
-- PostgREST exposes all headers as JSONB in:
--   current_setting('request.headers', true)::jsonb
-- with dashes converted to underscores: x_suh_token
-- ============================================================

-- ------------------------------
-- current_profile_id() - look up session via header
-- ------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_headers JSONB;
    v_token_str TEXT;
    v_token UUID;
    v_profile_id UUID;
BEGIN
    v_headers := NULL;
    BEGIN
        v_headers := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    v_token_str := NULL;
    IF v_headers IS NOT NULL THEN
        v_token_str := v_headers->>'x_suh_token';
        IF v_token_str IS NULL THEN
            v_token_str := v_headers->>'x-suh-token';
        END IF;
    END IF;

    IF v_token_str IS NULL THEN
        BEGIN
            v_token_str := current_setting('app.suh_session_token', true);
        EXCEPTION WHEN OTHERS THEN
            v_token_str := NULL;
        END;
    END IF;

    IF v_token_str IS NULL THEN
        RETURN NULL;
    END IF;

    v_token := NULL;
    BEGIN
        v_token := v_token_str::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_token := NULL;
    END;

    IF v_token IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT s.profile_id INTO v_profile_id
    FROM public.sessions s
    WHERE s.token = v_token
      AND s.expires_at > NOW();

    RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated;

-- ------------------------------
-- Re-define helpers using current_profile_id() instead of auth.uid()
-- ------------------------------
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.id = public.current_profile_id()
        LIMIT 1
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN COALESCE(
        (
            SELECT r.name
            FROM public.profiles p
            LEFT JOIN public.roles r ON r.id = p.role_id
            WHERE p.id = public.current_profile_id()
            LIMIT 1
        ),
        (
            SELECT r.name
            FROM public.organization_members om
            JOIN public.roles r ON r.id = om.role_id
            WHERE om.profile_id = public.current_profile_id()
            LIMIT 1
        )
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role_rank()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_rank INTEGER;
BEGIN
    SELECT COALESCE(r.rank, 0) INTO v_rank
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = public.current_profile_id()
    LIMIT 1;

    IF COALESCE(v_rank, 0) > 0 THEN
        RETURN v_rank;
    END IF;

    RETURN COALESCE((
        SELECT r.rank
        FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
        WHERE om.profile_id = public.current_profile_id()
        LIMIT 1
    ), 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_role_rank() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN (public.current_user_role_rank() >= 100);
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

-- ============================================================
-- Re-create ALL RLS policies using current_profile_id()
-- ============================================================

-- ---------- ORGANIZATIONS ----------
DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT USING (
    public.is_super_admin() OR id = public.current_user_organization_id()
);

DROP POLICY IF EXISTS organizations_insert ON public.organizations;
CREATE POLICY organizations_insert ON public.organizations FOR INSERT WITH CHECK (
    public.is_super_admin()
);

DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations FOR UPDATE USING (
    public.is_super_admin() OR id = public.current_user_organization_id()
) WITH CHECK (
    public.is_super_admin() OR id = public.current_user_organization_id()
);

-- ---------- ROLES ----------
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT USING (
    public.current_profile_id() IS NOT NULL
);

-- ---------- PROFILES ----------
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR id = public.current_profile_id()
);

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (
    public.current_profile_id() IS NOT NULL
);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR id = public.current_profile_id()
) WITH CHECK (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR id = public.current_profile_id()
);

-- ---------- ORGANIZATION_MEMBERS ----------
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS org_members_write ON public.organization_members;
CREATE POLICY org_members_write ON public.organization_members FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 90
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 90)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- BUILDINGS ----------
DROP POLICY IF EXISTS buildings_select ON public.buildings;
CREATE POLICY buildings_select ON public.buildings FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
);

DROP POLICY IF EXISTS buildings_write ON public.buildings;
CREATE POLICY buildings_write ON public.buildings FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- APARTMENTS ----------
DROP POLICY IF EXISTS apartments_select ON public.apartments;
CREATE POLICY apartments_select ON public.apartments FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR EXISTS (
        SELECT 1 FROM public.residents r
        WHERE r.apartment_id = apartments.id
          AND r.profile_id = public.current_profile_id()
    )
);

DROP POLICY IF EXISTS apartments_write ON public.apartments;
CREATE POLICY apartments_write ON public.apartments FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- RESIDENTS ----------
DROP POLICY IF EXISTS residents_select ON public.residents;
CREATE POLICY residents_select ON public.residents FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR profile_id = public.current_profile_id()
);

DROP POLICY IF EXISTS residents_write ON public.residents;
CREATE POLICY residents_write ON public.residents FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- FAMILY_MEMBERS ----------
DROP POLICY IF EXISTS family_select ON public.family_members;
CREATE POLICY family_select ON public.family_members FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.residents r
        WHERE r.id = family_members.resident_id
          AND (
              r.organization_id = public.current_user_organization_id()
              OR r.profile_id = public.current_profile_id()
          )
    )
);

DROP POLICY IF EXISTS family_write ON public.family_members;
CREATE POLICY family_write ON public.family_members FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND EXISTS (
        SELECT 1 FROM public.residents r
        WHERE r.id = family_members.resident_id
          AND r.organization_id = public.current_user_organization_id()
    )
);

-- ---------- VEHICLES ----------
DROP POLICY IF EXISTS vehicles_select ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR resident_id IN (
        SELECT r.id FROM public.residents r WHERE r.profile_id = public.current_profile_id()
    )
);

DROP POLICY IF EXISTS vehicles_write ON public.vehicles;
CREATE POLICY vehicles_write ON public.vehicles FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 40
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 40)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- PARKING_SLOTS ----------
DROP POLICY IF EXISTS parking_slots_select ON public.parking_slots;
CREATE POLICY parking_slots_select ON public.parking_slots FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
);

DROP POLICY IF EXISTS parking_slots_write ON public.parking_slots;
CREATE POLICY parking_slots_write ON public.parking_slots FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- PARKING_LOGS ----------
DROP POLICY IF EXISTS parking_logs_select ON public.parking_logs;
CREATE POLICY parking_logs_select ON public.parking_logs FOR SELECT USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 40
);

DROP POLICY IF EXISTS parking_logs_write ON public.parking_logs;
CREATE POLICY parking_logs_write ON public.parking_logs FOR INSERT WITH CHECK (
    public.is_super_admin() OR public.current_user_role_rank() >= 40
);

-- ---------- VISITORS + VISITOR_BLACKLIST ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='visitors') THEN
        ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS visitors_select ON public.visitors;
        CREATE POLICY visitors_select ON public.visitors FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
            OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = public.current_profile_id())
        );
        DROP POLICY IF EXISTS visitors_write ON public.visitors;
        CREATE POLICY visitors_write ON public.visitors FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 40
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 40)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='visitor_blacklist') THEN
        ALTER TABLE public.visitor_blacklist ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS vb_select ON public.visitor_blacklist;
        CREATE POLICY vb_select ON public.visitor_blacklist FOR SELECT USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 40
        );
        DROP POLICY IF EXISTS vb_write ON public.visitor_blacklist;
        CREATE POLICY vb_write ON public.visitor_blacklist FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 40
        );
    END IF;
END $$;

-- ---------- INVOICES + PAYMENTS ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN
        ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS inv_select ON public.invoices;
        CREATE POLICY inv_select ON public.invoices FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
            OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = public.current_profile_id())
        );
        DROP POLICY IF EXISTS inv_write ON public.invoices;
        CREATE POLICY inv_write ON public.invoices FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 60
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 60)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
        ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS pay_select ON public.payments;
        CREATE POLICY pay_select ON public.payments FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
            OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = public.current_profile_id())
        );
        DROP POLICY IF EXISTS pay_write ON public.payments;
        CREATE POLICY pay_write ON public.payments FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 60
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 60)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;
END $$;

-- ---------- COMPLAINTS + MAINTENANCE ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='complaints') THEN
        ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS comp_select ON public.complaints;
        CREATE POLICY comp_select ON public.complaints FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
            OR assigned_to = public.current_profile_id()
            OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = public.current_profile_id())
        );
        DROP POLICY IF EXISTS comp_write ON public.complaints;
        CREATE POLICY comp_write ON public.complaints FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 30
        ) WITH CHECK (
            organization_id = public.current_user_organization_id()
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='work_orders') THEN
        ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS wo_select ON public.work_orders;
        CREATE POLICY wo_select ON public.work_orders FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
            OR assigned_to = public.current_profile_id()
            OR created_by = public.current_profile_id()
        );
        DROP POLICY IF EXISTS wo_write ON public.work_orders;
        CREATE POLICY wo_write ON public.work_orders FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 30
        ) WITH CHECK (
            organization_id = public.current_user_organization_id()
        );
    END IF;
END $$;

-- ---------- ANNOUNCEMENTS ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='announcements') THEN
        ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS ann_select ON public.announcements;
        CREATE POLICY ann_select ON public.announcements FOR SELECT USING (
            public.current_profile_id() IS NOT NULL
            AND (
                public.is_super_admin()
                OR organization_id = public.current_user_organization_id()
            )
        );
        DROP POLICY IF EXISTS ann_write ON public.announcements;
        CREATE POLICY ann_write ON public.announcements FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 70
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 70)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;
END $$;

-- ---------- STORAGE ----------
DROP POLICY IF EXISTS resident_photos_read ON storage.objects;
CREATE POLICY resident_photos_read ON storage.objects FOR SELECT USING (
    bucket_id = 'resident-photos'
    AND (
        public.is_super_admin()
        OR public.current_user_organization_id() IS NOT NULL
    )
);

DROP POLICY IF EXISTS building_photos_read ON storage.objects;
CREATE POLICY building_photos_read ON storage.objects FOR SELECT USING (
    bucket_id = 'building-photos'
    AND (
        public.is_super_admin()
        OR public.current_user_organization_id() IS NOT NULL
    )
);

DROP POLICY IF EXISTS documents_read ON storage.objects;
CREATE POLICY documents_read ON storage.objects FOR SELECT USING (
    bucket_id = 'documents'
    AND (
        public.is_super_admin()
        OR public.current_user_role_rank() >= 30
    )
);

DROP POLICY IF EXISTS receipts_read ON storage.objects;
CREATE POLICY receipts_read ON storage.objects FOR SELECT USING (
    bucket_id = 'receipts'
    AND (
        public.is_super_admin()
        OR public.current_user_role_rank() >= 60
    )
);

DROP POLICY IF EXISTS authed_upload_any ON storage.objects;
CREATE POLICY authed_upload_any ON storage.objects FOR INSERT WITH CHECK (
    public.current_profile_id() IS NOT NULL
    AND bucket_id IN ('resident-photos','building-photos','complaint-images','documents','receipts')
);

-- ------------------------------
-- Remove Supabase auth.users triggers
-- ------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- ============================================================
-- GRANTS — anon / authenticated roles for PostgREST
-- Without these, tables return "permission denied for relation"
-- even if RLS policies are correct.
-- ============================================================

-- Tables (current + future)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- Sequences (id / UUID generators are gen_random_uuid() so rarely used,
-- but still grant for serial/identity columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- Functions / RPC (already individually granted in 006, but blanket-catch
-- for current_profile_id() + other helpers + any new helper functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- Storage schema (for bucket RLS policies to execute on storage.objects)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- ============================================================
-- BLANKET RLS WIPE (001, 002, 003 inline auth.uid() policies)
-- Drops all custom RLS policies on known public tables so that
-- only the 007 policies (current_profile_id() based) remain.
-- Handles: accounting_*, meeting_*, votes_*, complaint_comments,
-- work_order_comments, documents (003 inline ones vs ours rename).
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname NOT IN (
              -- 007 SELECT policy names (allow-listed — keep)
              'organizations_select','organizations_insert','organizations_update',
              'roles_select',
              'profiles_select','profiles_insert_self','profiles_update',
              'org_members_select','org_members_write',
              'buildings_select','buildings_write',
              'apartments_select','apartments_write',
              'residents_select','residents_write',
              'family_select','family_write',
              'vehicles_select','vehicles_write',
              'parking_slots_select','parking_slots_write',
              'parking_logs_select','parking_logs_write',
              'visitors_select','visitors_write',
              'vb_select','vb_write',
              'inv_select','inv_write',
              'pay_select','pay_write',
              'comp_select','comp_write',
              'wo_select','wo_write',
              'ann_select','ann_write',
              'notifications_own',
              'doc_select','doc_write',
              'cmt_complaint','woc_wo','vr_vote','vr_insert','msg_org','msg_insert',
              -- activity logs (no custom policy in 007 yet, table-by-table GRANT + RLS off handled)
              'logs_org_admin'
          )
          AND tablename NOT IN ('schema_migrations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ---------- ACCOUNTING (missed tables from 003) ----------
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='accounting_categories') THEN
        DROP POLICY IF EXISTS acct_cat_org ON public.accounting_categories;
        CREATE POLICY acct_cat_org ON public.accounting_categories FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 70
            OR organization_id = public.current_user_organization_id()
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 70)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='accounting_transactions') THEN
        DROP POLICY IF EXISTS acct_tx_org ON public.accounting_transactions;
        CREATE POLICY acct_tx_org ON public.accounting_transactions FOR SELECT USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 30
            OR organization_id = public.current_user_organization_id()
        );
        DROP POLICY IF EXISTS acct_tx_write ON public.accounting_transactions;
        CREATE POLICY acct_tx_write ON public.accounting_transactions FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 70
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 70)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;
END $$;

-- ---------- MEETINGS + ATTENDEES ----------
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meetings') THEN
        DROP POLICY IF EXISTS meetings_select ON public.meetings;
        CREATE POLICY meetings_select ON public.meetings FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
        );
        DROP POLICY IF EXISTS meetings_write ON public.meetings;
        CREATE POLICY meetings_write ON public.meetings FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 70
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 70)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_attendees') THEN
        DROP POLICY IF EXISTS ma_meeting ON public.meeting_attendees;
        CREATE POLICY ma_meeting ON public.meeting_attendees FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.meetings m
                WHERE m.id = meeting_attendees.meeting_id
                  AND (m.organization_id = public.current_user_organization_id()
                       OR public.is_super_admin() OR public.current_user_role_rank() >= 70)
            )
            OR profile_id = public.current_profile_id()
            OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = public.current_profile_id())
        );
    END IF;
END $$;

-- ---------- VOTES ----------
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='votes') THEN
        DROP POLICY IF EXISTS votes_select ON public.votes;
        CREATE POLICY votes_select ON public.votes FOR SELECT USING (
            public.is_super_admin()
            OR organization_id = public.current_user_organization_id()
        );
        DROP POLICY IF EXISTS votes_write ON public.votes;
        CREATE POLICY votes_write ON public.votes FOR ALL USING (
            public.is_super_admin() OR public.current_user_role_rank() >= 90
        ) WITH CHECK (
            (public.is_super_admin() OR public.current_user_role_rank() >= 90)
            AND organization_id = public.current_user_organization_id()
        );
    END IF;
END $$;

-- ---------- ACTIVITY LOGS ----------
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='activity_logs') THEN
        DROP POLICY IF EXISTS logs_org_admin ON public.activity_logs;
        CREATE POLICY logs_org_admin ON public.activity_logs FOR SELECT USING (
            public.is_super_admin()
            OR public.current_user_role_rank() >= 70
            OR profile_id = public.current_profile_id()
        );
        -- Everyone within org can INSERT their own logs (used by use-crud.ts)
        DROP POLICY IF EXISTS logs_insert ON public.activity_logs;
        CREATE POLICY logs_insert ON public.activity_logs FOR INSERT WITH CHECK (
            profile_id = public.current_profile_id()
            OR organization_id = public.current_user_organization_id()
        );
    END IF;
END $$;
