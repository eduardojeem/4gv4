import { z } from 'zod'
import { REPAIR_LINE_TYPES } from './line-types'

const MAX_COST = 1_000_000_000
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()
  .transform((value) => value || null)

export const repairPartInputSchema = z.object({
  part_name: z.string().trim().min(1).max(200),
  unit_price: z.number().finite().min(0).max(MAX_COST),
  unit_cost: z.number().finite().min(0).max(MAX_COST).optional(),
  quantity: z.number().int().min(1).max(10_000),
  supplier: optionalText(200),
  part_number: optionalText(100),
  product_id: z.string().uuid().optional().nullable(),
  line_type: z.enum(REPAIR_LINE_TYPES).default('charged_part'),
}).strict()

const repairNoteSchema = z.object({
  note_text: z.string().trim().min(1).max(2_000),
  is_internal: z.boolean().optional().default(false),
}).strict()

const createRepairInputSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(120),
  customer_id: z.string().uuid(),
  // Agrupa las ordenes creadas en una misma recepcion. Null cuando el equipo
  // vino solo, que es la mayoria de los casos.
  reception_id: z.string().uuid().optional().nullable(),
  device_brand: z.string().trim().min(2).max(100),
  device_model: z.string().trim().min(1).max(100),
  serial_number: optionalText(100),
  imei: optionalText(100),
  device_type: z.enum(['smartphone', 'laptop', 'tablet', 'desktop', 'accessory', 'other']),
  problem_description: z.string().trim().min(1).max(200),
  diagnosis: optionalText(1_000),
  access_type: z.enum(['none', 'pin', 'password', 'pattern', 'biometric', 'other']).default('none'),
  access_password: optionalText(100),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  urgency: z.enum(['normal', 'urgent']).default('normal'),
  technician_id: z.string().uuid().optional().nullable(),
  estimated_cost: z.number().finite().min(0).max(MAX_COST).default(0),
  labor_cost: z.number().finite().min(0).max(MAX_COST).default(0),
  final_cost: z.number().finite().min(0).max(MAX_COST).optional().nullable(),
  pricing_mode: z.enum(['automatic', 'budget', 'manual']).default('automatic'),
  discount_amount: z.number().finite().min(0).max(MAX_COST).default(0),
  price_override_reason: optionalText(300),
  warranty_months: z.number().int().min(0).max(36).default(0),
  warranty_type: z.enum(['labor', 'parts', 'full']).default('full'),
  warranty_notes: optionalText(500),
  warranty_expires_at: z.string().datetime({ offset: true }).optional().nullable(),
  parts: z.array(repairPartInputSchema).max(100).optional().default([]),
  notes: z.array(repairNoteSchema).max(50).optional().default([]),
  images: z.array(z.string().trim().min(1).max(2_048)).max(10).optional().default([]),
}).strict().superRefine((input, ctx) => {
  if (['pin', 'password', 'pattern'].includes(input.access_type) && !input.access_password) {
    ctx.addIssue({
      code: 'custom',
      path: ['access_password'],
      message: 'El dato de acceso es obligatorio para el tipo seleccionado.',
    })
  }
})

export type CreateRepairInput = z.infer<typeof createRepairInputSchema>

export function parseCreateRepairInput(input: unknown) {
  return createRepairInputSchema.safeParse(input)
}

export function parseRepairPartsInput(input: unknown) {
  return z.array(repairPartInputSchema).max(100).safeParse(input)
}
