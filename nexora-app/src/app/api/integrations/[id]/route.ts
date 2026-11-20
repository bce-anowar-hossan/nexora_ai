import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  company_id: z.string().uuid(),
  status: z.enum(["connected", "disconnected"]),
}).strict();

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid integration update.", 422);

  const auth = await authorizeCompany("integrations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_integrations")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id,provider,status,connection_mode,updated_at")
    .maybeSingle();

  if (error) return jsonError("Could not update integration.", 400);
  if (!data) return jsonError("Integration not found.", 404);

  return jsonSuccess(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const companyId = request.nextUrl.searchParams.get("company_id") || "";

  const auth = await authorizeCompany("integrations.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_integrations")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id")
    .maybeSingle();

  if (error) return jsonError("Could not delete integration.", 400);
  if (!data) return jsonError("Integration not found.", 404);

  return jsonSuccess({ deleted: true });
}
