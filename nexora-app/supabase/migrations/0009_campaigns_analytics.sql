-- DEV-011: Campaigns & Analytics

INSERT INTO public.permissions (code, description)
VALUES
  ('campaigns.view', 'View marketing campaigns'),
  ('campaigns.manage', 'Create and manage marketing campaigns')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions using canonical role codes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('owner', 'admin', 'manager')
  AND p.code IN ('campaigns.view', 'campaigns.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'campaigns.view'
WHERE r.code = 'staff'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  objective text NOT NULL DEFAULT 'awareness'
    CHECK (objective IN ('awareness','traffic','leads','sales','engagement')),
  channel text NOT NULL DEFAULT 'other'
    CHECK (channel IN ('facebook','instagram','google','tiktok','youtube','email','other')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed')),
  budget numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  spend numeric(14,2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  conversions bigint NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  revenue numeric(14,2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  start_date date,
  end_date date,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS campaigns_company_created_idx
ON public.campaigns(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS campaigns_company_status_idx
ON public.campaigns(company_id, status);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns
FOR SELECT TO authenticated
USING (public.has_company_permission(company_id, 'campaigns.view'));

DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
CREATE POLICY campaigns_insert ON public.campaigns
FOR INSERT TO authenticated
WITH CHECK (
  public.has_company_permission(company_id, 'campaigns.manage')
  AND (created_by IS NULL OR created_by = auth.uid())
);

DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
CREATE POLICY campaigns_update ON public.campaigns
FOR UPDATE TO authenticated
USING (public.has_company_permission(company_id, 'campaigns.manage'))
WITH CHECK (public.has_company_permission(company_id, 'campaigns.manage'));

DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
CREATE POLICY campaigns_delete ON public.campaigns
FOR DELETE TO authenticated
USING (public.has_company_permission(company_id, 'campaigns.manage'));

REVOKE ALL ON public.campaigns FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
