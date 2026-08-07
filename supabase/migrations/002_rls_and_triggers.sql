-- ============================================================
-- HOA / СӨХ Management Platform - Migration 002
-- Triggers + Row Level Security (RLS) Policies
-- ============================================================

-- ============================================================
-- AUTOMATIC updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'organizations','profiles','buildings','apartments','residents',
        'family_members','vehicles','parking_slots','parking_logs',
        'visitors','visitor_blacklist','invoices','payments',
        'accounting_categories','accounting_transactions',
        'complaints','complaint_comments','work_orders','work_order_comments',
        'announcements','documents','meetings','meeting_attendees','votes'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_%s_updated_at ON public.%I', t, t);
            EXECUTE format('CREATE TRIGGER trigger_%s_updated_at
                BEFORE UPDATE ON public.%I
                FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t, t);
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- AUTH HOOK: Auto-create profile + assign default role on signup
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_resident_role_id UUID;
    v_org_admin_role_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');

    -- Use an existing organization if present; otherwise create one.
    SELECT id INTO v_org_id
    FROM public.organizations
    ORDER BY created_at, id
    LIMIT 1;

    IF v_org_id IS NULL THEN
        INSERT INTO public.organizations (name)
        VALUES ('Default Organization')
        RETURNING id INTO v_org_id;
    END IF;

    -- Create or update profile row and link it to an organization.
    INSERT INTO public.profiles (
        id, organization_id, first_name, last_name, email, phone,
        last_login_at
    ) VALUES (
        NEW.id,
        v_org_id,
        v_first_name,
        v_last_name,
        NEW.email,
        NEW.phone,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        last_login_at = EXCLUDED.last_login_at;

    -- Backfill existing profiles that were created without an organization.
    UPDATE public.profiles
    SET organization_id = v_org_id
    WHERE id = NEW.id
      AND (organization_id IS NULL OR organization_id <> v_org_id);

    -- First user ever becomes org_admin; otherwise resident.
    IF (SELECT COUNT(*) FROM auth.users) <= 1 THEN
        SELECT id INTO v_org_admin_role_id FROM public.roles WHERE name = 'org_admin';
        IF v_org_admin_role_id IS NOT NULL AND v_org_id IS NOT NULL THEN
            INSERT INTO public.organization_members (organization_id, profile_id, role_id)
            VALUES (v_org_id, NEW.id, v_org_admin_role_id)
            ON CONFLICT (organization_id, profile_id) DO NOTHING;
        END IF;
    ELSE
        SELECT id INTO v_resident_role_id FROM public.roles WHERE name = 'resident';
        IF v_resident_role_id IS NOT NULL AND v_org_id IS NOT NULL THEN
            INSERT INTO public.organization_members (organization_id, profile_id, role_id)
            VALUES (v_org_id, NEW.id, v_resident_role_id)
            ON CONFLICT (organization_id, profile_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- AUTH HOOK: Track last_login_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles SET last_login_at = NOW() WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
EXECUTE FUNCTION public.handle_user_login();

-- ============================================================
-- HELPER: Get current user's org_id, role, rank
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT r.name
        FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
        WHERE om.profile_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role_rank()
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE((
        SELECT r.rank
        FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
        WHERE om.profile_id = auth.uid()
        LIMIT 1
    ), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.current_user_role_rank() >= 100);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- DEFAULT soft-delete filter (deleted_at IS NULL) helper via
-- views would be cleaner, but we use filters in app layer and
-- rely on policies including IS NULL checks here.
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL CORE TABLES + CREATE POLICIES
-- ============================================================

-- ---------- ORGANIZATIONS ----------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT USING (
    auth.uid() IS NOT NULL
);

-- ---------- PROFILES ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR id = auth.uid()
);

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (
    id = auth.uid()
);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR id = auth.uid()
) WITH CHECK (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR id = auth.uid()
);

-- ---------- ORGANIZATION_MEMBERS ----------
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR profile_id = auth.uid()
);

DROP POLICY IF EXISTS org_members_write ON public.organization_members;
CREATE POLICY org_members_write ON public.organization_members FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 90
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 90)
    AND organization_id = COALESCE(NULLIF(public.current_user_organization_id(), organization_id), organization_id)
);

-- ---------- BUILDINGS ----------
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apartments_select ON public.apartments;
CREATE POLICY apartments_select ON public.apartments FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR EXISTS (
        SELECT 1 FROM public.residents r
        WHERE r.apartment_id = apartments.id
          AND r.profile_id = auth.uid()
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
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS residents_select ON public.residents;
CREATE POLICY residents_select ON public.residents FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR profile_id = auth.uid()
);

DROP POLICY IF EXISTS residents_write ON public.residents;
CREATE POLICY residents_write ON public.residents FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- ---------- FAMILY_MEMBERS ----------
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_select ON public.family_members;
CREATE POLICY family_select ON public.family_members FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.residents r
        WHERE r.id = family_members.resident_id
          AND (
              r.organization_id = public.current_user_organization_id()
              OR r.profile_id = auth.uid()
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
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_select ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
    OR resident_id IN (
        SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid()
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
ALTER TABLE public.parking_slots ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.parking_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parking_logs_select ON public.parking_logs;
CREATE POLICY parking_logs_select ON public.parking_logs FOR SELECT USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 40
);

DROP POLICY IF EXISTS parking_logs_write ON public.parking_logs;
CREATE POLICY parking_logs_write ON public.parking_logs FOR INSERT WITH CHECK (
    public.is_super_admin() OR public.current_user_role_rank() >= 40
);

-- ============================================================
-- STORAGE BUCKETS (declarative; requires enabled in dashboard too)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
    ('resident-photos', 'resident-photos', false, false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
    ('building-photos', 'building-photos', false, false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
    ('complaint-images', 'complaint-images', false, false, 10485760, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
    ('documents', 'documents', false, false, 20971520, ARRAY['application/pdf','image/*','application/vnd.*','text/*']),
    ('receipts', 'receipts', false, false, 10485760, ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS resident_photos_read ON storage.objects;
CREATE POLICY resident_photos_read ON storage.objects FOR SELECT USING (
    bucket_id = 'resident-photos'
    AND (
        public.is_super_admin()
        OR (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.organization_id = public.current_user_organization_id()
            )
        )
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
        OR name LIKE auth.uid() || '%'
    )
);

DROP POLICY IF EXISTS authed_upload_any ON storage.objects;
CREATE POLICY authed_upload_any ON storage.objects FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND bucket_id IN ('resident-photos','building-photos','complaint-images','documents','receipts')
);
