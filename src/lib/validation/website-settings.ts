import { z } from 'zod'

/**
 * Esquemas de validación para configuración del sitio web
 * Valida estructura y tipos de datos en runtime
 */

// Esquema para información de la empresa
export const CompanyInfoSchema = z.object({
  phone: z.string()
    .min(9, 'Teléfono debe tener al menos 9 dígitos')
    .max(20, 'Teléfono no puede exceder 20 caracteres')
    .regex(/^[\d\s\+\-\(\)]+$/, 'Teléfono contiene caracteres inválidos'),
  email: z.string()
    .email('Email inválido')
    .max(100, 'Email no puede exceder 100 caracteres'),
  address: z.string()
    .min(10, 'Dirección debe tener al menos 10 caracteres')
    .max(200, 'Dirección no puede exceder 200 caracteres'),
  hours: z.object({
    weekdays: z.string().max(50, 'Horario no puede exceder 50 caracteres'),
    saturday: z.string().max(50, 'Horario no puede exceder 50 caracteres'),
    sunday: z.string().max(50, 'Horario no puede exceder 50 caracteres'),
  })
})

// Esquema para contenido del hero
export const HeroContentSchema = z.object({
  badge: z.string()
    .min(3, 'Badge debe tener al menos 3 caracteres')
    .max(100, 'Badge no puede exceder 100 caracteres'),
  title: z.string()
    .min(10, 'Título debe tener al menos 10 caracteres')
    .max(150, 'Título no puede exceder 150 caracteres'),
  subtitle: z.string()
    .min(10, 'Subtítulo debe tener al menos 10 caracteres')
    .max(300, 'Subtítulo no puede exceder 300 caracteres'),
})

// Esquema para estadísticas del hero
export const HeroStatsSchema = z.object({
  repairs: z.string()
    .min(1, 'Estadística de reparaciones requerida')
    .max(20, 'Estadística no puede exceder 20 caracteres')
    .regex(/^[\d\w\+\-\%\s]+$/, 'Formato de estadística inválido'),
  satisfaction: z.string()
    .min(1, 'Estadística de satisfacción requerida')
    .max(20, 'Estadística no puede exceder 20 caracteres')
    .regex(/^[\d\w\+\-\%\s]+$/, 'Formato de estadística inválido'),
  avgTime: z.string()
    .min(1, 'Estadística de tiempo requerida')
    .max(20, 'Estadística no puede exceder 20 caracteres')
    .regex(/^[\d\w\+\-\%\s]+$/, 'Formato de estadística inválido'),
})

// Esquema para un servicio individual
export const ServiceSchema = z.object({
  id: z.string(),
  title: z.string()
    .min(3, 'Título debe tener al menos 3 caracteres')
    .max(100, 'Título no puede exceder 100 caracteres'),
  description: z.string()
    .min(10, 'Descripción debe tener al menos 10 caracteres')
    .max(500, 'Descripción no puede exceder 500 caracteres'),
  icon: z.enum(['wrench', 'shield', 'package'], { error: 'Icono inválido' }),
  color: z.enum(['blue', 'green', 'purple'], { error: 'Color inválido' }),
  benefits: z.array(
    z.string()
      .min(1, 'Beneficio no puede estar vacío')
      .max(200, 'Beneficio no puede exceder 200 caracteres')
  )
    .max(10, 'Máximo 10 beneficios por servicio')
    .refine(
      (benefits) => benefits.every(b => b.trim().length > 0),
      'Los beneficios no pueden estar vacíos'
    )
})

// Esquema para array de servicios
export const ServicesSchema = z.array(ServiceSchema)
  .min(1, 'Debe haber al menos 1 servicio')
  .max(10, 'Máximo 10 servicios permitidos')

// Esquema para un testimonio individual
export const TestimonialSchema = z.object({
  id: z.string(),
  name: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre no puede exceder 100 caracteres'),
  rating: z.number()
    .int('Rating debe ser un número entero')
    .min(1, 'Rating mínimo es 1')
    .max(5, 'Rating máximo es 5'),
  comment: z.string()
    .min(10, 'Comentario debe tener al menos 10 caracteres')
    .max(500, 'Comentario no puede exceder 500 caracteres')
})

// Esquema para array de testimonios
export const TestimonialsSchema = z.array(TestimonialSchema)
  .max(20, 'Máximo 20 testimonios')

// Esquema para modo mantenimiento
export const MaintenanceModeSchema = z.object({
  enabled: z.boolean(),
  title: z.string()
    .min(5, 'Título debe tener al menos 5 caracteres')
    .max(100, 'Título no puede exceder 100 caracteres'),
  message: z.string()
    .min(10, 'Mensaje debe tener al menos 10 caracteres')
    .max(500, 'Mensaje no puede exceder 500 caracteres'),
  estimatedEnd: z.string()
    .max(100, 'Tiempo estimado no puede exceder 100 caracteres')
    .optional()
})

// Esquema completo de configuración del sitio web
export const WebsiteSettingsSchema = z.object({
  company_info: CompanyInfoSchema,
  hero_content: HeroContentSchema,
  hero_stats: HeroStatsSchema,
  services: ServicesSchema,
  testimonials: TestimonialsSchema,
  maintenance_mode: MaintenanceModeSchema,
})

// Tipo inferido del esquema
export type ValidatedWebsiteSettings = z.infer<typeof WebsiteSettingsSchema>

// Mapa de esquemas por key
export const SETTING_SCHEMAS = {
  company_info: CompanyInfoSchema,
  hero_content: HeroContentSchema,
  hero_stats: HeroStatsSchema,
  services: ServicesSchema,
  testimonials: TestimonialsSchema,
  maintenance_mode: MaintenanceModeSchema,
} as const

/**
 * Valida un setting específico
 */
export function validateSetting(key: string, value: any) {
  const schema = SETTING_SCHEMAS[key as keyof typeof SETTING_SCHEMAS]
  
  if (!schema) {
    return {
      success: false,
      error: `Invalid setting key: ${key}`
    }
  }

  try {
    const validated = schema.parse(value)
    return {
      success: true,
      data: validated
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }
    }
    return {
      success: false,
      error: 'Validation failed'
    }
  }
}
