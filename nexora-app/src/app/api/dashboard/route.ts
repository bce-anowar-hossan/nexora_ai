import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";

  const [analytics, ordersPermission, customersPermission] = await Promise.all([
    authorizeCompany("analytics.view", companyId),
    authorizeCompany("orders.view", companyId),
    authorizeCompany("customers.view", companyId),
  ]);

  if (!analytics.ok) return jsonError(analytics.error, analytics.status);
  if (!ordersPermission.ok) return jsonError(ordersPermission.error, ordersPermission.status);
  if (!customersPermission.ok) return jsonError(customersPermission.error, customersPermission.status);

  const supabase = await createClient();
  const tenantId = analytics.companyId;

  const [
    customers,
    orderCount,
    pending,
    delivered,
    recent,
    activity,
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", tenantId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("company_id", tenantId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("company_id", tenantId).eq("status", "pending"),
    supabase.from("orders").select("id,total", { count: "exact" }).eq("company_id", tenantId).eq("status", "delivered"),
    supabase.from("orders").select("id,order_number,status,total,created_at,customer_id").eq("company_id", tenantId).order("created_at", { ascending: false }).limit(5),
    supabase.from("audit_logs").select("id,action,table_name,record_id,created_at").eq("company_id", tenantId).order("created_at", { ascending: false }).limit(5),
  ]);

  const queryErrors = [
    ["customers", customers.error],
    ["orderCount", orderCount.error],
    ["pending", pending.error],
    ["delivered", delivered.error],
    ["recent", recent.error],
  ].filter(([, error]) => error);

  if (queryErrors.length > 0) {
    console.error("Dashboard query errors:", queryErrors);
    const details = process.env.NODE_ENV === "development"
      ? queryErrors.map(([query, error]) => ({
          query,
          code: typeof error === "object" && error !== null && "code" in error ? error.code : null,
          message: typeof error === "object" && error !== null && "message" in error ? error.message : String(error),
        }))
      : undefined;

    return jsonError("Dashboard data could not be loaded.", 500, details);
  }

  const rows = recent.data || [];
  const orderIds = rows.map((row) => row.id);
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];

  const [items, customerDetails] = await Promise.all([
    orderIds.length
      ? supabase.from("order_items").select("order_id,product_name,quantity").eq("company_id", tenantId).in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase.from("customers").select("id,name").eq("company_id", tenantId).in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (items.error || customerDetails.error) {
    return jsonError("Recent order details could not be loaded.", 500);
  }

  const customerMap = new Map((customerDetails.data || []).map((row) => [row.id, row.name]));
  const itemsMap = new Map<string, Array<{ product_name: string; quantity: number }>>();

  for (const item of items.data || []) {
    const current = itemsMap.get(item.order_id) || [];
    current.push({ product_name: item.product_name, quantity: item.quantity });
    itemsMap.set(item.order_id, current);
  }

  const deliveredRows = delivered.data || [];

  return jsonSuccess({
    metrics: {
      totalRevenue: deliveredRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
      totalOrders: orderCount.count || 0,
      totalCustomers: customers.count || 0,
      pendingOrders: pending.count || 0,
      deliveredOrders: delivered.count || 0,
      aiConversations: null,
    },
    recentOrders: rows.map((row) => ({
      ...row,
      customer: customerMap.has(row.customer_id) ? { name: customerMap.get(row.customer_id) } : null,
      items: itemsMap.get(row.id) || [],
    })),
    recentActivity: activity.error ? [] : activity.data || [],
  });
}
