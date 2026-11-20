import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const companyId = request.nextUrl.searchParams.get("company_id") || "";

  const auth = await authorizeCompany("customers.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .single();

  if (error || !customer) {
    return jsonError("Customer not found.", 404);
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id, order_number, status, subtotal, discount,
      delivery_fee, total, payment_method, payment_status,
      created_at, updated_at
    `)
    .eq("company_id", auth.companyId)
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  if (ordersError) {
    return jsonError("Order history could not be loaded.", 500);
  }

  return jsonSuccess({
    customer,
    orders: orders || [],
    orderCount: orders?.length || 0,
    totalSpent: (orders || [])
      .filter((order) => order.status === "delivered")
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
  });
}
