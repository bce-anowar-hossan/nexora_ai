import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";
import { z } from "zod";

const schema = z.object({
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError("Invalid order ID.", 400);
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid order information.", 422, parsed.error.flatten());
  }

  const input = parsed.data;
  const auth = await authorizeCompany("orders.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase.from("orders")
    .select("id,status,subtotal,discount,delivery_fee,total,payment_method,notes")
    .eq("id", id).eq("company_id", auth.companyId).maybeSingle();

  if (orderError) return jsonError("Could not load order.", 500);
  if (!order) return jsonError("Order not found.", 404);
  if (order.status !== "pending") {
    return jsonError("শুধু Pending Order Edit করা যাবে।", 409);
  }

  const { data: customer } = await supabase.from("customers")
    .select("id").eq("id", input.customer_id)
    .eq("company_id", auth.companyId).eq("status", "active")
    .maybeSingle();

  if (!customer) return jsonError("Active customer not found.", 404);

  const productIds = [...new Set(input.items.map(i => i.product_id))];
  const variantIds = [...new Set(input.items.flatMap(i => i.variant_id ? [i.variant_id] : []))];

  const [{ data: products, error: productError }, { data: variants, error: variantError }] =
    await Promise.all([
      supabase.from("products").select("id,name,sku,price,status")
        .eq("company_id", auth.companyId).in("id", productIds),
      variantIds.length
        ? supabase.from("product_variants")
            .select("id,product_id,name,sku,price")
            .eq("company_id", auth.companyId).in("id", variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (productError || variantError) {
    return jsonError("Could not verify products.", 500);
  }
  if ((products || []).length !== productIds.length) {
    return jsonError("One or more products were not found.", 400);
  }

  const rows = [];
  let subtotal = 0;

  for (const item of input.items) {
    const product = (products || []).find(p => p.id === item.product_id);
    if (!product || product.status !== "active") {
      return jsonError("Only active products can be ordered.", 400);
    }

    const variant = item.variant_id
      ? (variants || []).find(v => v.id === item.variant_id && v.product_id === product.id)
      : null;

    if (item.variant_id && !variant) {
      return jsonError("Product variant not found.", 400);
    }

    const unitPrice = Number(variant ? variant.price : product.price);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    subtotal += lineTotal;

    rows.push({
      company_id: auth.companyId,
      order_id: id,
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
  if (input.discount > subtotal) {
    return jsonError("Discount cannot exceed subtotal.", 400);
  }

  const total = Math.round((subtotal - input.discount + input.delivery_fee) * 100) / 100;

  const { data: oldItems, error: oldError } = await supabase.from("order_items")
    .select("id").eq("company_id", auth.companyId).eq("order_id", id);

  if (oldError) return jsonError("Could not load existing items.", 500);

  // নতুন Items আগে সংরক্ষণ; ব্যর্থ হলে পুরোনো Items অক্ষত থাকবে।
  const { data: newItems, error: insertError } = await supabase.from("order_items")
    .insert(rows).select("id");

  if (insertError || !newItems) {
    return jsonError("Could not save updated order items.", 400);
  }

  const { data: updated, error: updateError } = await supabase.from("orders")
    .update({
      customer_id: input.customer_id,
      subtotal,
      discount: input.discount,
      delivery_fee: input.delivery_fee,
      total,
      payment_method: input.payment_method || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id).eq("company_id", auth.companyId).eq("status", "pending")
    .select("id").maybeSingle();

  if (updateError || !updated) {
    await supabase.from("order_items").delete()
      .eq("company_id", auth.companyId).eq("order_id", id)
      .in("id", newItems.map(row => row.id));
    return jsonError("Order আর Pending নেই অথবা Update করা যায়নি।", 409);
  }

  if (oldItems?.length) {
    const { error: deleteError } = await supabase.from("order_items").delete()
      .eq("company_id", auth.companyId).eq("order_id", id)
      .in("id", oldItems.map(row => row.id));

    if (deleteError) {
      await supabase.from("orders").update({
        subtotal: order.subtotal,
        discount: order.discount,
        delivery_fee: order.delivery_fee,
        total: order.total,
        payment_method: order.payment_method,
        notes: order.notes,
      }).eq("id", id).eq("company_id", auth.companyId).eq("status", "pending");

      await supabase.from("order_items").delete()
        .eq("company_id", auth.companyId).eq("order_id", id)
        .in("id", newItems.map(row => row.id));

      return jsonError("Order Items Update ব্যর্থ হয়েছে।", 500);
    }
  }

  return jsonSuccess({ id, subtotal, discount: input.discount, delivery_fee: input.delivery_fee, total });
}
