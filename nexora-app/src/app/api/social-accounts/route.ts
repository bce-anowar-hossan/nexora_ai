import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  platform: z.enum(["facebook","instagram","tiktok","youtube","linkedin","other"]),
  display_name: z.string().trim().min(1).max(120),
  handle: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["active","inactive"]).default("active"),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("content.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("social_accounts")
    .select("*").eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });

  if (error) return jsonError("Could not load social accounts.", 500);
  return jsonSuccess(data || []);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid social account.", 422, parsed.error.flatten());

  const input = parsed.data;
  const auth = await authorizeCompany("content.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("social_accounts")
    .insert({
      company_id: auth.companyId,
      platform: input.platform,
      display_name: input.display_name,
      handle: input.handle || null,
      status: input.status,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    }).select("*").single();

  if (error) return jsonError("Could not add social account.", 400);
  return jsonSuccess(data, 201);
}

export async function DELETE(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid account ID.", 400);

  const auth = await authorizeCompany("content.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("social_accounts")
    .delete().eq("id", id).eq("company_id", auth.companyId)
    .select("id").maybeSingle();

  if (error) return jsonError("Could not remove social account.", 400);
  if (!data) return jsonError("Social account not found.", 404);
  return jsonSuccess({ deleted: true });
}
