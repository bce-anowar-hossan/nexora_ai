import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("analytics.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const tenantId = auth.companyId;

  const [orders, customers, campaigns] = await Promise.all([
    supabase.from("orders")
      .select("id,total,status,created_at")
      .eq("company_id", tenantId)
      .order("created_at", { ascending: false }).limit(5000),
    supabase.from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", tenantId),
    supabase.from("campaigns")
      .select("id,status,budget,spend,impressions,clicks,conversions,revenue")
      .eq("company_id", tenantId),
  ]);

  if (orders.error || customers.error || campaigns.error) {
    console.error("Analytics query failed:", orders.error || customers.error || campaigns.error);
    return jsonError("Analytics data could not be loaded.", 500);
  }

  const rows = orders.data || [];
  const delivered = rows.filter(row => row.status === "delivered");
  const campaignRows = campaigns.data || [];
  const now = new Date();

  const daily = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dayOrders = delivered.filter(row => {
      const date = new Date(row.created_at);
      return date >= day && date < next;
    });
    return {
      date: day.toISOString().slice(0, 10),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, row) => sum + Number(row.total || 0), 0),
    };
  });

  const statuses: Record<string, number> = {};
  for (const row of rows) statuses[row.status] = (statuses[row.status] || 0) + 1;

  return jsonSuccess({
    metrics: {
      totalOrders: rows.length,
      totalCustomers: customers.count || 0,
      deliveredOrders: delivered.length,
      totalRevenue: delivered.reduce((sum, row) => sum + Number(row.total || 0), 0),
      campaignCount: campaignRows.length,
      activeCampaigns: campaignRows.filter(row => row.status === "active").length,
      campaignBudget: campaignRows.reduce((sum, row) => sum + Number(row.budget || 0), 0),
      campaignSpend: campaignRows.reduce((sum, row) => sum + Number(row.spend || 0), 0),
      campaignRevenue: campaignRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
      impressions: campaignRows.reduce((sum, row) => sum + Number(row.impressions || 0), 0),
      clicks: campaignRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0),
      conversions: campaignRows.reduce((sum, row) => sum + Number(row.conversions || 0), 0),
    },
    daily,
    orderStatuses: Object.entries(statuses).map(([status, count]) => ({ status, count })),
    campaigns: campaignRows,
  });
}
