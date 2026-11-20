import { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess, parseJson } from "@/lib/server/http";

const schema = z.object({
  company_id: z.string().uuid(),
  payment_status: z.enum(["unpaid", "partial", "paid", "refunded"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = await parseJson(request, schema);
  if (!parsed.success) {
    return jsonError("Invalid payment update.", 400);
  }

  const auth = await authorizeCompany(
    "orders.manage",
    parsed.data.company_id
  );
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();

  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id,status,payment_status")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .single();

  if (findError || !order) {
    return jsonError("Order not found.", 404);
  }

  if (order.status === "cancelled" && parsed.data.payment_status !== "refunded") {
    return jsonError("Cancelled orders can only be marked refunded.", 400);
  }

  if (order.payment_status === "refunded" && parsed.data.payment_status !== "refunded") {
    return jsonError("Refunded payment cannot be changed.", 400);
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: parsed.data.payment_status })
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id,order_number,payment_status")
    .single();

  if (error) {
    return jsonError("Payment status could not be updated.", 500);
  }

  return jsonSuccess({ order: data });
}
