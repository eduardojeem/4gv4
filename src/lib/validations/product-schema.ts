import * as z from "zod"

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(200, "El nombre no puede exceder 200 caracteres"),
  sku: z.string().min(3, "El SKU debe tener al menos 3 caracteres").regex(/^[A-Z0-9-_]+$/i, "El SKU solo puede contener letras, números, guiones y guiones bajos"),
  description: z.string().max(2000, "La descripción no puede exceder 2000 caracteres").optional().nullable(),
  category_id: z.string().min(1, "La categoría es requerida"),
  brand_id: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  supplier_id: z.string().optional().nullable(),
  
  // Precios
  purchase_price: z.coerce.number().min(0, "El precio de compra no puede ser negativo"),
  sale_price: z.coerce.number().min(0.01, "El precio de venta es requerido y debe ser mayor a 0"),
  wholesale_price: z.coerce.number().min(0, "El precio mayorista no puede ser negativo").optional().nullable(),
  offer_price: z.coerce.number().min(0, "El precio de oferta no puede ser negativo").optional().nullable(),
  has_offer: z.boolean().default(false),
  
  // Inventario
  stock_quantity: z.coerce.number().int().min(0, "El stock no puede ser negativo"),
  min_stock: z.coerce.number().int().min(0, "El stock mínimo no puede ser negativo"),
  // max_stock no se guarda en BD — solo se usa como referencia visual en el UI
  max_stock: z.coerce.number().int().min(0, "El stock máximo no puede ser negativo").optional().nullable(),
  
  // Otros
  unit_measure: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(), // Validacion mas compleja se puede hacer con refine si es necesario
  is_active: z.boolean().default(true),
  images: z.array(z.string()).default([])
}).superRefine((data, ctx) => {
  // Validar precio venta > precio compra
  if (data.purchase_price > 0 && data.sale_price > 0) {
    if (data.sale_price <= data.purchase_price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El precio de venta debe ser mayor al precio de compra",
        path: ["sale_price"]
      })
    }
  }

  // Validar precio mayorista
  if (data.wholesale_price && data.wholesale_price > 0) {
    if (data.wholesale_price >= data.sale_price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El precio mayorista debe ser menor al precio de venta",
        path: ["wholesale_price"]
      })
    }
    if (data.wholesale_price <= data.purchase_price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El precio mayorista debe ser mayor al precio de compra",
        path: ["wholesale_price"]
      })
    }
  }

  // Validar precio oferta
  if (data.has_offer) {
    if (!data.offer_price || data.offer_price <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El precio de oferta es requerido cuando la oferta está activa",
        path: ["offer_price"]
      })
    } else {
      if (data.offer_price >= data.sale_price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El precio de oferta debe ser menor al precio de venta",
          path: ["offer_price"]
        })
      }
      if (data.offer_price <= data.purchase_price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El precio de oferta debe ser mayor al precio de compra",
          path: ["offer_price"]
        })
      }
    }
  }

  // Validar stock máximo (solo referencia visual, no se guarda en BD)
  if (data.max_stock && data.max_stock > 0) {
    if (data.max_stock <= data.min_stock) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El stock máximo debe ser mayor al stock mínimo",
        path: ["max_stock"]
      })
    }
  }
})

// Output type (after parsing/coercion) — used for onSubmit handler
export type ProductFormValues = z.output<typeof productSchema>
// Input type (before parsing) — used for useForm generic with zodResolver v5 + zod v4
export type ProductFormInput = z.input<typeof productSchema>
