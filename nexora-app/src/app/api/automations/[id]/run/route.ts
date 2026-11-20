import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { jsonError, jsonSuccess } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  let companyId: string | undefined;

  try {
    const body = await request.json();
    if (typeof body.company_id === "string") companyId = body.company_id;
  } catch {
    return jsonError("Invalid JSON request body.", 400);
  }

  const auth = await authorizeCompany("automations.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data: automation, error: lookupError } = await supabase
    .from("automations")
    .select("id,title,action_type,status")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (lookupError || !automation) return jsonError("Automation not found.", 404);
  if (automation.status !== "active") return jsonError("Activate this automation before running it.", 409);

  const result = {
    mode: "demo",
    message: `Demo action "${automation.action_type}" completed for "${automation.title}". No external action was performed.`,
  };

  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      company_id: auth.companyId,
      automation_id: automation.id,
      status: "success",
      result,
      finished_at: new Date().toISOString(),
      created_by: auth.userId,
    })
    .select("*")
    .single();

  if (error) return jsonError("Unable to save execution log.", 500);
  return jsonSuccess(data);
}
