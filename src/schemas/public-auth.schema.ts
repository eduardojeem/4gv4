import { z } from 'zod'

/**
 * Schema for repair authentication (public portal)
 */
export const repairAuthSchema = z.object({
  contact: z.string()
    .min(5, 'Ingresa un email o teléfono válido')
    .refine(
      (val) => {
        // Check if it's a valid email OR a phone number (8+ digits)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const phoneRegex = /^\+?[\d\s-]{8,}$/
        return emailRegex.test(val) || phoneRegex.test(val.replace(/\s|-/g, ''))
      },
      { message: 'Debe ser un email o teléfono válido' }
    ),
  ticketNumber: z.string()
    // Allow both R-YYYY-XXXXX (Frontend) and REP-XXXXXX (Database) formats
    .refine(
      (val) => /^(R-\d{4}-\d+|REP-\d+|R-\d{6}-\d+)$/i.test(val.toUpperCase()),
      { message: 'Formato de ticket inválido (ej: R-2026-00042 o REP-000001)' }
    )
    .transform((val) => val.toUpperCase())
})

/**
 * Schema for client signup (future feature)
 */
export const clientSignupSchema = z.object({
  email: z.string().email('Email inválido'),
  phone: z.string().min(8, 'Teléfono debe tener al menos 8 dígitos'),
  fullName: z.string().min(3, 'Nombre muy corto')
})

export type RepairAuthInput = z.infer<typeof repairAuthSchema>
export type ClientSignupInput = z.infer<typeof clientSignupSchema>
