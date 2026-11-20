-- DEV-013: Billing, subscriptions, usage tracking and demo payments

INSERT INTO public.permissions (code, description)
VALUES
  ('billing.view', 'View workspace billing and usage'),
  ('billing.manage', 'Manage workspace subscription and demo billing')
ON CONFLICT (code) DO NOTHING;

-- Billing viewers: all workspace roles.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.code = 'billing.view'
  AND r.code IN ('owner', 'admin', 'manager', 'staff')
ON CONFLICT DO NOTHING;

-- Only owners and admins can change subscriptions.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.code = 'billing.manage'
  AND r.code IN ('owner', 'admin')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code IN ('free', 'pro', 'business')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_monthly numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  currency text NOT NULL DEFAULT 'BDT',
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_plans (code, name, description, price_monthly, limits, features)
VALUES
(
  'free', 'Free', 'Get started with essential workspace tools.',
  0,
  '{"products":50,"orders":100,"ai_messages":50,"team_members":2,"campaigns":3}'::jsonb,
  '["Basic workspace","Products and orders","Basic analytics"]'::jsonb
),
(
  'pro', 'Pro', 'More capacity for growing teams.',
  1990,
  '{"products":1000,"orders":5000,"ai_messages":2000,"team_members":10,"campaigns":50}'::jsonb,
  '["Everything in Free","Advanced analytics","More automations","Priority workspace limits"]'::jsonb
),
(
  'business', 'Business', 'Higher limits for established businesses.',
  4990,
  '{"products":10000,"orders":50000,"ai_messages":10000,"team_members":50,"campaigns":500}'::jsonb,
  '["Everything in Pro","Higher usage limits","Larger team","Expanded campaign capacity"]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'past_due')),
  billing_mode text NOT NULL DEFAULT 'demo'
    CHECK (billing_mode = 'demo'),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Existing workspaces receive the Free plan.
INSERT INTO public.company_subscriptions (company_id, plan_id)
SELECT c.id, p.id
FROM public.companies c
CROSS JOIN public.billing_plans p
WHERE p.code = 'free'
ON CONFLICT (company_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.billing_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (
    metric IN ('products', 'orders', 'ai_messages', 'campaigns')
  ),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 10000),
  source text NOT NULL DEFAULT 'demo',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_usage_company_date_idx
ON public.billing_usage_events(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'BDT',
  provider text NOT NULL DEFAULT 'demo' CHECK (provider = 'demo'),
  status text NOT NULL DEFAULT 'simulated' CHECK (status = 'simulated'),
  description text NOT NULL DEFAULT 'Demo subscription payment',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_payments_company_date_idx
ON public.billing_payments(company_id, created_at DESC);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_plans_select ON public.billing_plans;
CREATE POLICY billing_plans_select ON public.billing_plans
FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS company_subscriptions_select ON public.company_subscriptions;
CREATE POLICY company_subscriptions_select ON public.company_subscriptions
FOR SELECT TO authenticated
USING (public.has_company_permission(company_id, 'billing.view'));

DROP POLICY IF EXISTS company_subscriptions_insert ON public.company_subscriptions;
CREATE POLICY company_subscriptions_insert ON public.company_subscriptions
FOR INSERT TO authenticated
WITH CHECK (public.has_company_permission(company_id, 'billing.manage'));

DROP POLICY IF EXISTS company_subscriptions_update ON public.company_subscriptions;
CREATE POLICY company_subscriptions_update ON public.company_subscriptions
FOR UPDATE TO authenticated
USING (public.has_company_permission(company_id, 'billing.manage'))
WITH CHECK (public.has_company_permission(company_id, 'billing.manage'));

DROP POLICY IF EXISTS billing_usage_select ON public.billing_usage_events;
CREATE POLICY billing_usage_select ON public.billing_usage_events
FOR SELECT TO authenticated
USING (public.has_company_permission(company_id, 'billing.view'));

DROP POLICY IF EXISTS billing_usage_insert ON public.billing_usage_events;
CREATE POLICY billing_usage_insert ON public.billing_usage_events
FOR INSERT TO authenticated
WITH CHECK (public.has_company_permission(company_id, 'billing.manage'));

DROP POLICY IF EXISTS billing_payments_select ON public.billing_payments;
CREATE POLICY billing_payments_select ON public.billing_payments
FOR SELECT TO authenticated
USING (public.has_company_permission(company_id, 'billing.view'));

DROP POLICY IF EXISTS billing_payments_insert ON public.billing_payments;
CREATE POLICY billing_payments_insert ON public.billing_payments
FOR INSERT TO authenticated
WITH CHECK (public.has_company_permission(company_id, 'billing.manage'));

GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_subscriptions TO authenticated;
GRANT SELECT, INSERT ON public.billing_usage_events TO authenticated;
GRANT SELECT, INSERT ON public.billing_payments TO authenticated;
