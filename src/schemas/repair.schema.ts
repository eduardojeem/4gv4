/**
 * Repair Form Validation Schemas
 * 
 * Zod schemas for validating repair form data with:
 * - Type-safe validation
 * - Spanish error messages
 * - Composable schemas
 * - Quick mode support
 */

import { z } from 'zod'

/**
 * Customer information schema
 */
export const CustomerSchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es demasiado largo (máximo 100 caracteres)')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.\,\']+$/, 'El nombre contiene caracteres inválidos'),
  
  phone: z
    .string()
    .min(7, 'El teléfono debe tener al menos 7 dígitos')
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Formato de teléfono inválido. Use números, espacios, guiones o paréntesis'),
  
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  
  address: z
    .string()
    .max(200, 'La dirección es demasiado larga (máximo 200 caracteres)')
    .optional()
    .or(z.literal('')),
  
  document: z
    .string()
    .max(50, 'El documento es demasiado largo (máximo 50 caracteres)')
    .optional()
    .or(z.literal('')),
  
  city: z
    .string()
    .max(100, 'La ciudad es demasiado larga (máximo 100 caracteres)')
    .optional()
    .or(z.literal('')),
  
  country: z
    .string()
    .max(100, 'El país es demasiado largo (máximo 100 caracteres)')
    .optional()
    .or(z.literal(''))
})

/**
 * Device types supported
 */
export const DeviceTypeEnum = z.enum([
  'smartphone',
  'laptop',
  'tablet',
  'desktop',
  'accessory',
  'other'
], 'Selecciona un tipo de dispositivo válido')

/**
 * Access type for device unlock
 */
export const AccessTypeEnum = z.enum([
  'none',
  'pin',
  'password',
  'pattern',
  'biometric',
  'other'
], 'Selecciona un tipo de acceso válido')

/**
 * Device information schema
 */
export const DeviceSchema = z.object({
  deviceType: DeviceTypeEnum,
  
  brand: z
    .string()
    .min(2, 'La marca debe tener al menos 2 caracteres')
    .max(50, 'La marca es demasiado larga (máximo 50 caracteres)'),
  
  model: z
    .string()
    .min(1, 'El modelo es obligatorio')
    .max(100, 'El modelo es demasiado largo (máximo 100 caracteres)'),
  
  issue: z
    .string()
    .min(4, 'Describe el problema (mínimo 4 caracteres)')
    .max(200, 'La descripción del problema es demasiado larga (máximo 200 caracteres)'),
  
  description: z
    .string()
    .max(1000, 'La descripción es demasiado larga (máximo 1000 caracteres)')
    .optional()
    .or(z.literal('')),
  
  accessType: AccessTypeEnum.optional().default('none'),
  
  accessPassword: z
    .string()
    .max(100, 'La contraseña es demasiado larga (máximo 100 caracteres)')
    .optional()
    .or(z.literal('')),
  
  images: z
    .array(z.string().min(1))
    .max(10, 'Máximo 10 imágenes por dispositivo')
    .optional()
    .default([]),
  
  technician: z
    .string()
    .min(1, 'Selecciona un técnico'),
  
  estimatedCost: z
    .number()
    .positive('El costo debe ser un número positivo')
    .max(1000000, 'El costo es demasiado alto')
    .optional()
    .or(z.literal(0))
})

/**
 * Device schema for quick mode (relaxed validation)
 */
export const DeviceSchemaQuick = DeviceSchema.extend({
  description: z
    .string()
    .min(1, 'Proporciona una breve descripción')
    .max(1000, 'La descripción es demasiado larga (máximo 1000 caracteres)')
    .optional()
    .or(z.literal(''))
})

/**
 * Priority levels
 */
export const PriorityEnum = z.enum(['low', 'medium', 'high'], 'Selecciona una prioridad válida')

/**
 * Urgency levels
 */
export const UrgencyEnum = z.enum(['low', 'medium', 'high'], 'Selecciona una urgencia válida')

/**
 * Repair Part Schema
 */
export const RepairPartSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'El nombre del repuesto es obligatorio'),
  cost: z.number().min(0, 'El costo no puede ser negativo'),
  quantity: z.number().min(1, 'La cantidad debe ser al menos 1'),
  supplier: z.string().optional().or(z.literal('')),
  partNumber: z.string().optional().or(z.literal(''))
})

/**
 * Repair Note Schema
 */
export const RepairNoteSchema = z.object({
  id: z.number().optional(),
  text: z.string().min(1, 'La nota no puede estar vacía'),
  isInternal: z.boolean().default(false)
})

/**
 * Complete repair form schema
 */
export const RepairFormSchema = z.object({
  // Customer fields
  customerName: CustomerSchema.shape.name,
  customerPhone: CustomerSchema.shape.phone,
  customerEmail: CustomerSchema.shape.email,
  customerAddress: CustomerSchema.shape.address,
  customerDocument: CustomerSchema.shape.document,
  customerCity: CustomerSchema.shape.city,
  customerCountry: CustomerSchema.shape.country,
  
  // Customer selection
  existingCustomerId: z.string().optional(),
  isNewCustomer: z.boolean().default(false),
  
  // Repair metadata
  priority: PriorityEnum,
  urgency: UrgencyEnum,
  
  // Devices array
  devices: z
    .array(DeviceSchema)
    .min(1, 'Agrega al menos un dispositivo')
    .max(10, 'Máximo 10 dispositivos por reparación')
})

/**
 * Quick mode schema (relaxed validation for faster data entry)
 */
export const RepairFormQuickSchema = z.object({
  // Customer fields
  customerName: CustomerSchema.shape.name,
  customerPhone: CustomerSchema.shape.phone,
  customerEmail: CustomerSchema.shape.email,
  customerAddress: CustomerSchema.shape.address,
  customerDocument: CustomerSchema.shape.document,
  customerCity: CustomerSchema.shape.city,
  customerCountry: CustomerSchema.shape.country,
  
  // Customer selection
  existingCustomerId: z.string().optional(),
  isNewCustomer: z.boolean().default(false),
  
  // Repair metadata
  priority: PriorityEnum,
  urgency: UrgencyEnum,
  
  // Devices array with relaxed validation
  devices: z
    .array(DeviceSchemaQuick)
    .min(1, 'Agrega al menos un dispositivo')
    .max(10, 'Máximo 10 dispositivos por reparación'),

  // Parts array
  parts: z.array(RepairPartSchema).optional().default([]),

  // Notes array
  notes: z.array(RepairNoteSchema).optional().default([])
})

/**
 * Type inference from schemas
 */
export type CustomerFormData = z.infer<typeof CustomerSchema>
export type DeviceFormData = z.infer<typeof DeviceSchema>
export type DeviceFormDataQuick = z.infer<typeof DeviceSchemaQuick>
export type RepairFormData = z.infer<typeof RepairFormSchema>
export type RepairFormDataQuick = z.infer<typeof RepairFormQuickSchema>
export type DeviceType = z.infer<typeof DeviceTypeEnum>
export type AccessType = z.infer<typeof AccessTypeEnum>
export type Priority = z.infer<typeof PriorityEnum>
export type Urgency = z.infer<typeof UrgencyEnum>

/**
 * Validation helper - validate data against schema
 */
export function validateRepairForm(
  data: unknown,
  quickMode = false
): { success: true; data: RepairFormData | RepairFormDataQuick } | { success: false; errors: z.ZodError } {
  const schema = quickMode ? RepairFormQuickSchema : RepairFormSchema
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

/**
 * Get field-specific error messages from Zod error
 */
export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    fieldErrors[path] = issue.message
  }
  
  return fieldErrors
}

/**
 * Check if a field has an error
 */
export function hasFieldError(
  error: z.ZodError | undefined,
  fieldPath: string
): boolean {
  if (!error) return false
  
  return error.issues.some(issue => {
    const path = issue.path.join('.')
    return path === fieldPath || path.startsWith(`${fieldPath}.`)
  })
}

/**
 * Get error message for a specific field
 */
export function getFieldError(
  error: z.ZodError | undefined,
  fieldPath: string
): string | undefined {
  if (!error) return undefined
  
  const issue = error.issues.find(issue => {
    const path = issue.path.join('.')
    return path === fieldPath
  })
  
  return issue?.message
}
