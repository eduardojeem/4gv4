import { z } from 'zod'

// Supplier validation schema
export const supplierSchema = z.object({
  // Basic Information (Required)
  name: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .trim(),
  
  contact_person: z.string()
    .min(2, "El nombre del contacto debe tener al menos 2 caracteres")
    .max(100, "El nombre del contacto no puede exceder 100 caracteres")
    .trim(),
  
  email: z.string()
    .email("Formato de email inválido")
    .max(255, "El email no puede exceder 255 caracteres")
    .toLowerCase()
    .trim(),
  
  phone: z.string()
    .min(10, "El teléfono debe tener al menos 10 dígitos")
    .max(20, "El teléfono no puede exceder 20 caracteres")
    .regex(/^[\+]?[0-9\s\-\(\)]+$/, "Formato de teléfono inválido")
    .trim(),

  // Optional Basic Information
  address: z.string()
    .max(255, "La dirección no puede exceder 255 caracteres")
    .trim()
    .optional()
    .or(z.literal('')),
  
  city: z.string()
    .max(100, "La ciudad no puede exceder 100 caracteres")
    .trim()
    .optional()
    .or(z.literal('')),
  
  country: z.string()
    .max(100, "El país no puede exceder 100 caracteres")
    .trim()
    .optional()
    .or(z.literal('')),
  
  postal_code: z.string()
    .max(20, "El código postal no puede exceder 20 caracteres")
    .trim()
    .optional()
    .or(z.literal('')),
  
  website: z.string()
    .url("Formato de URL inválido")
    .max(255, "La URL no puede exceder 255 caracteres")
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  // Business Information
  business_type: z.enum(['manufacturer', 'distributor', 'wholesaler', 'retailer', 'service_provider'], {
    errorMap: () => ({ message: "Tipo de negocio inválido" })
  }),

  // Status and Performance
  status: z.enum(['active', 'inactive', 'pending', 'suspended'], {
    errorMap: () => ({ message: "Estado inválido" })
  }).default('pending'),

  rating: z.number()
    .min(0, "La calificación no puede ser menor a 0")
    .max(5, "La calificación no puede ser mayor a 5")
    .default(0),

  // Notes
  notes: z.string()
    .max(1000, "Las notas no pueden exceder 1000 caracteres")
    .trim()
    .optional()
    .or(z.literal(''))
})

// Type inference from schema
export type SupplierFormData = z.infer<typeof supplierSchema>

// Partial schema for updates
export const supplierUpdateSchema = supplierSchema.partial().extend({
  id: z.string().uuid("ID de proveedor inválido")
})

export type SupplierUpdateData = z.infer<typeof supplierUpdateSchema>

// Validation functions
export function validateSupplier(data: unknown): { success: true; data: SupplierFormData } | { success: false; errors: z.ZodError } {
  const result = supplierSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

export function validateSupplierUpdate(data: unknown): { success: true; data: SupplierUpdateData } | { success: false; errors: z.ZodError } {
  const result = supplierUpdateSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

// Helper function to format validation errors for UI
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {}
  
  errors.issues.forEach((issue) => {
    const path = issue.path.join('.')
    formattedErrors[path] = issue.message
  })
  
  return formattedErrors
}

// Business type labels for UI
export const businessTypeLabels: Record<SupplierFormData['business_type'], string> = {
  manufacturer: 'Fabricante',
  distributor: 'Distribuidor',
  wholesaler: 'Mayorista',
  retailer: 'Minorista',
  service_provider: 'Proveedor de Servicios'
}

// Status labels for UI
export const statusLabels: Record<SupplierFormData['status'], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  pending: 'Pendiente',
  suspended: 'Suspendido'
}