import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";
import { z } from "zod";

const orderSchema = z.object({
  company_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  discount: z.number().min(0).max(100000000),
  delivery_fee: z.number().min(0).max(100000000),
  payment_method: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(100000),
  }).strict()).min(1).max(100),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("orders.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data: orders, error } = await supabase.from("orders")
    .select("*").eq("company_id", auth.companyId)
    .order("created_at", { ascending: false }).limit(200);

  if (error) return jsonError("Could not load orders.", 500);
  const ids = (orders || []).map(o => o.id);
  if (!ids.length) return jsonSuccess([]);

  const customerIds = [...new Set((orders || []).map(o => o.customer_id))];
  const [{ data: items, error: itemError }, { data: customers, error: customerError }] = await Promise.all([
    supabase.from("order_items").select("*").eq("company_id", auth.companyId).in("order_id", ids),
    supabase.from("customers").select("id,name,phone,email").eq("company_id", auth.companyId).in("id", customerIds),
  ]);

  if (itemError || customerError) return jsonError("Could not load order details.", 500);

  const result = (orders || []).map(order => ({
    ...order,
    items: (items || []).filter(item => item.order_id === order.id),
    customer: (customers || []).find(c => c.id === order.customer_id) || null,
  }));
  return jsonSuccess(result);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid order information.", 422, parsed.error.flatten());

  const input = parsed.data;
  const auth = await authorizeCompany("orders.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();

  const { data: customer, error: customerError } = await supabase.from("customers")
    .select("id").eq("id", input.customer_id).eq("company_id", auth.companyId)
    .eq("status", "active").maybeSingle();
  if (customerError || !customer) return jsonError("Active customer not found.", 404);

  const productIds = [...new Set(input.items.map(i => i.product_id))];
  const variantIds = [...new Set(input.items.flatMap(i => i.variant_id ? [i.variant_id] : []))];

  const [{ data: products, error: productError }, { data: variants, error: variantError }] = await Promise.all([
    supabase.from("products").select("id,name,sku,price,status")
      .eq("company_id", auth.companyId).in("id", productIds),
    variantIds.length
      ? supabase.from("product_variants").select("id,product_id,name,sku,price")
          .eq("company_id", auth.companyId).in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productError || variantError) return jsonError("Could not verify products.", 500);
  if ((products || []).length !== productIds.length) return jsonError("One or more products were not found.", 400);

  const rows = [];
  let subtotal = 0;

  for (const item of input.items) {
    const product = (products || []).find(p => p.id === item.product_id);
    if (!product || product.status !== "active") return jsonError("Only active products can be ordered.", 400);

    const variant = item.variant_id ? (variants || []).find(v => v.id === item.variant_id && v.product_id === product.id) : null;
    if (item.variant_id && !variant) return jsonError("Product variant not found.", 400);

    const unitPrice = Number(variant ? variant.price : product.price);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    subtotal += lineTotal;

    rows.push({
      product_id: product.id,
      variant_id: variant?.id || null,
      product_name: variant ? `${product.name} — ${variant.name}` : product.name,
      sku: variant?.sku || product.sku || null,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  if (input.discount > subtotal) return jsonError("Discount cannot exceed subtotal.", 400);
  const total = Math.round((subtotal - input.discount + input.delivery_fee) * 100) / 100;

  const orderNumber = `NX-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase.from("orders").insert({
    company_id: auth.companyId,
    customer_id: input.customer_id,
    order_number: orderNumber,
    subtotal,
    discount: input.discount,
    delivery_fee: input.delivery_fee,
    total,
    payment_method: input.payment_method || null,
    notes: input.notes || null,
    created_by: auth.userId,
  }).select("*").single();

  if (orderError || !order) {
    console.error("Order insert error:", orderError);
    const details = process.env.NODE_ENV === "development" && orderError
      ? { code: orderError.code, message: orderError.message, details: orderError.details, hint: orderError.hint }
      : undefined;
    return jsonError("Could not create order.", 400, details);
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    rows.map(row => ({ ...row, company_id: auth.companyId, order_id: order.id }))
  );

  if (itemsError) {
    console.error("Order items insert error:", itemsError);
    const rollback = await supabase.from("orders").delete()
      .eq("id", order.id).eq("company_id", auth.companyId);

    const details = process.env.NODE_ENV === "development"
      ? {
          code: itemsError.code,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
          rollbackError: rollback.error?.message || null,
        }
      : undefined;

    return jsonError("Order items could not be saved. No order was created.", 400, details);
  }

  return jsonSuccess({ ...order, items: rows }, 201);
}
