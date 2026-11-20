import "server-only";

import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const safeTextSchema = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .max(500, "Text is too long.");

export const companySlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid company slug.");

export const productInputSchema = z.object({
  company_id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  sku: z.string().trim().max(100).nullable().optional(),
  price: z.number().finite().min(0).max(1000000000),
  category_id: uuidSchema.nullable().optional(),
  is_active: z.boolean().optional(),
}).strict();

export const inventoryAdjustmentSchema = z.object({
  company_id: uuidSchema,
  product_id: uuidSchema,
  variant_id: uuidSchema.nullable().optional(),
  quantity: z.number().int().min(0).max(100000000),
  reason: z.string().trim().min(1).max(500),
}).strict();

export type ProductInput = z.infer<typeof productInputSchema>;
export type InventoryAdjustmentInput = z.infer<
  typeof inventoryAdjustmentSchema
>;
