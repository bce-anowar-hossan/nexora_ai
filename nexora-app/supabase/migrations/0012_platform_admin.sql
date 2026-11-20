-- DEV-014: Secure platform-level administration

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_workspaces',
      (SELECT count(*) FROM public.companies),
    'total_users',
      (SELECT count(*) FROM auth.users),
    'total_subscriptions',
      (SELECT count(*) FROM public.company_subscriptions),
    'active_subscriptions',
      (SELECT count(*) FROM public.company_subscriptions WHERE status = 'active'),
    'simulated_payments',
      (SELECT count(*) FROM public.billing_payments),
    'simulated_revenue',
      (SELECT coalesce(sum(amount), 0) FROM public.billing_payments),
    'plans',
      (SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'code', p.code,
          'name', p.name,
          'price_monthly', p.price_monthly,
          'active', p.is_active
        ) ORDER BY p.price_monthly
      ), '[]'::jsonb) FROM public.billing_plans p)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_admin_workspaces()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access required';
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      c.created_at,
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'owner_id', c.owner_id,
        'owner_name', p.full_name,
        'created_at', c.created_at,
        'plan_code', bp.code,
        'plan_name', bp.name,
        'subscription_status', cs.status
      ) AS row_data
    FROM public.companies c
    LEFT JOIN public.profiles p ON p.id = c.owner_id
    LEFT JOIN public.company_subscriptions cs ON cs.company_id = c.id
    LEFT JOIN public.billing_plans bp ON bp.id = cs.plan_id
  ) workspaces;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_dashboard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_admin_workspaces() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_workspaces() TO authenticated;
