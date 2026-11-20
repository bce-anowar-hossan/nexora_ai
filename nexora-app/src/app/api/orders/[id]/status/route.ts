import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";
import { z } from "zod";

const schema = z.object({
  company_id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "processing", "ready_to_ship", "shipped", "delivered", "cancelled", "returned"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid order ID.", 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid status request.", 422);

  const auth = await authorizeCompany("orders.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_order_status", {
    p_company_id: auth.companyId,
    p_order_id: id,
    p_new_status: parsed.data.status,
  });

  if (error) return jsonError(error.message || "Order status update failed.", 400);
  return jsonSuccess(data);
}
