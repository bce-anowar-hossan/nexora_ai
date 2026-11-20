import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  caption: z.string().max(10000).default(""),
  body: z.string().max(20000).default(""),
  media_url: z.union([z.string().url().max(2048), z.literal("")]).nullable().optional(),
  platform: z.enum(["facebook","instagram","tiktok","youtube","linkedin","other"]).default("other"),
  social_account_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft","scheduled","published"]).default("draft"),
  scheduled_at: z.string().datetime().nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("content.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_items")
    .select("*").eq("company_id", auth.companyId)
    .order("updated_at", { ascending: false }).limit(300);

  if (error) return jsonError("Could not load content.", 500);
  return jsonSuccess(data || []);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid content information.", 422, parsed.error.flatten());

  const input = parsed.data;
  const auth = await authorizeCompany("content.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  if (input.status === "scheduled" && !input.scheduled_at)
    return jsonError("Scheduled content requires a scheduled date and time.", 422);

  if (input.status === "published" && !input.scheduled_at) {
    // Immediate demo publishing is allowed; published_at is set below.
  }

  const supabase = await createClient();

  if (input.social_account_id) {
    const { data: account, error } = await supabase.from("social_accounts")
      .select("id").eq("id", input.social_account_id)
      .eq("company_id", auth.companyId).maybeSingle();
    if (error || !account) return jsonError("Social account not found in this workspace.", 404);
  }

  const now = new Date().toISOString();
  const values = {
    company_id: auth.companyId,
    title: input.title,
    caption: input.caption,
    body: input.body,
    media_url: input.media_url || null,
    platform: input.platform,
    social_account_id: input.social_account_id || null,
    status: input.status,
    scheduled_at: input.status === "scheduled" ? input.scheduled_at : null,
    published_at: input.status === "published" ? now : null,
    created_by: auth.userId,
    updated_at: now,
  };

  const { data, error } = await supabase.from("content_items")
    .insert(values).select("*").single();

  if (error) return jsonError("Could not create content.", 400);
  return jsonSuccess(data, 201);
}
