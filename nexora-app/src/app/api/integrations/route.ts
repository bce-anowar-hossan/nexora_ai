import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const providers = [
  "shopify", "woocommerce", "facebook", "instagram",
  "google_ads", "stripe", "whatsapp", "slack",
] as const;

const schema = z.object({
  company_id: z.string().uuid(),
  provider: z.enum(providers),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("integrations.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_integrations")
    .select("id,company_id,provider,status,connection_mode,settings,created_at,updated_at")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });

  if (error) return jsonError("Could not load integrations.", 500);
  return jsonSuccess(data || []);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid integration information.", 422);
  }

  const auth = await authorizeCompany("integrations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_integrations")
    .insert({
      company_id: auth.companyId,
      provider: parsed.data.provider,
      status: "connected",
      connection_mode: "demo",
      settings: { demo: true },
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select("id,company_id,provider,status,connection_mode,settings,created_at,updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("This integration is already registered.", 409);
    }
    return jsonError("Could not register integration.", 400);
  }

  return jsonSuccess(data, 201);
}
