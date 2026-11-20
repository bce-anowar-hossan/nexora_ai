import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  company_id: z.string().uuid(),
  name: z.string().trim().min(2).max(160).optional(),
  objective: z.enum(["awareness","traffic","leads","sales","engagement"]).optional(),
  channel: z.enum(["facebook","instagram","google","tiktok","youtube","email","other"]).optional(),
  status: z.enum(["draft","active","paused","completed"]).optional(),
  budget: z.number().min(0).max(999999999999).optional(),
  spend: z.number().min(0).max(999999999999).optional(),
  impressions: z.number().int().min(0).max(9007199254740991).optional(),
  clicks: z.number().int().min(0).max(9007199254740991).optional(),
  conversions: z.number().int().min(0).max(9007199254740991).optional(),
  revenue: z.number().min(0).max(999999999999).optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  notes: z.string().max(5000).optional(),
}).strict();

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid campaign information.", 422, parsed.error.flatten());

  const { company_id, ...changes } = parsed.data;
  const auth = await authorizeCompany("campaigns.manage", company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  if (Object.keys(changes).length === 0) return jsonError("No changes supplied.", 422);
  if (changes.end_date && changes.start_date && changes.end_date < changes.start_date)
    return jsonError("End date cannot be before start date.", 422);

  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", auth.companyId).select("*").maybeSingle();

  if (error) return jsonError("Could not update campaign.", 400);
  if (!data) return jsonError("Campaign not found.", 404);
  return jsonSuccess(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("campaigns.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns")
    .delete().eq("id", id).eq("company_id", auth.companyId)
    .select("id").maybeSingle();

  if (error) return jsonError("Could not delete campaign.", 400);
  if (!data) return jsonError("Campaign not found.", 404);
  return jsonSuccess({ deleted: true });
}
