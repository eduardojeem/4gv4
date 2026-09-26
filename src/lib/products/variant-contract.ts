import { z } from 'zod'

const normalizeText = (value: string) => value.trim()
const normalizeCode = (value: string) => value.trim().toUpperCase()

export const ProductAttributeDefinitionSchema = z.object({
  key: z.string().trim().min(1, 'La clave del atributo es obligatoria'),
  label: z.string().trim().min(1, 'El nombre del atributo es obligatorio'),
  control: z.enum(['text', 'number', 'select', 'color']),
  options: z.array(z.string().transform(normalizeText).pipe(z.string().min(1)))
    .min(1, 'Agregá al menos una opción'),
})

export const ProductVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  clientKey: z.string().trim().min(1),
  name: z.string().trim().min(1, 'El nombre de la variante es obligatorio'),
  attributes: z.record(z.string(), z.string().transform(normalizeText).pipe(z.string().min(1))),
  sku: z.string().transform(normalizeCode).pipe(z.string().min(1, 'El SKU es obligatorio')),
  barcode: z.string().trim().optional(),
  purchasePrice: z.number().min(0),
  salePrice: z.number().min(0),
  wholesalePrice: z.number().min(0).optional(),
  minStock: z.number().int().min(0),
  stockQuantity: z.number().int().min(0),
  isActive: z.boolean(),
})

export const ProductVariantsPayloadSchema = z.object({
  hasVariants: z.boolean(),
  attributes: z.array(ProductAttributeDefinitionSchema).default([]),
  variants: z.array(ProductVariantInputSchema).default([]),
}).superRefine((payload, context) => {
  if (!payload.hasVariants) return

  if (payload.attributes.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['attributes'],
      message: 'Agregá al menos un atributo para generar variantes',
    })
  }
  if (payload.variants.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['variants'],
      message: 'Agregá al menos una variante',
    })
  }
  if (payload.variants.length > 0 && !payload.variants.some((variant) => variant.isActive)) {
    context.addIssue({
      code: 'custom',
      path: ['variants'],
      message: 'Debe existir al menos una variante activa',
    })
  }

  const combinations = new Set<string>()
  const skus = new Set<string>()
  const barcodes = new Set<string>()

  payload.variants.forEach((variant, index) => {
    const combination = Object.entries(variant.attributes)
      .map(([key, value]) => [key.trim().toLowerCase(), value.trim().toLowerCase()] as const)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('|')

    if (combinations.has(combination)) {
      context.addIssue({
        code: 'custom',
        path: ['variants', index, 'attributes'],
        message: 'Esta combinación de atributos está duplicada',
      })
    }
    combinations.add(combination)

    const sku = variant.sku.trim().toUpperCase()
    if (skus.has(sku)) {
      context.addIssue({
        code: 'custom',
        path: ['variants', index, 'sku'],
        message: 'El SKU está duplicado entre las variantes',
      })
    }
    skus.add(sku)

    const barcode = variant.barcode?.trim()
    if (barcode) {
      if (barcodes.has(barcode)) {
        context.addIssue({
          code: 'custom',
          path: ['variants', index, 'barcode'],
          message: 'El código de barras está duplicado entre las variantes',
        })
      }
      barcodes.add(barcode)
    }
  })
})

export type ProductAttributeDefinition = z.infer<typeof ProductAttributeDefinitionSchema>
export type ProductVariantInput = z.infer<typeof ProductVariantInputSchema>
export type ProductVariantsPayload = z.infer<typeof ProductVariantsPayloadSchema>
