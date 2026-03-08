import * as z from "zod"

export const productSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string()
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .max(200, "El nombre no puede exceder 200 caracteres"),
    sku: z
      .string()
      .min(3, "El SKU debe tener al menos 3 caracteres")
      .regex(
        /^[A-Z0-9-_]+$/i,
        "El SKU solo puede contener letras, numeros, guiones y guion bajo",
      ),
    description: z
      .string()
      .max(2000, "La descripcion no puede exceder 2000 caracteres")
      .optional()
      .nullable(),
    category_id: z.string().min(1, "La categoria es requerida"),
    brand_id: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    supplier_id: z.string().optional().nullable(),

    // Pricing
    purchase_price: z
      .coerce
      .number()
      .min(0, "El precio de compra no puede ser negativo"),
    sale_price: z
      .coerce
      .number()
      .min(0.01, "El precio de venta es requerido y debe ser mayor a 0"),
    wholesale_price: z
      .coerce
      .number()
      .min(0, "El precio mayorista no puede ser negativo")
      .optional()
      .nullable(),
    offer_price: z
      .coerce
      .number()
      .min(0, "El precio de oferta no puede ser negativo")
      .optional()
      .nullable(),
    has_offer: z.boolean().default(false),

    // Post-sale fields
    warranty_months: z
      .coerce
      .number()
      .int()
      .min(0, "La garantia no puede ser negativa")
      .max(60, "La garantia maxima es de 60 meses")
      .default(3),
    warranty_info: z
      .string()
      .max(1000, "La informacion de garantia no puede exceder 1000 caracteres")
      .optional()
      .nullable(),
    return_window_days: z
      .coerce
      .number()
      .int()
      .min(0, "Los dias de devolucion no pueden ser negativos")
      .max(90, "El maximo para devoluciones es 90 dias")
      .default(7),
    exchange_window_days: z
      .coerce
      .number()
      .int()
      .min(0, "Los dias de cambio no pueden ser negativos")
      .max(90, "El maximo para cambios es 90 dias")
      .default(7),
    return_policy: z
      .string()
      .max(1000, "La politica de devolucion no puede exceder 1000 caracteres")
      .optional()
      .nullable(),
    exchange_policy: z
      .string()
      .max(1000, "La politica de cambio no puede exceder 1000 caracteres")
      .optional()
      .nullable(),

    // Inventory
    stock_quantity: z
      .coerce
      .number()
      .int()
      .min(0, "El stock no puede ser negativo"),
    min_stock: z
      .coerce
      .number()
      .int()
      .min(0, "El stock minimo no puede ser negativo"),
    // max_stock is UI-only and is not persisted in DB.
    max_stock: z
      .coerce
      .number()
      .int()
      .min(0, "El stock maximo no puede ser negativo")
      .optional()
      .nullable(),

    // Other
    unit_measure: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
    images: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    // sale_price > purchase_price
    if (data.purchase_price > 0 && data.sale_price > 0) {
      if (data.sale_price <= data.purchase_price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El precio de venta debe ser mayor al precio de compra",
          path: ["sale_price"],
        })
      }
    }

    // wholesale_price checks
    if (data.wholesale_price && data.wholesale_price > 0) {
      if (data.wholesale_price >= data.sale_price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El precio mayorista debe ser menor al precio de venta",
          path: ["wholesale_price"],
        })
      }
      if (data.wholesale_price <= data.purchase_price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El precio mayorista debe ser mayor al precio de compra",
          path: ["wholesale_price"],
        })
      }
    }

    // offer_price checks
    if (data.has_offer) {
      if (!data.offer_price || data.offer_price <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El precio de oferta es requerido cuando la oferta esta activa",
          path: ["offer_price"],
        })
      } else {
        if (data.offer_price >= data.sale_price) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El precio de oferta debe ser menor al precio de venta",
            path: ["offer_price"],
          })
        }
        if (data.offer_price <= data.purchase_price) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El precio de oferta debe ser mayor al precio de compra",
            path: ["offer_price"],
          })
        }
      }
    }

    // max_stock checks (UI-only)
    if (data.max_stock && data.max_stock > 0) {
      if (data.max_stock <= data.min_stock) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El stock maximo debe ser mayor al stock minimo",
          path: ["max_stock"],
        })
      }
    }

    // post-sale consistency
    if (
      data.exchange_window_days > 0 &&
      data.return_window_days > 0 &&
      data.exchange_window_days > data.return_window_days
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "La ventana de cambio no puede ser mayor a la ventana de devolucion",
        path: ["exchange_window_days"],
      })
    }
  })

// Output type (after parsing/coercion) - used for onSubmit handler
export type ProductFormValues = z.output<typeof productSchema>
// Input type (before parsing) - used for useForm generic with zodResolver v5 + zod v4
export type ProductFormInput = z.input<typeof productSchema>
