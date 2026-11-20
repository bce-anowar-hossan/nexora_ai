import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { jsonError, jsonSuccess } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || undefined;
  const auth = await authorizeCompany("automations.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("company_id", auth.companyId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) return jsonError("Unable to load execution history.", 500);
  return jsonSuccess(data || []);
}
