import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { jsonError, jsonSuccess, parseJson } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  trigger_type: z.enum(["manual", "schedule", "order_created", "customer_created"]),
  action_type: z.enum(["demo_notification", "demo_order_update", "demo_customer_tag"]),
  status: z.enum(["active", "paused"]).optional(),
});

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || undefined;
  const auth = await authorizeCompany("automations.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });

  if (error) return jsonError("Unable to load automations.", 500);
  return jsonSuccess(data || []);
}

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return parsed.response;

  const auth = await authorizeCompany("automations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .insert({
      ...parsed.data,
      status: parsed.data.status || "active",
      created_by: auth.userId,
    })
    .select("*")
    .single();

  if (error) return jsonError("Unable to create automation.", 400);
  return jsonSuccess(data, 201);
}
