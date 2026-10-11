import { z } from 'zod'

export const SERVICE_SPECIALTIES = ['barbering', 'hair', 'nails', 'lashes', 'brows', 'makeup', 'aesthetics', 'other'] as const
export type ServiceSpecialty = typeof SERVICE_SPECIALTIES[number]
export const SERVICE_SPECIALTY_LABELS: Record<ServiceSpecialty, string> = {
  barbering: 'Barbería', hair: 'Peluquería', nails: 'Uñas', lashes: 'Pestañas',
  brows: 'Cejas', makeup: 'Maquillaje', aesthetics: 'Estética', other: 'Otros servicios',
}
export const ServiceBusinessDetailsSchema = z.object({
  serviceSpecialties: z.array(z.enum(SERVICE_SPECIALTIES)).max(8)
    .refine(items => new Set(items).size === items.length, 'No repitas especialidades.').optional(),
  attentionMode: z.enum(['local', 'home', 'both']).optional(),
  appointmentMode: z.enum(['booking', 'walk_in', 'both']).optional(),
})
export type ServiceBusinessDetails = z.infer<typeof ServiceBusinessDetailsSchema>

export function serviceBusinessDetailsPatch(input: ServiceBusinessDetails) {
  const parsed = ServiceBusinessDetailsSchema.parse(input)
  return {
    ...(parsed.serviceSpecialties !== undefined ? { service_specialties: parsed.serviceSpecialties } : {}),
    ...(parsed.attentionMode !== undefined ? { attention_mode: parsed.attentionMode } : {}),
    ...(parsed.appointmentMode !== undefined ? { appointment_mode: parsed.appointmentMode } : {}),
  }
}

/** Defaults are for reads/new accounts, never for partial updates. */
export function readServiceBusinessDetails(input: unknown): Required<ServiceBusinessDetails> {
  const parsed = ServiceBusinessDetailsSchema.safeParse(input)
  return {
    serviceSpecialties: parsed.success ? parsed.data.serviceSpecialties ?? [] : [],
    attentionMode: parsed.success ? parsed.data.attentionMode ?? 'local' : 'local',
    appointmentMode: parsed.success ? parsed.data.appointmentMode ?? 'booking' : 'booking',
  }
}
