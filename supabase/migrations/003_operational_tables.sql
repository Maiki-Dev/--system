-- ============================================================
-- HOA / СӨХ Management Platform - Migration 003
-- Operational Tables: Visitors, Invoices, Payments, Accounting,
-- Complaints, Maintenance, Announcements, Notifications,
-- Documents, Meetings, Votes, Messages, Activity Logs
-- ============================================================

-- ============================================================
-- 12. VISITORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    visitor_name TEXT NOT NULL,
    visitor_phone TEXT,
    vehicle_plate TEXT,
    purpose TEXT,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_time TIME,
    qr_code TEXT,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','checked_in','checked_out','cancelled')),
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES public.profiles(id),
    checked_out_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitors_organization_id ON public.visitors(organization_id);
CREATE INDEX IF NOT EXISTS idx_visitors_resident_id ON public.visitors(resident_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON public.visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_visit_date ON public.visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitors_qr_code ON public.visitors(qr_code);

-- ============================================================
-- 13. VISITOR_BLACKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visitor_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    visitor_name TEXT NOT NULL,
    visitor_phone TEXT,
    reason TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_org ON public.visitor_blacklist(organization_id);

-- ============================================================
-- 14. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'hoa_fee' CHECK (type IN ('hoa_fee','parking','water','electricity','internet','cleaning','elevator','repair_fund','custom')),
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending','overdue','cancelled')),
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    period_month INTEGER,
    period_year INTEGER,
    late_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_org_number ON public.invoices(organization_id, invoice_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_apartment_id ON public.invoices(apartment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_resident_id ON public.invoices(resident_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at);

-- ============================================================
-- 15. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    amount NUMERIC(14,2) NOT NULL,
    method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer','qpay','socialpay','card','cash','qr','other')),
    transaction_id TEXT,
    qr_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending','failed','refunded')),
    reference TEXT,
    notes TEXT,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON public.payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_resident_id ON public.payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- Auto-trigger: when payment confirmed -> mark invoice paid
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid')) THEN
        UPDATE public.invoices
           SET status = 'paid',
               paid_at = COALESCE(NEW.confirmed_at, NOW()),
               updated_at = NOW()
         WHERE id = NEW.invoice_id
           AND status <> 'paid';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS on_payment_confirmed ON public.payments;
CREATE TRIGGER on_payment_confirmed
AFTER UPDATE ON public.payments
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.handle_payment_confirmed();

-- ============================================================
-- 16. ACCOUNTING CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounting_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    parent_id UUID REFERENCES public.accounting_categories(id) ON DELETE SET NULL,
    code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acct_cat_org ON public.accounting_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_acct_cat_type ON public.accounting_categories(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acct_cat_code ON public.accounting_categories(organization_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 17. ACCOUNTING TRANSACTIONS (cashbook / general ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounting_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.accounting_categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MNT',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT,
    description TEXT,
    attachment_urls JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acct_tx_org ON public.accounting_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_acct_tx_date ON public.accounting_transactions(date);
CREATE INDEX IF NOT EXISTS idx_acct_tx_type ON public.accounting_transactions(type);
CREATE INDEX IF NOT EXISTS idx_acct_tx_category ON public.accounting_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_acct_tx_deleted_at ON public.accounting_transactions(deleted_at);

-- ============================================================
-- 18. COMPLAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('cleaning','noise','parking','elevator','security','water','electricity','other')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','in_progress','resolved','closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IS NULL OR priority IN ('low','medium','high','critical')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    image_urls JSONB DEFAULT '[]'::jsonb,
    video_urls JSONB DEFAULT '[]'::jsonb,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_org ON public.complaints(organization_id);
CREATE INDEX IF NOT EXISTS idx_complaints_resident ON public.complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_deleted_at ON public.complaints(deleted_at);

-- ============================================================
-- 19. COMPLAINT COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaint_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmt_complaint ON public.complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_cmt_author ON public.complaint_comments(author_id);

-- ============================================================
-- 20. WORK ORDERS (MAINTENANCE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
    before_photo_urls JSONB DEFAULT '[]'::jsonb,
    after_photo_urls JSONB DEFAULT '[]'::jsonb,
    scheduled_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wo_org ON public.work_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_wo_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_priority ON public.work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_wo_assigned ON public.work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_wo_scheduled ON public.work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_wo_deleted_at ON public.work_orders(deleted_at);

-- ============================================================
-- 21. WORK ORDER COMMENTS / TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_order_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_woc_wo ON public.work_order_comments(work_order_id);

-- ============================================================
-- 22. ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'news' CHECK (type IN ('news','emergency','maintenance')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    image_urls JSONB DEFAULT '[]'::jsonb,
    attachment_urls JSONB DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ann_org ON public.announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_ann_type ON public.announcements(type);
CREATE INDEX IF NOT EXISTS idx_ann_pinned ON public.announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_ann_published ON public.announcements(published_at);
CREATE INDEX IF NOT EXISTS idx_ann_deleted_at ON public.announcements(deleted_at);

-- ============================================================
-- 23. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_profile ON public.notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notif_created_at ON public.notifications(created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications FOR ALL USING (profile_id = auth.uid());

-- ============================================================
-- 24. DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    folder TEXT,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doc_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_folder ON public.documents(folder);
CREATE INDEX IF NOT EXISTS idx_doc_apartment ON public.documents(apartment_id);
CREATE INDEX IF NOT EXISTS idx_doc_deleted_at ON public.documents(deleted_at);

-- ============================================================
-- 25. MEETINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    agenda TEXT,
    minutes TEXT,
    location TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_org ON public.meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_scheduled ON public.meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meeting_deleted_at ON public.meetings(deleted_at);

-- ============================================================
-- 26. MEETING ATTENDEES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meeting_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','confirmed','attended','absent')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ma_meeting ON public.meeting_attendees(meeting_id);

-- ============================================================
-- 27. VOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'yes_no' CHECK (type IN ('yes_no','multiple_choice')),
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_org ON public.votes(organization_id);
CREATE INDEX IF NOT EXISTS idx_votes_meeting ON public.votes(meeting_id);

-- ============================================================
-- 28. VOTE RESPONSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vote_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id UUID NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    selected_option TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vote_id, profile_id, resident_id)
);

CREATE INDEX IF NOT EXISTS idx_vr_vote ON public.vote_responses(vote_id);

-- ============================================================
-- 29. MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    conversation_id UUID,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    attachment_urls JSONB DEFAULT '[]'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_org ON public.messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_msg_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_msg_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_msg_created_at ON public.messages(created_at);

-- ============================================================
-- 30. ACTIVITY LOGS (AUDIT)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_org ON public.activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_log_profile ON public.activity_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_log_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_log_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_log_created_at ON public.activity_logs(created_at);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS logs_org_admin ON public.activity_logs;
CREATE POLICY logs_org_admin ON public.activity_logs FOR SELECT USING (
    public.is_super_admin()
    OR (public.current_user_role_rank() >= 90
        AND organization_id = public.current_user_organization_id())
);

-- ============================================================
-- RLS FOR MIGRATION 003 TABLES
-- ============================================================

-- VISITORS
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visitors_select ON public.visitors;
CREATE POLICY visitors_select ON public.visitors FOR SELECT USING (
    public.is_super_admin()
    OR public.current_user_role_rank() >= 40
    OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
);
DROP POLICY IF EXISTS visitors_write ON public.visitors;
CREATE POLICY visitors_write ON public.visitors FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 40
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 40)
    AND organization_id = public.current_user_organization_id()
);

-- BLACKLIST
ALTER TABLE public.visitor_blacklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bl_org ON public.visitor_blacklist;
CREATE POLICY bl_org ON public.visitor_blacklist FOR ALL USING (
    public.is_super_admin()
    OR (public.current_user_role_rank() >= 40 AND organization_id = public.current_user_organization_id())
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 40)
    AND organization_id = public.current_user_organization_id()
);

-- INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT USING (
    public.is_super_admin()
    OR public.current_user_role_rank() >= 60
    OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
    OR apartment_id IN (SELECT r.apartment_id FROM public.residents r WHERE r.profile_id = auth.uid())
);
DROP POLICY IF EXISTS invoices_write ON public.invoices;
CREATE POLICY invoices_write ON public.invoices FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 60
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 60)
    AND organization_id = public.current_user_organization_id()
);

-- PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT USING (
    public.is_super_admin()
    OR public.current_user_role_rank() >= 60
    OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
);
DROP POLICY IF EXISTS payments_write ON public.payments;
CREATE POLICY payments_write ON public.payments FOR INSERT WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 60)
    AND organization_id = public.current_user_organization_id()
);
DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_update ON public.payments FOR UPDATE USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 60
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 60)
    AND organization_id = public.current_user_organization_id()
);

-- ACCOUNTING CATEGORIES + TRANSACTIONS
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acct_cat_org ON public.accounting_categories;
CREATE POLICY acct_cat_org ON public.accounting_categories FOR ALL USING (
    public.is_super_admin()
    OR (public.current_user_role_rank() >= 60 AND organization_id = public.current_user_organization_id())
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 60)
    AND organization_id = public.current_user_organization_id()
);

ALTER TABLE public.accounting_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acct_tx_org ON public.accounting_transactions;
CREATE POLICY acct_tx_org ON public.accounting_transactions FOR SELECT USING (
    public.is_super_admin()
    OR (public.current_user_role_rank() >= 60 AND organization_id = public.current_user_organization_id())
);
DROP POLICY IF EXISTS acct_tx_write ON public.accounting_transactions;
CREATE POLICY acct_tx_write ON public.accounting_transactions FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 60
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 60)
    AND organization_id = public.current_user_organization_id()
);

-- COMPLAINTS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS complaints_select ON public.complaints;
CREATE POLICY complaints_select ON public.complaints FOR SELECT USING (
    public.is_super_admin()
    OR public.current_user_role_rank() >= 30
    OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
);
DROP POLICY IF EXISTS complaints_write ON public.complaints;
CREATE POLICY complaints_write ON public.complaints FOR ALL USING (
    public.is_super_admin()
    OR public.current_user_role_rank() >= 30
    OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
) WITH CHECK (
    organization_id = public.current_user_organization_id()
);

ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cmt_complaint ON public.complaint_comments;
CREATE POLICY cmt_complaint ON public.complaint_comments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_comments.complaint_id
          AND (
              public.is_super_admin()
              OR public.current_user_role_rank() >= 30
              OR c.resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
          )
    )
);

-- WORK ORDERS
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wo_select ON public.work_orders;
CREATE POLICY wo_select ON public.work_orders FOR SELECT USING (
    public.is_super_admin()
    OR public.current_user_role_rank() >= 30
    OR assigned_to = auth.uid()
    OR apartment_id IN (SELECT r.apartment_id FROM public.residents r WHERE r.profile_id = auth.uid())
);
DROP POLICY IF EXISTS wo_write ON public.work_orders;
CREATE POLICY wo_write ON public.work_orders FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 30
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 30)
    AND organization_id = public.current_user_organization_id()
);

ALTER TABLE public.work_order_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS woc_wo ON public.work_order_comments;
CREATE POLICY woc_wo ON public.work_order_comments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.work_orders w
        WHERE w.id = work_order_comments.work_order_id
          AND (
              public.is_super_admin()
              OR public.current_user_role_rank() >= 30
              OR w.assigned_to = auth.uid()
          )
    )
);

-- ANNOUNCEMENTS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ann_select ON public.announcements;
CREATE POLICY ann_select ON public.announcements FOR SELECT USING (
    public.is_super_admin()
    OR (organization_id = public.current_user_organization_id()
        AND (published_at IS NOT NULL AND published_at <= NOW() OR public.current_user_role_rank() >= 70))
);
DROP POLICY IF EXISTS ann_write ON public.announcements;
CREATE POLICY ann_write ON public.announcements FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- DOCUMENTS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doc_select ON public.documents;
CREATE POLICY doc_select ON public.documents FOR SELECT USING (
    public.is_super_admin()
    OR (public.current_user_role_rank() >= 30 AND organization_id = public.current_user_organization_id())
    OR apartment_id IN (SELECT r.apartment_id FROM public.residents r WHERE r.profile_id = auth.uid())
);
DROP POLICY IF EXISTS doc_write ON public.documents;
CREATE POLICY doc_write ON public.documents FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 70
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 70)
    AND organization_id = public.current_user_organization_id()
);

-- MEETINGS / ATTENDEES / VOTES
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meetings_select ON public.meetings;
CREATE POLICY meetings_select ON public.meetings FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_organization_id()
);
DROP POLICY IF EXISTS meetings_write ON public.meetings;
CREATE POLICY meetings_write ON public.meetings FOR ALL USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 90
) WITH CHECK (
    (public.is_super_admin() OR public.current_user_role_rank() >= 90)
    AND organization_id = public.current_user_organization_id()
);

ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ma_meeting ON public.meeting_attendees;
CREATE POLICY ma_meeting ON public.meeting_attendees FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id = meeting_attendees.meeting_id
          AND (public.is_super_admin() OR m.organization_id = public.current_user_organization_id())
    )
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
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

ALTER TABLE public.vote_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vr_vote ON public.vote_responses;
CREATE POLICY vr_vote ON public.vote_responses FOR SELECT USING (
    public.is_super_admin() OR public.current_user_role_rank() >= 90
    OR profile_id = auth.uid()
);
DROP POLICY IF EXISTS vr_insert ON public.vote_responses;
CREATE POLICY vr_insert ON public.vote_responses FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR resident_id IN (SELECT r.id FROM public.residents r WHERE r.profile_id = auth.uid())
);

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS msg_org ON public.messages;
CREATE POLICY msg_org ON public.messages FOR SELECT USING (
    public.is_super_admin()
    OR (organization_id = public.current_user_organization_id()
        AND (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.current_user_role_rank() >= 70))
);
DROP POLICY IF EXISTS msg_insert ON public.messages;
CREATE POLICY msg_insert ON public.messages FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND organization_id = public.current_user_organization_id()
);
