import { z } from 'zod'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { isValidGoogleMapsUrl } from '@/lib/website/company-maps-url'

/**
 * Esquemas de validación para configuración del sitio web
 * Valida estructura y tipos de datos en runtime
 */

// Esquema para información de la empresa
export const CompanyInfoSchema = z.object({
  name: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre no puede exceder 100 caracteres')
    .optional()
    .or(z.literal('')),
  slogan: z.string()
    .max(100, 'Eslogan no puede exceder 100 caracteres')
    .optional()
    .or(z.literal('')),
  description: z.string()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .max(20, 'Teléfono no puede exceder 20 caracteres')
    .optional()
    .or(z.literal('')),
  email: z.string()
    .max(100, 'Email no puede exceder 100 caracteres')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(200, 'Dirección no puede exceder 200 caracteres')
    .optional()
    .or(z.literal('')),
  mapsUrl: z.string()
    .trim()
    .max(1000, 'El enlace de Google Maps es demasiado largo')
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || isValidGoogleMapsUrl(value), 'Ingresá un enlace HTTPS válido de Google Maps'),
  hours: z.object({
    weekdays: z.string().max(100).optional().or(z.literal('')),
    saturday: z.string().max(100).optional().or(z.literal('')),
    sunday: z.string().max(100).optional().or(z.literal('')),
  }).optional(),
  logoUrl: z.string()
    .max(500, 'URL muy larga')
    .optional()
    .or(z.literal('')),
  brandColor: z.enum(['blue','green','purple','orange','red','indigo','teal','rose','amber','emerald','cyan','sky','custom'])
    .optional(),
  customBrandColor: z.string()
    .max(7, 'El color personalizado debe usar formato #RGB o #RRGGBB')
    .refine((value) => value === '' || isValidBrandHexColor(value), 'Ingresá un color HEX válido (#RGB o #RRGGBB)')
    .optional(),
  headerStyle: z.enum(['glass', 'solid', 'accent', 'dark']).optional(),
  headerColor: z.string().max(50).optional().or(z.literal('')),
  showTopBar: z.boolean().optional(),
  whatsapp: z.string().max(50).optional().or(z.literal('')),
  ruc: z.string().max(50).optional().or(z.literal('')),
  businessType: z.string().max(50).optional().or(z.literal('')),
  instagram: z.string().max(100).optional().or(z.literal('')),
  facebook: z.string().max(100).optional().or(z.literal('')),
  tiktok: z.string().max(100).optional().or(z.literal('')),
  marketplacePublic: z.boolean().optional(),
  storefrontPublic: z.boolean().optional(),
  servicesPageEnabled: z.boolean().optional(),
  processSectionEnabled: z.boolean().optional().default(false),
  slug: z.string().optional(),
}).passthrough().superRefine((value, ctx) => {
  if (value.brandColor === 'custom' && !isValidBrandHexColor(value.customBrandColor)) {
    ctx.addIssue({
      code: 'custom',
      path: ['customBrandColor'],
      message: 'Seleccioná un color personalizado válido',
    })
  }
})

// Esquema para contenido del hero
export const HeroContentSchema = z.object({
  enabled: z.boolean().optional().default(true),
  badge: z.string()
    .min(3, 'Badge debe tener al menos 3 caracteres')
    .max(100, 'Badge no puede exceder 100 caracteres'),
  title: z.string()
    .min(10, 'Título debe tener al menos 10 caracteres')
    .max(150, 'Título no puede exceder 150 caracteres'),
  subtitle: z.string()
    .min(10, 'Subtítulo debe tener al menos 10 caracteres')
    .max(300, 'Subtítulo no puede exceder 300 caracteres'),
  trustBadges: z.array(z.string().max(50)).optional(),
  ctaPrimaryText: z.string().max(50).optional(),
  ctaSecondaryText: z.string().max(50).optional(),
  trackRepairText: z.string().max(100).optional(),
})

// Esquema para estadísticas del hero
export const HeroStatsSchema = z.object({
  enabled: z.boolean().optional().default(true),
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

export const OffersCarouselSchema = z.object({
  enabled: z.boolean(),
  title: z.string().min(3).max(120),
  subtitle: z.string().max(240),
  autoplay: z.boolean(),
  intervalSeconds: z.number().int().min(2).max(30),
  maxItems: z.number().int().min(3).max(20),
})

export const OffersSectionSchema = z.object({
  enabled: z.boolean(),
  eyebrow: z.string().min(2).max(60),
  title: z.string().min(3).max(120),
  subtitle: z.string().min(5).max(240),
  accentColor: z.enum(['brand', 'rose', 'amber', 'orange', 'emerald', 'blue', 'sky', 'violet', 'fuchsia', 'red', 'teal']),
  // Opcional a propósito: el editor de /admin/website guarda offers_section sin
  // esta clave, y ese PUT no debe empezar a fallar por un campo que no manda.
  carousel: OffersCarouselSchema.optional(),
})

const PromotionalCarouselLinkSchema = z.string()
  .max(500, 'El enlace no puede exceder 500 caracteres')
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value),
    'El enlace debe ser una ruta interna o una URL http(s)'
  )

const PromotionalCarouselImageSchema = z.string()
  .max(1000, 'La imagen no puede exceder 1000 caracteres')
  .refine(
    (value) => value.startsWith('/') || /^https?:\/\//i.test(value),
    'La imagen debe ser una ruta interna o una URL http(s)'
  )

export const PromotionalCarouselSlideSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(3, 'Ingresá un título').max(100),
  message: z.string().trim().min(3, 'Ingresá un mensaje').max(240),
  imageUrl: PromotionalCarouselImageSchema,
  imageAlt: z.string().trim().min(3, 'Describí la imagen').max(160),
  ctaText: z.string().trim().max(50).optional().or(z.literal('')),
  ctaHref: PromotionalCarouselLinkSchema,
  active: z.boolean(),
  textTone: z.enum(['light', 'dark']),
  contentAlign: z.enum(['left', 'center', 'right']),
}).superRefine((value, ctx) => {
  if (Boolean(value.ctaText?.trim()) !== Boolean(value.ctaHref?.trim())) {
    ctx.addIssue({
      code: 'custom',
      path: ['ctaText'],
      message: 'Completá el texto y el enlace del botón, o dejá ambos vacíos',
    })
  }
})

export const PromotionalCarouselSchema = z.object({
  enabled: z.boolean(),
  autoplay: z.boolean(),
  intervalSeconds: z.number().int().min(5).max(15),
  layoutMode: z.enum(['contained', 'full', 'compact']).optional().default('contained'),
  slides: z.array(PromotionalCarouselSlideSchema).max(6, 'Máximo 6 diapositivas'),
})

export const TrustBarItemSchema = z.object({
  id: z.string().optional(),
  icon: z.string().optional().default('shield'),
  title: z.string().min(1, 'El título es requerido').max(60, 'Máximo 60 caracteres'),
  description: z.string().max(100, 'Máximo 100 caracteres').optional().default(''),
  active: z.boolean().optional().default(true),
})

export const TrustBarSchema = z.object({
  enabled: z.boolean().optional().default(true),
  position: z.enum(['above_carousel', 'below_carousel', 'bottom']).optional().default('above_carousel'),
  items: z.array(TrustBarItemSchema).max(6, 'Máximo 6 beneficios'),
})

export const CreditPlanDefaultSchema = z.object({
  count: z.number().int().min(1, 'Minimo 1 cuota').max(60, 'Maximo 60 cuotas'),
  rate: z.number().min(0, 'El recargo no puede ser negativo').max(300, 'Recargo demasiado alto'),
})

export const ProductCreditDefaultsSchema = z.object({
  enabled: z.boolean(),
  calculationBase: z.enum(['sale', 'cost']),
  respectOffer: z.boolean(),
  costMarkupPercent: z.number().min(0).max(1000),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  downPaymentPercent: z.number().min(0).max(90, 'La entrega inicial no puede superar el 90%'),
  publicByDefault: z.boolean(),
  plans: z.array(CreditPlanDefaultSchema)
    .max(12, 'Maximo 12 planes')
    .refine(
      (plans) => new Set(plans.map((plan) => plan.count)).size === plans.length,
      'No repitas la misma cantidad de cuotas',
    ),
})

const ServiceCtaUrlSchema = z.string()
  .max(200, 'Enlace CTA no puede exceder 200 caracteres')
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value),
    'Enlace CTA debe ser relativo o una URL http(s)'
  )

// Esquema para un servicio individual
export const ServiceSchema = z.object({
  id: z.string(),
  title: z.string()
    .min(3, 'Título debe tener al menos 3 caracteres')
    .max(100, 'Título no puede exceder 100 caracteres'),
  description: z.string()
    .min(10, 'Descripción debe tener al menos 10 caracteres')
    .max(500, 'Descripción no puede exceder 500 caracteres'),
  icon: z.enum([
    'smartphone',
    'monitor',
    'battery',
    'cpu',
    'zap',
    'wrench',
    'shield',
    'package',
    'headset',
    'laptop',
    'clock',
    'sparkles',
    'droplet',
    'camera',
    'microchip',
    'receipt',
    'wallet',
    'landmark',
    'banknote',
    'credit-card'
  ] as const, { error: 'Icono inválido' }),
  color: z.enum([
    'blue',
    'green',
    'purple',
    'orange',
    'red',
    'indigo',
    'teal',
    'yellow',
    'cyan',
    'pink',
    'rose',
    'amber',
    'emerald',
    'sky'
  ] as const, { error: 'Color inválido' }),
    benefits: z.array(
      z.string()
        .min(1, 'Beneficio no puede estar vacío')
        .max(200, 'Beneficio no puede exceder 200 caracteres')
    )
      .min(1, 'Debe haber al menos 1 beneficio')
      .max(10, 'Máximo 10 beneficios por servicio')
    .refine(
      (benefits) => benefits.every(b => b.trim().length > 0),
      'Los beneficios no pueden estar vacíos'
    ),
  active: z.boolean().optional().default(true),
  price: z.union([z.string().max(60), z.number().min(0).max(999_999_999)]).nullable().optional(),
  priceNote: z.string().max(60).optional().or(z.literal('')),
  duration: z.string().max(60).optional().or(z.literal('')),
  ctaUrl: ServiceCtaUrlSchema,
  featured: z.boolean().optional(),
  category: z.string().max(80).optional().or(z.literal('')),
})

// Esquema para array de servicios
export const ServicesSchema = z.array(ServiceSchema)
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
    .max(500, 'Comentario no puede exceder 500 caracteres'),
  active: z.boolean().optional().default(true),
  role: z.string().optional(),
  avatarUrl: z.string().optional()
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

// Esquema para un paso del proceso individual
export const ProcessStepSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string()
    .min(2, 'Título debe tener al menos 2 caracteres')
    .max(100, 'Título no puede exceder 100 caracteres'),
  description: z.string()
    .min(5, 'Descripción debe tener al menos 5 caracteres')
    .max(300, 'Descripción no puede exceder 300 caracteres'),
})

// Esquema para array de pasos del proceso
export const ProcessStepsSchema = z.array(ProcessStepSchema)
  .min(1, 'Debe haber al menos 1 paso')
  .max(8, 'Máximo 8 pasos permitidos')

export const ProcessFlowSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string()
    .min(2, 'Título debe tener al menos 2 caracteres')
    .max(80, 'Título no puede exceder 80 caracteres'),
  description: z.string().max(200, 'Descripción no puede exceder 200 caracteres').optional().or(z.literal('')),
  active: z.boolean().optional().default(true),
  steps: ProcessStepsSchema,
})

export const ServicesSectionSchema = z.object({
  badge: z.string().max(60).optional(),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional()
})

export const ProcessFlowsSchema = z.array(ProcessFlowSchema)
  .max(6, 'Máximo 6 procesos permitidos')

// Esquema para configuración de un método de pago
const BankTransferOptionSchema = z.object({
  id: z.string().min(1).max(100),
  bankName: z.string().min(2, 'Indicá el nombre del banco').max(100),
  alias: z.string().max(100).optional().or(z.literal('')),
  accountNumber: z.string().max(50).optional().or(z.literal('')),
  accountHolder: z.string().max(100).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (!value.alias?.trim() && !value.accountNumber?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['alias'],
      message: 'Ingresá un alias o número de cuenta',
    })
  }
})

const PaymentMethodConfigSchema = z.object({
  enabled: z.boolean(),
  label: z.string().max(60).optional(),
  instructions: z.string().max(500).optional(),
  bankAlias: z.string().max(100).optional(),
  bankCbu: z.string().max(50).optional(),
  bankName: z.string().max(100).optional(),
  transferOptions: z.array(BankTransferOptionSchema).max(8, 'Máximo 8 cuentas bancarias').optional(),
  walletAlias: z.string().max(100).optional(),
  qrImageUrl: z.string().max(500).optional().or(z.literal('')),
}).passthrough()

const DeliveryZoneOptionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(2, 'Indicá el nombre de la zona').max(100),
  cost: z.number().min(0).max(9_999_999),
})

const DeliveryConfigSchema = z.object({
  enabled: z.boolean(),
  defaultCost: z.number().min(0).max(9_999_999),
  freeThreshold: z.number().min(0).max(999_999_999),
  estimatedTime: z.string().max(60),
  zoneOptions: z.array(DeliveryZoneOptionSchema).max(20, 'Máximo 20 zonas de cobertura').optional(),
  zones: z.string().max(300).optional(),
  instructions: z.string().max(500).optional(),
}).passthrough()

const PickupConfigSchema = z.object({
  enabled: z.boolean(),
  estimatedTime: z.string().max(60),
  instructions: z.string().max(500).optional(),
}).passthrough()

export const CheckoutSettingsSchema = z.object({
  commerceMode: z.enum(['cart', 'whatsapp', 'catalog']).default('cart'),
  payment: z.object({
    cash:           PaymentMethodConfigSchema,
    card:           PaymentMethodConfigSchema,
    transfer:       PaymentMethodConfigSchema,
    digital_wallet: PaymentMethodConfigSchema,
  }).passthrough(),
  delivery: DeliveryConfigSchema,
  pickup:   PickupConfigSchema,
  minOrderAmount:       z.number().min(0).max(999_999_999),
  confirmationMessage:  z.string().max(500).optional(),
}).passthrough().superRefine((value, ctx) => {
  if (value.commerceMode !== 'cart') return

  const hasPaymentMethod =
    value.payment.cash.enabled ||
    value.payment.card.enabled ||
    value.payment.transfer.enabled ||
    value.payment.digital_wallet.enabled
  if (!hasPaymentMethod) {
    ctx.addIssue({
      code: 'custom',
      path: ['payment'],
      message: 'Habilitá al menos un método de pago',
    })
  }

  if (!value.delivery.enabled && !value.pickup.enabled) {
    ctx.addIssue({
      code: 'custom',
      path: ['delivery'],
      message: 'Habilitá delivery o retiro en local',
    })
  }
})

// Esquema completo de configuración del sitio web
export const WebsiteSettingsSchema = z.object({
  company_info: CompanyInfoSchema,
  hero_content: HeroContentSchema,
  hero_stats: HeroStatsSchema.optional(),
  offers_section: OffersSectionSchema.optional(),
  promotional_carousel: PromotionalCarouselSchema.optional(),
  offers_carousel: PromotionalCarouselSchema.optional(),
  trust_bar: TrustBarSchema.optional(),
  product_credit_defaults: ProductCreditDefaultsSchema.optional(),
  services_section: ServicesSectionSchema.optional(),
  services: ServicesSchema,
  testimonials: TestimonialsSchema,
  process_steps: ProcessStepsSchema,
  process_flows: ProcessFlowsSchema,
  maintenance_mode: MaintenanceModeSchema.optional(),
  checkout: CheckoutSettingsSchema.optional(),
})

// Tipo inferido del esquema
export type ValidatedWebsiteSettings = z.infer<typeof WebsiteSettingsSchema>

// Mapa de esquemas por key
export const SETTING_SCHEMAS = {
  company_info: CompanyInfoSchema,
  hero_content: HeroContentSchema,
  hero_stats: HeroStatsSchema,
  offers_section: OffersSectionSchema,
  promotional_carousel: PromotionalCarouselSchema,
  offers_carousel: PromotionalCarouselSchema,
  trust_bar: TrustBarSchema,
  product_credit_defaults: ProductCreditDefaultsSchema,
  services_section: ServicesSectionSchema,
  services: ServicesSchema,
  testimonials: TestimonialsSchema,
  process_steps: ProcessStepsSchema,
  process_flows: ProcessFlowsSchema,
  maintenance_mode: MaintenanceModeSchema,
  checkout: CheckoutSettingsSchema,
} as const

export function isWebsiteSettingKey(key: string): key is keyof typeof SETTING_SCHEMAS {
  return Object.prototype.hasOwnProperty.call(SETTING_SCHEMAS, key)
}

/**
 * Valida un setting específico
 */
export function validateSetting(key: string, value: unknown) {
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
      error: 'Error de validación'
    }
  }
}
