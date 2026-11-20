import { NextRequest } from "next/server";
import { authorizeCompany } from "@/lib/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/server/http";
import { z } from "zod";

const customerSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional().or(z.literal("")),
  address: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  id: z.string().uuid().optional(),
}).strict();

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const auth = await authorizeCompany("customers.view", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";
  let query = supabase.from("customers")
    .select("id,name,phone,email,address,notes,status,created_at,updated_at")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });

  if (search) {
    const safe = search.replace(/[,%()]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, error } = await query.limit(200);
  if (error) return jsonError("Could not load customers.", 500);
  return jsonSuccess(data || []);
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = z.object({
    company_id: z.string().uuid(),
    id: z.string().uuid(),
    status: z.enum(["active", "inactive"]),
  }).strict().safeParse(body);

  if (!parsed.success) return jsonError("Invalid status request.", 422);

  const auth = await authorizeCompany("customers.manage", parsed.data.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { data, error } = await supabase.from("customers")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("company_id", auth.companyId)
    .select("id,status")
    .maybeSingle();

  if (error) return jsonError("Could not update customer status.", 400);
  if (!data) return jsonError("Customer not found.", 404);

  return jsonSuccess(data);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError("Invalid JSON.", 400); }

  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid customer information.", 422, parsed.error.flatten());

  const input = parsed.data;
  const auth = await authorizeCompany("customers.manage", input.company_id);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const normalizedPhone = (input.phone || "").replace(/\D/g, "");
  const normalizedEmail = (input.email || "").trim().toLowerCase();

  if (normalizedPhone || normalizedEmail) {
    const { data: existing, error: checkError } = await supabase
      .from("customers")
      .select("id,name,phone,email,status")
      .eq("company_id", auth.companyId);

    if (checkError) return jsonError("Duplicate check failed.", 500);

    const duplicate = (existing || []).find((c) => {
      if (c.id === input.id) return false;
      const phone = (c.phone || "").replace(/\D/g, "");
      const email = (c.email || "").trim().toLowerCase();
      return Boolean(
        (normalizedPhone && phone === normalizedPhone) ||
        (normalizedEmail && email === normalizedEmail)
      );
    });

    if (duplicate) {
      return jsonError(
        `এই ফোন বা ইমেইল আগে থেকেই আছে: ${duplicate.name}${duplicate.status === "inactive" ? " (Inactive — Reactivate করুন)" : ""}`,
        409,
        { customer_id: duplicate.id, status: duplicate.status }
      );
    }
  }

  const values = {
    company_id: auth.companyId,
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    notes: input.notes || null,
    status: input.status || "active",
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase.from("customers")
      .update(values).eq("id", input.id).eq("company_id", auth.companyId)
      .select("*").single();
    if (error) return jsonError("Could not update customer.", 400);
    return jsonSuccess(data);
  }

  const { data, error } = await supabase.from("customers")
    .insert({ ...values, created_by: auth.userId }).select("*").single();
  if (error) return jsonError("Could not create customer.", 400);
  return jsonSuccess(data, 201);
}

export async function DELETE(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "";
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid customer ID.", 400);

  const auth = await authorizeCompany("customers.manage", companyId);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const supabase = await createClient();
  const { error } = await supabase.from("customers")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", auth.companyId);
  if (error) return jsonError("Could not deactivate customer.", 400);
  return jsonSuccess({ deactivated: true });
}
