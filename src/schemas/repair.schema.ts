/**
 * Repair form validation schemas.
 */

import { z } from 'zod'

const MAX_REPAIR_COST = 1_000_000_000
const MAX_REPAIR_COST_MSG = `El costo es demasiado alto. Maximo permitido: ${MAX_REPAIR_COST.toLocaleString('es-PY')}`
const MAX_LABOR_COST_MSG = `El costo de mano de obra es demasiado alto. Maximo permitido: ${MAX_REPAIR_COST.toLocaleString('es-PY')}`
const MAX_FINAL_COST_MSG = `El costo final es demasiado alto. Maximo permitido: ${MAX_REPAIR_COST.toLocaleString('es-PY')}`

export const CustomerSchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es demasiado largo (maximo 100 caracteres)')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.\,\']+$/, 'El nombre contiene caracteres invalidos'),

  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Formato de telefono invalido. Use numeros, espacios, guiones o parentesis')
    .optional()
    .or(z.literal('')),

  email: z
    .string()
    .email('Email invalido')
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(200, 'La direccion es demasiado larga (maximo 200 caracteres)')
    .optional()
    .or(z.literal('')),

  document: z
    .string()
    .max(50, 'El documento es demasiado largo (maximo 50 caracteres)')
    .optional()
    .or(z.literal('')),

  city: z
    .string()
    .max(100, 'La ciudad es demasiado larga (maximo 100 caracteres)')
    .optional()
    .or(z.literal('')),

  country: z
    .string()
    .max(100, 'El pais es demasiado largo (maximo 100 caracteres)')
    .optional()
    .or(z.literal(''))
})

export const DeviceTypeEnum = z.enum([
  'smartphone',
  'laptop',
  'tablet',
  'desktop',
  'accessory',
  'other'
], 'Selecciona un tipo de dispositivo valido')

export const AccessTypeEnum = z.enum([
  'none',
  'pin',
  'password',
  'pattern',
  'biometric',
  'other'
], 'Selecciona un tipo de acceso valido')

export const DeviceSchema = z.object({
  deviceType: DeviceTypeEnum,

  brand: z
    .string()
    .min(2, 'La marca debe tener al menos 2 caracteres')
    .max(50, 'La marca es demasiado larga (maximo 50 caracteres)'),

  model: z
    .string()
    .min(1, 'El modelo es obligatorio')
    .max(100, 'El modelo es demasiado largo (maximo 100 caracteres)'),

  issue: z
    .string()
    .min(4, 'Describe el problema (minimo 4 caracteres)')
    .max(200, 'La descripcion del problema es demasiado larga (maximo 200 caracteres)'),

  description: z
    .string()
    .max(1000, 'La descripcion es demasiado larga (maximo 1000 caracteres)')
    .optional()
    .or(z.literal('')),

  accessType: AccessTypeEnum.optional().default('none'),

  accessPassword: z
    .string()
    .max(100, 'La contrasena es demasiado larga (maximo 100 caracteres)')
    .optional()
    .or(z.literal('')),

  images: z
    .array(z.string().min(1))
    .max(10, 'Maximo 10 imagenes por dispositivo')
    .optional()
    .default([]),

  technician: z.string().min(1, 'Selecciona un tecnico'),

  estimatedCost: z
    .number()
    .positive('El costo debe ser un numero positivo')
    .max(MAX_REPAIR_COST, MAX_REPAIR_COST_MSG)
    .optional()
    .or(z.literal(0))
})

export const DeviceSchemaQuick = DeviceSchema.omit({ issue: true }).extend({
  issue: z
    .string()
    .min(1, 'Describe brevemente el problema')
    .max(200, 'La descripcion del problema es demasiado larga (maximo 200 caracteres)')
})

export const PriorityEnum = z.enum(['low', 'medium', 'high'], 'Selecciona una prioridad valida')
export const UrgencyEnum = z.enum(['low', 'medium', 'high'], 'Selecciona una urgencia valida')

export const RepairPartSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'El nombre del repuesto es obligatorio'),
  cost: z
    .number()
    .min(0, 'El costo no puede ser negativo')
    .max(MAX_REPAIR_COST, MAX_REPAIR_COST_MSG),
  quantity: z.number().min(1, 'La cantidad debe ser al menos 1'),
  supplier: z.string().optional().or(z.literal('')),
  partNumber: z.string().optional().or(z.literal(''))
})

export const RepairNoteSchema = z.object({
  id: z.number().optional(),
  text: z.string().min(1, 'La nota no puede estar vacia'),
  isInternal: z.boolean().default(false)
})

export const WarrantyTypeEnum = z.enum(['labor', 'parts', 'full'], 'Selecciona un tipo de garantia valido')

export const WarrantySchema = z.object({
  warrantyMonths: z
    .number()
    .min(0, 'Los meses de garantia no pueden ser negativos')
    .max(36, 'La garantia maxima es de 36 meses')
    .default(3),

  warrantyType: WarrantyTypeEnum.default('full'),

  warrantyNotes: z
    .string()
    .max(500, 'Las notas de garantia son demasiado largas (maximo 500 caracteres)')
    .optional()
    .or(z.literal(''))
})

export const RepairFormSchema = z.object({
  customerName: CustomerSchema.shape.name,
  customerPhone: CustomerSchema.shape.phone,
  customerEmail: CustomerSchema.shape.email,
  customerAddress: CustomerSchema.shape.address,
  customerDocument: CustomerSchema.shape.document,
  customerCity: CustomerSchema.shape.city,
  customerCountry: CustomerSchema.shape.country,

  existingCustomerId: z.string().min(1, 'Selecciona un cliente'),
  isNewCustomer: z.boolean().default(false),

  priority: PriorityEnum,
  urgency: UrgencyEnum,

  devices: z
    .array(DeviceSchema)
    .min(1, 'Agrega al menos un dispositivo')
    .max(10, 'Maximo 10 dispositivos por reparacion'),

  parts: z.array(RepairPartSchema).optional().default([]),
  notes: z.array(RepairNoteSchema).optional().default([]),

  laborCost: z
    .number()
    .min(0, 'El costo de mano de obra no puede ser negativo')
    .max(MAX_REPAIR_COST, MAX_LABOR_COST_MSG)
    .optional()
    .default(0),

  finalCost: z
    .number()
    .min(0, 'El costo final no puede ser negativo')
    .max(MAX_REPAIR_COST, MAX_FINAL_COST_MSG)
    .optional()
    .nullable()
    .default(null),

  warrantyMonths: z
    .number()
    .min(0, 'Los meses de garantia no pueden ser negativos')
    .max(36, 'La garantia maxima es de 36 meses')
    .default(3),

  warrantyType: WarrantyTypeEnum.default('full'),

  warrantyNotes: z
    .string()
    .max(500, 'Las notas de garantia son demasiado largas (maximo 500 caracteres)')
    .optional()
    .or(z.literal(''))
})

export const RepairFormQuickSchema = z.object({
  customerName: CustomerSchema.shape.name,
  customerPhone: CustomerSchema.shape.phone,
  customerEmail: CustomerSchema.shape.email,
  customerAddress: CustomerSchema.shape.address,
  customerDocument: CustomerSchema.shape.document,
  customerCity: CustomerSchema.shape.city,
  customerCountry: CustomerSchema.shape.country,

  existingCustomerId: z.string().min(1, 'Selecciona un cliente'),
  isNewCustomer: z.boolean().default(false),

  priority: PriorityEnum,
  urgency: UrgencyEnum,

  devices: z
    .array(DeviceSchemaQuick)
    .min(1, 'Agrega al menos un dispositivo')
    .max(10, 'Maximo 10 dispositivos por reparacion'),

  parts: z.array(RepairPartSchema).optional().default([]),
  notes: z.array(RepairNoteSchema).optional().default([]),

  laborCost: z
    .number()
    .min(0, 'El costo de mano de obra no puede ser negativo')
    .max(MAX_REPAIR_COST, MAX_LABOR_COST_MSG)
    .optional()
    .default(0),

  finalCost: z
    .number()
    .min(0, 'El costo final no puede ser negativo')
    .max(MAX_REPAIR_COST, MAX_FINAL_COST_MSG)
    .optional()
    .nullable()
    .default(null),

  warrantyMonths: z
    .number()
    .min(0, 'Los meses de garantia no pueden ser negativos')
    .max(36, 'La garantia maxima es de 36 meses')
    .default(3),

  warrantyType: WarrantyTypeEnum.default('full'),

  warrantyNotes: z
    .string()
    .max(500, 'Las notas de garantia son demasiado largas (maximo 500 caracteres)')
    .optional()
    .or(z.literal(''))
})

export type CustomerFormData = z.infer<typeof CustomerSchema>
export type DeviceFormData = z.infer<typeof DeviceSchema>
export type DeviceFormDataQuick = z.infer<typeof DeviceSchemaQuick>
export type RepairFormData = z.infer<typeof RepairFormSchema>
export type RepairFormDataQuick = z.infer<typeof RepairFormQuickSchema>
export type DeviceType = z.infer<typeof DeviceTypeEnum>
export type AccessType = z.infer<typeof AccessTypeEnum>
export type Priority = z.infer<typeof PriorityEnum>
export type Urgency = z.infer<typeof UrgencyEnum>
export type WarrantyType = z.infer<typeof WarrantyTypeEnum>

export function validateRepairForm(
  data: unknown,
  quickMode = false
): { success: true; data: RepairFormData | RepairFormDataQuick } | { success: false; errors: z.ZodError } {
  const schema = quickMode ? RepairFormQuickSchema : RepairFormSchema
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, errors: result.error }
}

export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.')
    fieldErrors[path] = issue.message
  }

  return fieldErrors
}

export function hasFieldError(
  error: z.ZodError | undefined,
  fieldPath: string
): boolean {
  if (!error) return false

  return error.issues.some((issue) => {
    const path = issue.path.join('.')
    return path === fieldPath || path.startsWith(`${fieldPath}.`)
  })
}

export function getFieldError(
  error: z.ZodError | undefined,
  fieldPath: string
): string | undefined {
  if (!error) return undefined

  const issue = error.issues.find((item) => {
    const path = item.path.join('.')
    return path === fieldPath
  })

  return issue?.message
}
