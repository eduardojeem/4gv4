import { z } from "zod"

/**
 * Customer Validation Schemas
 * 
 * Zod schemas for validating customer data on the client side
 * before sending to the database.
 */

// Phone number validation (basic international format)
const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/

// Email validation with redacted filter
const emailSchema = z.string()
  .refine(val => !val.includes('[REDACTED]'), "Email contiene datos censurados")
  .email("Email inválido")
  .or(z.literal(''))
  .optional()

// Required email for creation
const requiredEmailSchema = z.string()
  .refine(val => !val.includes('[REDACTED]'), "Email contiene datos censurados")
  .email("Email inválido")

// Phone validation - more flexible for optional fields
const phoneSchema = z.string()
  .refine(val => !val.includes('[REDACTED]'), "Teléfono contiene datos censurados")
  .min(7, "Teléfono debe tener al menos 7 dígitos")
  .max(20, "Teléfono no puede exceder 20 caracteres")
  .regex(phoneRegex, "Formato de teléfono inválido")
  .or(z.literal('')) // Allow empty string
  .optional()

// Required phone for creation
const requiredPhoneSchema = z.string()
  .refine(val => !val.includes('[REDACTED]'), "Teléfono contiene datos censurados")
  .min(7, "Teléfono debe tener al menos 7 dígitos")
  .max(20, "Teléfono no puede exceder 20 caracteres")
  .regex(phoneRegex, "Formato de teléfono inválido")

// RUC validation (for Ecuador/Peru - 13 digits)
const rucSchema = z.string()
  .regex(/^\d{10,13}$/, "RUC debe tener entre 10 y 13 dígitos")
  .optional()

// Customer type enum
export const customerTypeSchema = z.enum(["premium", "empresa", "regular"])

// Customer status enum
export const customerStatusSchema = z.enum(["active", "inactive", "suspended", "pending"])

// Customer segment enum
export const customerSegmentSchema = z.enum(["vip", "premium", "regular", "new", "high_value", "low_value", "business", "wholesale"])

// Purchase frequency enum
export const purchaseFrequencySchema = z.enum(["high", "medium", "low", "none"])

// Preferred contact enum
export const preferredContactSchema = z.enum(["email", "phone", "whatsapp", "sms"])

/**
 * Create Customer Schema
 * Used when creating a new customer
 */
export const createCustomerSchema = z.object({
  // Required fields
  name: z.string()
    .min(2, "Nombre debe tener al menos 2 caracteres")
    .max(100, "Nombre no puede exceder 100 caracteres")
    .trim(),
  
  email: requiredEmailSchema,
  
  phone: requiredPhoneSchema,
  
  // Optional fields
  ruc: rucSchema,
  
  address: z.string()
    .max(200, "Dirección no puede exceder 200 caracteres")
    .trim()
    .optional(),
  
  city: z.string()
    .max(100, "Ciudad no puede exceder 100 caracteres")
    .trim()
    .optional(),
  
  customer_type: customerTypeSchema.default("regular"),
  
  segment: customerSegmentSchema.default("new"),
  
  credit_limit: z.number()
    .min(0, "Límite de crédito no puede ser negativo")
    .max(1000000, "Límite de crédito no puede exceder 1,000,000")
    .default(0),
  
  discount_percentage: z.number()
    .min(0, "Descuento no puede ser negativo")
    .max(100, "Descuento no puede exceder 100%")
    .default(0),
  
  payment_terms: z.string()
    .max(50, "Términos de pago no pueden exceder 50 caracteres")
    .default("Contado"),
  
  preferred_contact: preferredContactSchema.default("email"),
  
  notes: z.string()
    .max(1000, "Notas no pueden exceder 1000 caracteres")
    .optional(),
  
  tags: z.array(z.string().max(50, "Etiqueta no puede exceder 50 caracteres"))
    .max(20, "No puede tener más de 20 etiquetas")
    .default([]),
  
  whatsapp: phoneSchema.optional(),
  
  social_media: z.string()
    .max(200, "Redes sociales no pueden exceder 200 caracteres")
    .optional(),
  
  company: z.string()
    .max(100, "Empresa no puede exceder 100 caracteres")
    .optional(),
  
  position: z.string()
    .max(100, "Cargo no puede exceder 100 caracteres")
    .optional(),
  
  referral_source: z.string()
    .max(100, "Fuente de referencia no puede exceder 100 caracteres")
    .default("Directo"),
  
  assigned_salesperson: z.string()
    .max(100, "Vendedor asignado no puede exceder 100 caracteres")
    .default("Sin asignar"),
  
  birthday: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional()
})

/**
 * Update Customer Schema
 * Used when updating an existing customer
 * All fields are optional and more flexible
 */
export const updateCustomerSchema = z.object({
  // Basic fields - more flexible for updates
  name: z.string()
    .min(2, "Nombre debe tener al menos 2 caracteres")
    .max(100, "Nombre no puede exceder 100 caracteres")
    .trim()
    .optional(),
  
  email: z.string().email("Email inválido").or(z.literal('')).optional(),
  
  phone: phoneSchema,
  
  // Optional fields
  ruc: rucSchema,
  
  address: z.string()
    .max(200, "Dirección no puede exceder 200 caracteres")
    .trim()
    .or(z.literal(''))
    .optional(),
  
  city: z.string()
    .max(100, "Ciudad no puede exceder 100 caracteres")
    .trim()
    .or(z.literal(''))
    .optional(),
  
  customer_type: customerTypeSchema.optional(),
  
  segment: customerSegmentSchema.optional(),
  
  status: customerStatusSchema.optional(),
  
  credit_limit: z.number()
    .min(0, "Límite de crédito no puede ser negativo")
    .max(1000000, "Límite de crédito no puede exceder 1,000,000")
    .optional(),
  
  discount_percentage: z.number()
    .min(0, "Descuento no puede ser negativo")
    .max(100, "Descuento no puede exceder 100%")
    .optional(),
  
  payment_terms: z.string()
    .max(50, "Términos de pago no pueden exceder 50 caracteres")
    .or(z.literal(''))
    .optional(),
  
  preferred_contact: preferredContactSchema.optional(),
  
  notes: z.string()
    .max(1000, "Notas no pueden exceder 1000 caracteres")
    .or(z.literal(''))
    .optional(),
  
  tags: z.array(z.string().max(50, "Etiqueta no puede exceder 50 caracteres"))
    .max(20, "No puede tener más de 20 etiquetas")
    .optional(),
  
  whatsapp: phoneSchema,
  
  social_media: z.string()
    .max(200, "Redes sociales no pueden exceder 200 caracteres")
    .or(z.literal(''))
    .optional(),
  
  company: z.string()
    .max(100, "Empresa no puede exceder 100 caracteres")
    .or(z.literal(''))
    .optional(),
  
  position: z.string()
    .max(100, "Cargo no puede exceder 100 caracteres")
    .or(z.literal(''))
    .optional(),
  
  referral_source: z.string()
    .max(100, "Fuente de referencia no puede exceder 100 caracteres")
    .or(z.literal(''))
    .optional(),
  
  assigned_salesperson: z.string()
    .max(100, "Vendedor asignado no puede exceder 100 caracteres")
    .or(z.literal(''))
    .optional(),
  
  birthday: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .or(z.literal(''))
    .optional()
})

/**
 * Customer Filters Schema
 * Used for validating filter inputs
 */
export const customerFiltersSchema = z.object({
  search: z.string().max(100).default(""),
  status: z.union([customerStatusSchema, z.literal("all")]).default("all"),
  customer_type: z.union([customerTypeSchema, z.literal("all")]).default("all"),
  segment: z.union([customerSegmentSchema, z.literal("all")]).default("all"),
  city: z.string().max(100).default("all"),
  assigned_salesperson: z.string().max(100).default("all"),
  date_range: z.object({
    from: z.date().nullable(),
    to: z.date().nullable()
  }).default({ from: null, to: null }),
  credit_score_range: z.tuple([
    z.number().min(0).max(10),
    z.number().min(0).max(10)
  ]).default([0, 10]),
  lifetime_value_range: z.tuple([
    z.number().min(0),
    z.number().min(0)
  ]).default([0, 10000]),
  tags: z.array(z.string()).default([])
})

/**
 * Bulk Update Schema
 * Used for validating bulk update operations
 */
export const bulkUpdateSchema = z.object({
  customerIds: z.array(z.string().uuid("ID de cliente inválido"))
    .min(1, "Debe seleccionar al menos un cliente")
    .max(100, "No puede actualizar más de 100 clientes a la vez"),
  updates: updateCustomerSchema
})

/**
 * Send Message Schema
 * Used for validating message sending
 */
export const sendMessageSchema = z.object({
  customerIds: z.array(z.string().uuid("ID de cliente inválido"))
    .min(1, "Debe seleccionar al menos un cliente")
    .max(500, "No puede enviar mensajes a más de 500 clientes a la vez"),
  message: z.string()
    .min(1, "El mensaje no puede estar vacío")
    .max(1000, "El mensaje no puede exceder 1000 caracteres"),
  type: z.enum(["email", "sms", "whatsapp"])
})

/**
 * Add Note Schema
 */
export const addNoteSchema = z.object({
  customerId: z.string().uuid("ID de cliente inválido"),
  note: z.string()
    .min(1, "La nota no puede estar vacía")
    .max(500, "La nota no puede exceder 500 caracteres")
})

/**
 * Add/Remove Tag Schema
 */
export const tagSchema = z.object({
  customerId: z.string().uuid("ID de cliente inválido"),
  tag: z.string()
    .min(1, "La etiqueta no puede estar vacía")
    .max(50, "La etiqueta no puede exceder 50 caracteres")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "La etiqueta solo puede contener letras, números, espacios, guiones y guiones bajos")
})

// Type exports for TypeScript
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerFiltersInput = z.infer<typeof customerFiltersSchema>
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type AddNoteInput = z.infer<typeof addNoteSchema>
export type TagInput = z.infer<typeof tagSchema>

/**
 * Pre-process customer data to handle edge cases and invalid values
 */
export function preprocessCustomerData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const processed = { ...data }
  const invalidValues = ['[REDACTED]', 'undefined', 'null', 'N/A', '--']

  // Process all string fields
  Object.keys(processed).forEach(key => {
    const value = processed[key]
    
    if (typeof value === 'string') {
      const trimmed = value.trim()
      
      // Check if value is invalid
      if (!trimmed || invalidValues.some(invalid => trimmed.includes(invalid))) {
        delete processed[key] // Remove invalid fields completely
      } else {
        processed[key] = trimmed
      }
    } else if (Array.isArray(value)) {
      // Process arrays
      const filtered = value.filter(item => 
        item && 
        typeof item === 'string' && 
        item.trim() && 
        !invalidValues.some(invalid => item.includes(invalid))
      )
      
      if (filtered.length === 0) {
        delete processed[key]
      } else {
        processed[key] = filtered
      }
    } else if (typeof value === 'number' && isNaN(value)) {
      delete processed[key]
    }
  })

  return processed
}

/**
 * Helper function to validate and parse data
 */
export function validateCustomerData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validData = schema.parse(data)
    return { success: true, data: validData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

/**
 * Helper function to get user-friendly error messages
 */
export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  
  error.issues.forEach((err) => {
    const path = err.path.join('.')
    errors[path] = err.message
  })
  
  return errors
}
