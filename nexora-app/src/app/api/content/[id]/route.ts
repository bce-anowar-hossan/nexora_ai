import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  caption: z.string().max(10000).optional(),
  body: z.string().max(20000).optional(),
  media_url: z.union([z.string().url().max(2048), z.literal("")]).nullable().optional(),
  platform: z.enum(["facebook","instagram","tiktok","youtube","linkedin","other"]).optional(),
  social_account_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft","scheduled","published"]).optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
}).strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid content ID.", 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid content update.", 422, parsed.error.flatten());

  const input = parsed.data;
  const auth = await authorizeCompany("content.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  if (input.status === "scheduled" && !input.scheduled_at)
    return jsonError("Scheduled content requires a scheduled date and time.", 422);

  const supabase = await createClient();
  if (input.social_account_id) {
    const { data: account } = await supabase.from("social_accounts")
      .select("id").eq("id", input.social_account_id)
      .eq("company_id", auth.companyId).maybeSingle();
    if (!account) return jsonError("Social account not found in this workspace.", 404);
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["title","caption","body","media_url","platform","social_account_id","status","scheduled_at"] as const) {
    if (input[key] !== undefined) {
      update[key] = key === "media_url" || key === "social_account_id"
        ? (input[key] || null)
        : input[key];
    }
  }
  if (input.status === "draft") {
    update.scheduled_at = null;
    update.published_at = null;
  }
  if (input.status === "scheduled") update.published_at = null;
  if (input.status === "published") {
    update.published_at = new Date().toISOString();
    update.scheduled_at = null;
  }

  const { data, error } = await supabase.from("content_items")
    .update(update).eq("id", id).eq("company_id", auth.companyId)
    .select("*").maybeSingle();

  if (error) return jsonError("Could not update content.", 400);
  if (!data) return jsonError("Content not found.", 404);
  return jsonSuccess(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid content ID.", 400);

  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("content.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_items")
    .delete().eq("id", id).eq("company_id", auth.companyId)
    .select("id").maybeSingle();

  if (error) return jsonError("Could not delete content.", 400);
  if (!data) return jsonError("Content not found.", 404);
  return jsonSuccess({ deleted: true });
}
