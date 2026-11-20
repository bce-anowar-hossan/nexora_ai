-- DEV-012: Secure Integration Registry

INSERT INTO public.permissions (code, description)
VALUES
  ('integrations.view', 'View company integrations'),
  ('integrations.manage', 'Manage company integrations')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('owner', 'admin', 'manager')
  AND p.code IN ('integrations.view', 'integrations.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'integrations.view'
WHERE r.code = 'staff'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.company_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (
    provider IN (
      'shopify', 'woocommerce', 'facebook', 'instagram',
      'google_ads', 'stripe', 'whatsapp', 'slack'
    )
  ),
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected')),
  connection_mode text NOT NULL DEFAULT 'demo'
    CHECK (connection_mode IN ('demo')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider),
  UNIQUE (id, company_id)
);

CREATE INDEX IF NOT EXISTS company_integrations_company_idx
ON public.company_integrations(company_id, created_at DESC);

ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_integrations_select ON public.company_integrations;
CREATE POLICY company_integrations_select
ON public.company_integrations
FOR SELECT TO authenticated
USING (
  public.has_company_permission(company_id, 'integrations.view')
);

DROP POLICY IF EXISTS company_integrations_insert ON public.company_integrations;
CREATE POLICY company_integrations_insert
ON public.company_integrations
FOR INSERT TO authenticated
WITH CHECK (
  public.has_company_permission(company_id, 'integrations.manage')
);

DROP POLICY IF EXISTS company_integrations_update ON public.company_integrations;
CREATE POLICY company_integrations_update
ON public.company_integrations
FOR UPDATE TO authenticated
USING (
  public.has_company_permission(company_id, 'integrations.manage')
)
WITH CHECK (
  public.has_company_permission(company_id, 'integrations.manage')
);

DROP POLICY IF EXISTS company_integrations_delete ON public.company_integrations;
CREATE POLICY company_integrations_delete
ON public.company_integrations
FOR DELETE TO authenticated
USING (
  public.has_company_permission(company_id, 'integrations.manage')
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.company_integrations TO authenticated;
