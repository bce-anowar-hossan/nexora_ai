import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";
import { generateDemoReply } from "@/lib/server/demo-ai";

const schema = z.object({
  company_id: z.string().uuid(),
  content: z.string().trim().min(1).max(12000),
}).strict();

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid conversation ID.", 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid message.", 422, parsed.error.flatten());

  const auth = await authorizeCompany("conversations.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,status")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (conversationError) return jsonError("Could not verify conversation.", 500);
  if (!conversation) return jsonError("Conversation not found.", 404);
  if (conversation.status !== "open") return jsonError("এই conversation বন্ধ আছে। আগে reopen করুন।", 409);

  const { data: userMessage, error: userError } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: id,
      company_id: auth.companyId,
      role: "user",
      content: parsed.data.content,
    })
    .select("id,role,content,created_at")
    .single();

  if (userError) return jsonError("Could not save your message.", 400);

  const reply = generateDemoReply(parsed.data.content);
  const { data: assistantMessage, error: assistantError } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: id,
      company_id: auth.companyId,
      role: "assistant",
      content: reply,
    })
    .select("id,role,content,created_at")
    .single();

  if (assistantError) {
    return jsonError("Your message was saved, but the demo reply could not be saved. Please reload the conversation.", 500);
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", auth.companyId);

  if (updateError) return jsonError("Messages saved, but conversation timestamp could not be updated.", 500);

  return jsonSuccess({ userMessage, assistantMessage }, 201);
}
