import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  objective: z.enum(["awareness","traffic","leads","sales","engagement"]).default("awareness"),
  channel: z.enum(["facebook","instagram","google","tiktok","youtube","email","other"]).default("other"),
  status: z.enum(["draft","active","paused","completed"]).default("draft"),
  budget: z.number().min(0).max(999999999999),
  spend: z.number().min(0).max(999999999999).default(0),
  impressions: z.number().int().min(0).max(9007199254740991).default(0),
  clicks: z.number().int().min(0).max(9007199254740991).default(0),
  conversions: z.number().int().min(0).max(9007199254740991).default(0),
  revenue: z.number().min(0).max(999999999999).default(0),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  notes: z.string().max(5000).default(""),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("campaigns.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns")
    .select("*").eq("company_id", auth.companyId)
    .order("created_at", { ascending: false }).limit(300);

  if (error) return jsonError("Could not load campaigns.", 500);
  return jsonSuccess(data || []);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid campaign information.", 422, parsed.error.flatten());

  const input = parsed.data;
  const auth = await authorizeCompany("campaigns.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  if (input.end_date && input.start_date && input.end_date < input.start_date)
    return jsonError("End date cannot be before start date.", 422);

  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns")
    .insert({
      ...input,
      company_id: auth.companyId,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    }).select("*").single();

  if (error) return jsonError("Could not create campaign.", 400);
  return jsonSuccess(data, 201);
}
