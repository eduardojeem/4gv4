import { z } from 'zod'
import { STOREFRONT_STYLE_PREFERENCES } from '@/lib/website/storefront-style'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { isValidGoogleMapsUrl } from '@/lib/website/company-maps-url'
import { socialHandle, type SocialPlatform } from '@/lib/public/social-links'

/**
 * Los mensajes de Zod salen en castellano. Varios campos no tienen mensaje
 * propio y el panel mostraba «Too small: expected string to have >=3
 * characters» a quien estaba cargando su tienda.
 */
const zodEs = z.locales.es()

/**
 * Una ruta de la tienda (`/ofertas`) o una dirección http(s). Todo lo demás
 * —`javascript:`, `data:`— no se guarda: estos valores terminan en `href` o
 * `src` de la tienda pública.
 */
export function isSafeLinkOrPath(value: string): boolean {
  const target = value.trim()
  if (!target) return true
  if (target.startsWith('//')) return false
  return target.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(target)
}

const safeLink = (max: number, message = 'Usá una ruta de tu tienda (/ofertas) o una dirección http(s)') =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).refine(isSafeLinkOrPath, message)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Un usuario (@tienda) o la dirección del perfil en esa red. */
const socialProfile = (platform: SocialPlatform) =>
  z.string().trim().max(100, 'Máximo 100 caracteres').optional().or(z.literal(''))
    .refine(
      (value) => !value || /^[A-Za-z0-9._-]{1,60}$/.test(socialHandle(value, platform)),
      'Ingresá el usuario (@tienda) o el enlace del perfil',
    )

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
    .trim()
    .max(100, 'Email no puede exceder 100 caracteres')
    .refine((value) => !value || EMAIL_PATTERN.test(value), 'Ingresá un email válido')
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
  logoUrl: safeLink(500, 'El logo debe ser una ruta interna (/...) o una URL http(s)')
    .optional()
    .or(z.literal('')),
  brandColor: z.enum(['blue','green','purple','orange','red','indigo','teal','rose','amber','emerald','cyan','sky','custom'])
    .optional(),
  customBrandColor: z.string()
    .max(7, 'El color personalizado debe usar formato #RGB o #RRGGBB')
    .refine((value) => value === '' || isValidBrandHexColor(value), 'Ingresá un color HEX válido (#RGB o #RRGGBB)')
    .optional(),
  headerStyle: z.enum(['glass', 'solid', 'accent', 'dark']).optional(),
  storefrontStyle: z.enum(STOREFRONT_STYLE_PREFERENCES).optional(),
  headerColor: z.string().max(50).optional().or(z.literal('')),
  showTopBar: z.boolean().optional(),
  whatsapp: z.string().max(50).optional().or(z.literal('')),
  ruc: z.string().max(50).optional().or(z.literal('')),
  businessType: z.string().max(50).optional().or(z.literal('')),
  instagram: socialProfile('instagram'),
  facebook: socialProfile('facebook'),
  tiktok: socialProfile('tiktok'),
  marketplacePublic: z.boolean().optional(),
  storefrontPublic: z.boolean().optional(),
  servicesPageEnabled: z.boolean().optional(),
  repairTrackingEnabled: z.boolean().optional(),
  // Sin valor por defecto: el sitio lo trae activado. Con `default(false)`,
  // cualquier guardado de la empresa que no mandara el campo apagaba «Cómo
  // comprar» sin que nadie lo pidiera.
  processSectionEnabled: z.boolean().optional(),
  slug: z.string().max(60).optional(),
  // Los campos que no están acá se descartan: con `.passthrough()` se guardaba
  // cualquier clave, de cualquier tamaño, dentro de company_info.
}).superRefine((value, ctx) => {
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
  badge: z.string().max(100, 'Badge no puede exceder 100 caracteres').default(''),
  title: z.string().max(150, 'Título no puede exceder 150 caracteres').default(''),
  subtitle: z.string().max(300, 'Subtítulo no puede exceder 300 caracteres').default(''),
  trustBadges: z.array(z.string().max(50)).max(6, 'Máximo 6 garantías').optional(),
  ctaPrimaryText: z.string().max(50).optional(),
  ctaSecondaryText: z.string().max(50).optional(),
  trackRepairText: z.string().max(100).optional(),
}).superRefine((value, ctx) => {
  // Con la portada apagada no se exigen los textos: antes no se podía
  // desactivarla sin inventar un título de 10 letras.
  if (value.enabled === false) return
  if (value.badge.trim().length < 3) ctx.addIssue({ code: 'custom', path: ['badge'], message: 'Badge debe tener al menos 3 caracteres' })
  if (value.title.trim().length < 10) ctx.addIssue({ code: 'custom', path: ['title'], message: 'Título debe tener al menos 10 caracteres' })
  if (value.subtitle.trim().length < 10) ctx.addIssue({ code: 'custom', path: ['subtitle'], message: 'Subtítulo debe tener al menos 10 caracteres' })
})

// Esquema para estadísticas del hero.
//
// El formato rechazaba el punto y la estrella, y los valores de ejemplo de casi
// todos los rubros son «5.000+», «4.9★» o «99.5%»: una tienda que tocaba las
// estadísticas sin cambiarlas no podía guardar la portada. Se permiten letras,
// números y los signos que se usan para una cifra; no hay HTML que colar porque
// el texto ya pasó por el sanitizador.
const STAT_PATTERN = /^[\p{L}\p{N}\s+\-%.,★☆*/:~<>()]+$/u

const statValue = (label: string) =>
  z.string().trim().max(20, 'Estadística no puede exceder 20 caracteres')
    .refine((value) => !value || STAT_PATTERN.test(value), `Formato de ${label} inválido`)
    .default('')

export const HeroStatsSchema = z.object({
  enabled: z.boolean().optional().default(true),
  repairs: statValue('la primera estadística'),
  satisfaction: statValue('la segunda estadística'),
  avgTime: statValue('la tercera estadística'),
}).superRefine((value, ctx) => {
  if (value.enabled === false) return
  for (const key of ['repairs', 'satisfaction', 'avgTime'] as const) {
    if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Completá la estadística o desactivá el bloque' })
  }
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
  title: z.string().trim().max(100).default(''),
  message: z.string().trim().max(240).default(''),
  imageUrl: PromotionalCarouselImageSchema,
  imageAlt: z.string().trim().min(3, 'Describí la imagen').max(160),
  ctaText: z.string().trim().max(50).optional().or(z.literal('')),
  ctaHref: PromotionalCarouselLinkSchema,
  active: z.boolean(),
  textTone: z.enum(['light', 'dark']).default('light'),
  contentAlign: z.enum(['left', 'center', 'right']).default('left'),
  hideText: z.boolean().optional().default(false),
  badge: z.string().trim().max(40).optional().or(z.literal('')),
  titleSize: z.enum(['normal', 'large', 'compact']).optional().default('normal'),
  overlayIntensity: z.enum(['none', 'subtle', 'medium', 'strong']).optional().default('strong'),
  overlayColor: z.enum(['black', 'white', 'brand']).optional().default('black'),
  backgroundColor: z.string().max(50).optional().or(z.literal('')),
  titleColor: z.string().max(50).optional().or(z.literal('')),
  fontFamily: z.enum(['sans', 'display', 'serif', 'mono']).optional().default('sans'),
}).superRefine((value, ctx) => {
  // Validación de botón:
  // Si hideText es false, ctaText y ctaHref deben ir juntos o ambos vacíos.
  // Si hideText es true, permitimos ctaHref sin ctaText (para hacer clic en todo el banner sin mostrar botón encima).
  if (!value.hideText) {
    if (Boolean(value.ctaText?.trim()) !== Boolean(value.ctaHref?.trim())) {
      ctx.addIssue({
        code: 'custom',
        path: ['ctaText'],
        message: 'Completá el texto y el enlace del botón, o dejá ambos vacíos',
      })
    }
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

export const BrandItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'El nombre de la marca es requerido').max(60, 'Máximo 60 caracteres'),
  active: z.boolean().default(true),
  imageUrl: safeLink(500, 'La imagen debe ser una ruta interna o una URL http(s)').optional().or(z.literal('')),
  href: safeLink(255).optional(),
})

export const BrandsSectionSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().trim().min(1, 'El título es requerido').max(100, 'Máximo 100 caracteres').default('Marcas destacadas'),
  subtitle: z.string().max(200, 'Máximo 200 caracteres').optional().default('Encontrá productos originales con garantía y respaldo de marca'),
  items: z.array(BrandItemSchema).max(36, 'Máximo 36 marcas').default([]),
  showOnHome: z.boolean().optional().default(false),
  showOnProducts: z.boolean().optional().default(false),
  showOnOffers: z.boolean().optional().default(false),
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
  role: z.string().max(80, 'Máximo 80 caracteres').optional(),
  avatarUrl: safeLink(500, 'La foto debe ser una ruta interna o una URL http(s)').optional()
})

// Esquema para array de testimonios
export const TestimonialsSchema = z.array(TestimonialSchema)
  .max(20, 'Máximo 20 testimonios')

// Esquema para modo mantenimiento
export const MaintenanceModeSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(100, 'Título no puede exceder 100 caracteres').default(''),
  message: z.string().max(500, 'Mensaje no puede exceder 500 caracteres').default(''),
  estimatedEnd: z.string()
    .max(100, 'Tiempo estimado no puede exceder 100 caracteres')
    .optional()
}).superRefine((value, ctx) => {
  // Apagado no se muestra: no hace falta completar los textos para apagarlo.
  if (!value.enabled) return
  if (value.title.trim().length < 5) ctx.addIssue({ code: 'custom', path: ['title'], message: 'Título debe tener al menos 5 caracteres' })
  if (value.message.trim().length < 10) ctx.addIssue({ code: 'custom', path: ['message'], message: 'Mensaje debe tener al menos 10 caracteres' })
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
  qrImageUrl: safeLink(500, 'El QR debe ser una ruta interna o una URL http(s)').optional().or(z.literal('')),
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

const announcementDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD').or(z.literal(''))

export const AnnouncementSchema = z.object({
  id: z.string().trim().max(40).optional().default(''),
  enabled: z.boolean().default(false),
  title: z.string().trim().max(120).default(''),
  message: z.string().trim().max(600).default(''),
  badgeLabel: z.string().trim().max(40).optional().default('Novedad destacada'),
  badgeVariant: z.enum(['primary', 'amber', 'emerald', 'purple', 'rose', 'cyan', 'indigo', 'orange', 'teal', 'slate']).optional().default('primary'),
  highlightNote: z.string().trim().max(120).optional().default(''),
  carouselAnimation: z.enum(['slide', 'fade', 'zoom']).optional().default('slide'),
  carouselIntervalSeconds: z.number().int().min(0).max(30).optional().default(3),
  imageBackdrop: z.enum(['ambient', 'dark', 'tinted', 'light']).optional().default('ambient'),
  imageFit: z.enum(['contain', 'cover']).optional().default('contain'),
  imageEffect: z.enum(['zoom', 'glow', 'none']).optional().default('zoom'),
  frequency: z.enum(['always', 'once_per_day', 'once_per_session']).optional().default('once_per_day'),
  autoCloseSeconds: z.number().int().min(0).max(120).optional().default(5),
  imageUrl: safeLink(500, 'La imagen debe ser una ruta interna o una URL http(s)').optional().default(''),
  images: z.array(z.object({
    url: safeLink(500, 'La imagen debe ser una ruta interna o una URL http(s)').pipe(z.string().min(1)),
    alt: z.string().trim().max(120).optional().default(''),
    href: safeLink(500).optional().default(''),
  })).max(5, 'Hasta 5 imágenes').optional().default([]),
  ctaLabel: z.string().trim().max(60).optional().default(''),
  ctaHref: z.string().trim().max(500).optional().default(''),
  startsAt: announcementDate.optional().default(''),
  endsAt: announcementDate.optional().default(''),
  updatedAt: z.string().trim().max(40).optional().default(''),
}).superRefine((value, context) => {
  // Un aviso activo sin texto no se mostraria nunca: mejor avisarlo al guardar.
  if (value.enabled && !value.title) {
    context.addIssue({ code: 'custom', path: ['title'], message: 'Escribí un título para activarlo' })
  }
  if (value.enabled && !value.message) {
    context.addIssue({ code: 'custom', path: ['message'], message: 'Escribí el mensaje para activarlo' })
  }
  if (value.ctaLabel && !value.ctaHref) {
    context.addIssue({ code: 'custom', path: ['ctaHref'], message: 'El botón necesita un enlace' })
  }
  if (value.ctaHref && !(value.ctaHref.startsWith('/') || /^https?:\/\//i.test(value.ctaHref))) {
    context.addIssue({ code: 'custom', path: ['ctaHref'], message: 'Usá una ruta de tu tienda (/ofertas) o una URL http(s)' })
  }
  if (value.startsAt && value.endsAt && value.startsAt > value.endsAt) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fecha de fin es anterior a la de inicio' })
  }
})

// Hasta tres avisos por tienda: mas que eso no se alcanzan a mostrar.
export const AnnouncementsSchema = z.array(AnnouncementSchema).max(3, 'Hasta 3 avisos')

// Esquema completo de configuración del sitio web
export const WebsiteSettingsSchema = z.object({
  company_info: CompanyInfoSchema,
  hero_content: HeroContentSchema,
  hero_stats: HeroStatsSchema.optional(),
  offers_section: OffersSectionSchema.optional(),
  promotional_carousel: PromotionalCarouselSchema.optional(),
  offers_carousel: PromotionalCarouselSchema.optional(),
  trust_bar: TrustBarSchema.optional(),
  announcement: AnnouncementSchema.optional(),
  announcements: AnnouncementsSchema.optional(),
  brands_section: BrandsSectionSchema.optional(),
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
  announcement: AnnouncementSchema,
  announcements: AnnouncementsSchema,
  brands_section: BrandsSectionSchema,
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
    const validated = schema.parse(value, { error: zodEs.localeError })
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
