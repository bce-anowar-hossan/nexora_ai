import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { jsonError, jsonSuccess, parseJson } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  trigger_type: z.enum(["manual", "schedule", "order_created", "customer_created"]).optional(),
  action_type: z.enum(["demo_notification", "demo_order_update", "demo_customer_tag"]).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return parsed.response;

  const auth = await authorizeCompany("automations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([key]) => key !== "company_id")
  );
  if (Object.keys(updates).length === 0) return jsonError("No changes provided.", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("*")
    .single();

  if (error || !data) return jsonError("Automation not found or update failed.", 404);
  return jsonSuccess(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const companyId = request.nextUrl.searchParams.get("company_id") || undefined;
  const auth = await authorizeCompany("automations.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.companyId);

  if (error) return jsonError("Unable to delete automation.", 400);
  return jsonSuccess({ deleted: true });
}
