import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const createSchema = z.object({
  company_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  customer_id: z.string().uuid().nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("conversations.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,company_id,customer_id,title,status,created_at,updated_at")
    .eq("company_id", auth.companyId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return jsonError("Could not load conversations.", 500);
  return jsonSuccess(data || []);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid conversation information.", 422, parsed.error.flatten());
  }

  const auth = await authorizeCompany("conversations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();

  if (parsed.data.customer_id) {
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customer_id)
      .eq("company_id", auth.companyId)
      .maybeSingle();

    if (error || !customer) return jsonError("Customer not found in this workspace.", 404);
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      company_id: auth.companyId,
      customer_id: parsed.data.customer_id || null,
      title: parsed.data.title || "New conversation",
      created_by: auth.userId,
    })
    .select("id,company_id,customer_id,title,status,created_at,updated_at")
    .single();

  if (error) return jsonError("Could not create conversation.", 400);
  return jsonSuccess(data, 201);
}
