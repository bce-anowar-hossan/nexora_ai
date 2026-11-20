-- DEV-009: Content and Social Management
INSERT INTO public.permissions (code)
VALUES ('content.view'), ('content.manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('owner', 'admin', 'manager')
  AND p.code IN ('content.view', 'content.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'staff'
  AND p.code = 'content.view'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','youtube','linkedin','other')),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  handle text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);

CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  social_account_id uuid,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 10000),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  media_url text CHECK (media_url IS NULL OR char_length(media_url) <= 2048),
  platform text NOT NULL DEFAULT 'other' CHECK (platform IN ('facebook','instagram','tiktok','youtube','linkedin','other')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_account_company_fk
    FOREIGN KEY (social_account_id, company_id)
    REFERENCES public.social_accounts(id, company_id)
    ON DELETE SET NULL (social_account_id)
);

CREATE INDEX IF NOT EXISTS content_items_company_updated_idx
ON public.content_items(company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS content_items_company_schedule_idx
ON public.content_items(company_id, scheduled_at);

CREATE INDEX IF NOT EXISTS social_accounts_company_idx
ON public.social_accounts(company_id, created_at DESC);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_accounts_select ON public.social_accounts;
CREATE POLICY social_accounts_select ON public.social_accounts
FOR SELECT TO authenticated
USING (public.has_company_permission(company_id, 'content.view'));

DROP POLICY IF EXISTS social_accounts_insert ON public.social_accounts;
CREATE POLICY social_accounts_insert ON public.social_accounts
FOR INSERT TO authenticated
WITH CHECK (
  public.has_company_permission(company_id, 'content.manage')
  AND (created_by IS NULL OR created_by = auth.uid())
);

DROP POLICY IF EXISTS social_accounts_update ON public.social_accounts;
CREATE POLICY social_accounts_update ON public.social_accounts
FOR UPDATE TO authenticated
USING (public.has_company_permission(company_id, 'content.manage'))
WITH CHECK (public.has_company_permission(company_id, 'content.manage'));

DROP POLICY IF EXISTS social_accounts_delete ON public.social_accounts;
CREATE POLICY social_accounts_delete ON public.social_accounts
FOR DELETE TO authenticated
USING (public.has_company_permission(company_id, 'content.manage'));

DROP POLICY IF EXISTS content_items_select ON public.content_items;
CREATE POLICY content_items_select ON public.content_items
FOR SELECT TO authenticated
USING (public.has_company_permission(company_id, 'content.view'));

DROP POLICY IF EXISTS content_items_insert ON public.content_items;
CREATE POLICY content_items_insert ON public.content_items
FOR INSERT TO authenticated
WITH CHECK (
  public.has_company_permission(company_id, 'content.manage')
  AND (created_by IS NULL OR created_by = auth.uid())
);

DROP POLICY IF EXISTS content_items_update ON public.content_items;
CREATE POLICY content_items_update ON public.content_items
FOR UPDATE TO authenticated
USING (public.has_company_permission(company_id, 'content.manage'))
WITH CHECK (public.has_company_permission(company_id, 'content.manage'));

DROP POLICY IF EXISTS content_items_delete ON public.content_items;
CREATE POLICY content_items_delete ON public.content_items
FOR DELETE TO authenticated
USING (public.has_company_permission(company_id, 'content.manage'));

REVOKE ALL ON public.social_accounts FROM anon, PUBLIC;
REVOKE ALL ON public.content_items FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
