import { z } from 'zod'

// Supplier validation schema
export const supplierSchema = z.object({
  // Basic Information — only name is required
  name: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .trim(),
  
  contact_name: z.string()
    .max(100, "El nombre del contacto no puede exceder 100 caracteres")
    .trim()
    .optional()
    .or(z.literal('')),
  
  email: z.string()
    .email("Formato de email inválido")
    .max(255)
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  
  phone: z.string()
    .max(20, "El teléfono no puede exceder 20 caracteres")
    .trim()
    .optional()
    .or(z.literal('')),

  // Optional Information
  address: z.string()
    .max(255)
    .trim()
    .optional()
    .or(z.literal('')),
  
  city: z.string()
    .max(100)
    .trim()
    .optional()
    .or(z.literal('')),
  
  country: z.string()
    .max(100)
    .trim()
    .optional()
    .or(z.literal('')),
  
  postal_code: z.string()
    .max(20)
    .trim()
    .optional()
    .or(z.literal('')),
  
  website: z.string()
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  // Business Information
  business_type: z.enum(['manufacturer', 'distributor', 'wholesaler', 'retailer', 'service_provider'] as const).optional().default('distributor'),

  // Status and Performance
  status: z.enum(['active', 'inactive', 'pending', 'suspended'] as const).optional().default('active'),

  rating: z.number()
    .min(0)
    .max(5)
    .default(0),

  // Notes
  notes: z.string()
    .max(1000)
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