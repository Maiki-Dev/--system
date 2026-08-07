-- ============================================================
-- HOA / СӨХ Management Platform - Migration 001
-- Core Tables: Organizations, Roles, Profiles, Buildings,
-- Apartments, Residents, Family Members, Vehicles, Parking
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ORGANIZATIONS (Multi-tenant root)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    registration_number TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0d9488',
    currency TEXT DEFAULT 'MNT',
    timezone TEXT DEFAULT 'Asia/Ulaanbaatar',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON public.organizations(deleted_at);

-- ============================================================
-- 2. ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    rank INTEGER NOT NULL DEFAULT 0,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.roles (name, description, rank, permissions) VALUES
    ('super_admin', 'System-wide super administrator', 100, '{"*": true}'::jsonb),
    ('org_admin', 'HOA / СӨХ organization administrator', 90, '{"organization":"*","buildings":"*","apartments":"*","residents":"*","payments":"*","parking":"*","visitors":"*","complaints":"*","maintenance":"*","announcements":"*","documents":"*","meetings":"*","reports":"*","settings":"*"}'::jsonb),
    ('manager', 'Building / Facility manager', 70, '{"buildings":"*","apartments":"*","residents":"read","parking":"read","visitors":"read","complaints":"*","maintenance":"*","announcements":"read"}'::jsonb),
    ('accountant', 'Accountant / Finance officer', 60, '{"payments":"*","invoices":"*","reports":"*","residents":"read","buildings":"read","apartments":"read","accounting":"*"}'::jsonb),
    ('security', 'Security guard / Door person', 40, '{"visitors":"*","parking":"read","buildings":"read","apartments":"read","residents":"read","announcements":"read"}'::jsonb),
    ('maintenance', 'Maintenance / Repair staff', 30, '{"maintenance":"assigned","work_orders":"assigned","buildings":"read","apartments":"read","residents":"read"}'::jsonb),
    ('resident', 'Resident / Apartment owner or tenant', 10, '{"self":"read","apartment":"read","payments":"own","visitors":"own","complaints":"own","announcements":"read","documents":"own","meetings":"read","votes":"own"}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. PROFILES (1:1 with auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    register_number TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'mn',
    preferences JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- ============================================================
-- 4. ORGANIZATION_MEMBERS (M:N profiles <-> organizations with role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_profile_id ON public.organization_members(profile_id);

-- ============================================================
-- 5. BUILDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    block TEXT,
    entrance TEXT,
    floors INTEGER CHECK (floors IS NULL OR floors > 0),
    apartment_count INTEGER CHECK (apartment_count IS NULL OR apartment_count > 0),
    address TEXT,
    description TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_buildings_organization_id ON public.buildings(organization_id);
CREATE INDEX IF NOT EXISTS idx_buildings_deleted_at ON public.buildings(deleted_at);

-- ============================================================
-- 6. APARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.apartments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_number TEXT NOT NULL,
    floor INTEGER,
    area_sqm NUMERIC(10,2) CHECK (area_sqm IS NULL OR area_sqm > 0),
    room_count INTEGER CHECK (room_count IS NULL OR room_count > 0),
    status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('occupied','vacant','maintenance')),
    qr_code TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_apartments_organization_id ON public.apartments(organization_id);
CREATE INDEX IF NOT EXISTS idx_apartments_building_id ON public.apartments(building_id);
CREATE INDEX IF NOT EXISTS idx_apartments_status ON public.apartments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_org_building_number ON public.apartments(organization_id, building_id, apartment_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apartments_deleted_at ON public.apartments(deleted_at);

-- ============================================================
-- 7. RESIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    register_number TEXT,
    phone TEXT,
    email TEXT,
    emergency_contact JSONB DEFAULT '{}'::jsonb,
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'tenant' CHECK (status IN ('owner','tenant','inactive')),
    move_in_date DATE,
    move_out_date DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_residents_organization_id ON public.residents(organization_id);
CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON public.residents(apartment_id);
CREATE INDEX IF NOT EXISTS idx_residents_profile_id ON public.residents(profile_id);
CREATE INDEX IF NOT EXISTS idx_residents_status ON public.residents(status);
CREATE INDEX IF NOT EXISTS idx_residents_register_number ON public.residents(register_number);
CREATE INDEX IF NOT EXISTS idx_residents_phone ON public.residents(phone);
CREATE INDEX IF NOT EXISTS idx_residents_deleted_at ON public.residents(deleted_at);

-- ============================================================
-- 8. FAMILY_MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT,
    age INTEGER CHECK (age IS NULL OR age >= 0),
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_resident_id ON public.family_members(resident_id);

-- ============================================================
-- 9. VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    plate_number TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    color TEXT,
    is_visitor BOOLEAN NOT NULL DEFAULT FALSE,
    parking_slot_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id ON public.vehicles(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_resident_id ON public.vehicles(resident_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON public.vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles(deleted_at);

-- ============================================================
-- 10. PARKING_SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    slot_number TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'outdoor' CHECK (type IN ('indoor','outdoor','guest','reserved')),
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
    monthly_fee NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_parking_slots_organization_id ON public.parking_slots(organization_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_building_id ON public.parking_slots(building_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_type ON public.parking_slots(type);
CREATE INDEX IF NOT EXISTS idx_parking_slots_deleted_at ON public.parking_slots(deleted_at);

ALTER TABLE public.vehicles ADD CONSTRAINT fk_vehicles_parking_slot
    FOREIGN KEY (parking_slot_id) REFERENCES public.parking_slots(id) ON DELETE SET NULL;

-- ============================================================
-- 11. PARKING_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    parking_slot_id UUID REFERENCES public.parking_slots(id) ON DELETE SET NULL,
    plate_number TEXT,
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_logs_vehicle_id ON public.parking_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parking_logs_entry_time ON public.parking_logs(entry_time);
CREATE INDEX IF NOT EXISTS idx_parking_logs_exit_time ON public.parking_logs(exit_time);
