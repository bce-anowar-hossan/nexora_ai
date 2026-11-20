import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CompanyPermission =
  | "analytics.view"
  | "automations.view"
  | "automations.manage"
  | "company.view"
  | "company.update"
  | "company.delete"
  | "campaigns.view"
  | "campaigns.manage"
  | "billing.view"
  | "billing.manage"
  | "customers.view"
  | "customers.manage"
  | "conversations.view"
  | "conversations.manage"
  | "content.view"
  | "content.manage"
  | "integrations.view"
  | "integrations.manage"
  | "members.view"
  | "members.invite"
  | "members.manage"
  | "orders.view"
  | "orders.manage"
  | "products.view"
  | "products.manage"
  | "roles.view"
  | "roles.manage";

type AuthorizationSuccess = {
  ok: true;
  userId: string;
  companyId: string;
};

type AuthorizationFailure = {
  ok: false;
  status: 401 | 403 | 409;
  error: string;
};

export type AuthorizationResult =
  | AuthorizationSuccess
  | AuthorizationFailure;

/**
 * Resolves the current user's active company membership and verifies
 * the requested permission on the server.
 *
 * If the user belongs to multiple companies, callers must provide
 * an explicit companyId. This avoids silently choosing the wrong tenant.
 */
export async function authorizeCompany(
  permission: CompanyPermission,
  requestedCompanyId?: string
): Promise<AuthorizationResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  let companyId = requestedCompanyId;

  if (companyId) {
    const { data: membership, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (error || !membership) {
      return {
        ok: false,
        status: 403,
        error: "Active company membership required.",
      };
    }
  } else {
    const { data: memberships, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(2);

    if (error) {
      return {
        ok: false,
        status: 403,
        error: "Unable to verify company membership.",
      };
    }

    if (!memberships || memberships.length === 0) {
      return {
        ok: false,
        status: 403,
        error: "Active company membership required.",
      };
    }

    if (memberships.length > 1) {
      return {
        ok: false,
        status: 409,
        error: "Specify a company to continue.",
      };
    }

    companyId = memberships[0].company_id;
  }

  if (!companyId) {
    return {
      ok: false,
      status: 403,
      error: "Company could not be resolved.",
    };
  }

  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_company_permission",
    {
      p_company_id: companyId,
      p_permission: permission,
    }
  );

  if (permissionError || allowed !== true) {
    return {
      ok: false,
      status: 403,
      error: "You do not have permission to perform this action.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    companyId,
  };
}
