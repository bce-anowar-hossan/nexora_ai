import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";


const requestSchema = z.object({
  action: z.enum(["change_plan", "record_usage"]),
  companyId: z.string().uuid().optional(),
  planCode: z.enum(["free", "pro", "business"]).optional(),
  metric: z.enum(["products", "orders", "ai_messages", "campaigns"]).optional(),
  quantity: z.number().int().min(1).max(10000).optional(),
});

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId") || undefined;
  const auth = await authorizeCompany("billing.view", companyId);

  if (!auth.ok) return fail(auth.error, auth.status);

  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [plansResult, subscriptionResult, usageResult, paymentsResult] =
    await Promise.all([
      supabase.from("billing_plans").select("*").eq("is_active", true).order("price_monthly"),
      supabase
        .from("company_subscriptions")
        .select("*, plan:billing_plans(*)")
        .eq("company_id", auth.companyId)
        .maybeSingle(),
      supabase
        .from("billing_usage_events")
        .select("metric, quantity, created_at")
        .eq("company_id", auth.companyId)
        .gte("created_at", since),
      supabase
        .from("billing_payments")
        .select("id, amount, currency, status, description, created_at")
        .eq("company_id", auth.companyId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const error =
    plansResult.error ||
    subscriptionResult.error ||
    usageResult.error ||
    paymentsResult.error;

  if (error) return fail("Unable to load billing information.", 500);

  const usage: Record<string, number> = {
    products: 0,
    orders: 0,
    ai_messages: 0,
    campaigns: 0,
  };

  for (const event of usageResult.data || []) {
    usage[event.metric] = (usage[event.metric] || 0) + event.quantity;
  }

  return NextResponse.json({
    companyId: auth.companyId,
    plans: plansResult.data || [],
    subscription: subscriptionResult.data,
    usage,
    payments: paymentsResult.data || [],
    billingMode: "demo",
  });
}

export async function POST(request: NextRequest) {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return fail("Invalid JSON request.", 400);
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid billing request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const auth = await authorizeCompany("billing.manage", input.companyId);
  if (!auth.ok) return fail(auth.error, auth.status);

  const supabase = await createClient();

  if (input.action === "change_plan") {
    if (!input.planCode) return fail("Select a subscription plan.", 400);

    const { data: plan, error: planError } = await supabase
      .from("billing_plans")
      .select("*")
      .eq("code", input.planCode)
      .eq("is_active", true)
      .single();

    if (planError || !plan) return fail("Selected plan was not found.", 404);

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data: subscription, error: subscriptionError } = await supabase
      .from("company_subscriptions")
      .upsert(
        {
          company_id: auth.companyId,
          plan_id: plan.id,
          status: "active",
          billing_mode: "demo",
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          created_by: auth.userId,
          updated_at: now.toISOString(),
        },
        { onConflict: "company_id" }
      )
      .select("*, plan:billing_plans(*)")
      .single();

    if (subscriptionError || !subscription) {
      return fail("Unable to update workspace subscription.", 500);
    }

    if (Number(plan.price_monthly) > 0) {
      const { error: paymentError } = await supabase
        .from("billing_payments")
        .insert({
          company_id: auth.companyId,
          plan_id: plan.id,
          amount: plan.price_monthly,
          currency: plan.currency || "BDT",
          provider: "demo",
          status: "simulated",
          description: `Demo subscription: ${plan.name}`,
          created_by: auth.userId,
        });

      if (paymentError) {
        return fail("Subscription updated, but demo payment record failed.", 500);
      }
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: "Demo subscription updated. No real payment was made.",
    });
  }

  if (!input.metric || !input.quantity) {
    return fail("Usage metric and quantity are required.", 400);
  }

  const { data: event, error: usageError } = await supabase
    .from("billing_usage_events")
    .insert({
      company_id: auth.companyId,
      metric: input.metric,
      quantity: input.quantity,
      source: "demo",
      created_by: auth.userId,
    })
    .select()
    .single();

  if (usageError || !event) return fail("Unable to record usage.", 500);

  return NextResponse.json({ success: true, event }, { status: 201 });
}
