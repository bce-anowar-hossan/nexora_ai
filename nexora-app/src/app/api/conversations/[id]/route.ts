import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

const paramsSchema = z.string().uuid();
const patchSchema = z.object({
  company_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "closed"]).optional(),
}).strict().refine(v => v.title !== undefined || v.status !== undefined);

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!paramsSchema.safeParse(id).success) return jsonError("Invalid conversation ID.", 400);

  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("conversations.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id,company_id,customer_id,title,status,created_at,updated_at")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (error) return jsonError("Could not load conversation.", 500);
  if (!conversation) return jsonError("Conversation not found.", 404);

  const { data: messages, error: messageError } = await supabase
    .from("conversation_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", id)
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (messageError) return jsonError("Could not load messages.", 500);
  return jsonSuccess({ conversation, messages: messages || [] });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!paramsSchema.safeParse(id).success) return jsonError("Invalid conversation ID.", 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid update.", 422);

  const auth = await authorizeCompany("conversations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const update: { title?: string; status?: "open" | "closed"; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data, error } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id,title,status,updated_at")
    .maybeSingle();

  if (error) return jsonError("Could not update conversation.", 400);
  if (!data) return jsonError("Conversation not found.", 404);
  return jsonSuccess(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!paramsSchema.safeParse(id).success) return jsonError("Invalid conversation ID.", 400);

  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("conversations.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id")
    .maybeSingle();

  if (error) return jsonError("Could not delete conversation.", 400);
  if (!data) return jsonError("Conversation not found.", 404);
  return jsonSuccess({ deleted: true });
}
