export interface CompanyInfo {
  name?: string
  slogan?: string
  phone: string
  email: string
  address: string
  mapsUrl?: string
  hours: {
    weekdays: string
    saturday: string
    sunday: string
  }
  logoUrl?: string
  brandColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal' | 'rose' | 'amber' | 'emerald' | 'cyan' | 'sky' | 'custom'
  customBrandColor?: string
  headerStyle?: 'glass' | 'solid' | 'accent' | 'dark'
  headerColor?: string
  showTopBar?: boolean
  whatsapp?: string
  ruc?: string
  businessType?: string
  instagram?: string
  facebook?: string
  tiktok?: string
  servicesPageEnabled?: boolean
  repairTrackingEnabled?: boolean
  marketplacePublic?: boolean
  processSectionEnabled?: boolean
  slug?: string
}
export interface HeroStats {
  enabled?: boolean
  repairs: string
  satisfaction: string
  avgTime: string
}

export interface HeroContent {
  enabled?: boolean
  badge: string
  title: string
  subtitle: string
  trustBadges?: string[]
  ctaPrimaryText?: string
  ctaSecondaryText?: string
  trackRepairText?: string
}

/** Carrusel destacado que se muestra arriba de la grilla en /ofertas. */
export interface OffersCarouselSettings {
  /** Muestra u oculta el carrusel en la página pública de ofertas. */
  enabled: boolean
  /** Encabezado de la banda del carrusel. */
  title: string
  /** Bajada opcional debajo del título. */
  subtitle: string
  /** Avance automático entre slides. */
  autoplay: boolean
  /** Segundos entre slides cuando autoplay está activo. */
  intervalSeconds: number
  /** Cantidad máxima de ofertas que entran al carrusel. */
  maxItems: number
}

export interface OffersSectionSettings {
  enabled: boolean
  eyebrow: string
  title: string
  subtitle: string
  accentColor: 'brand' | 'rose' | 'amber' | 'orange' | 'emerald' | 'blue' | 'sky' | 'violet' | 'fuchsia' | 'red' | 'teal'
  carousel: OffersCarouselSettings
}

/** Un plan de cuotas: cantidad y recargo porcentual sobre la base. */
export interface CreditPlanDefault {
  count: number
  rate: number
}

/**
 * Predeterminados del modulo de productos a credito.
 * Se aplican al activar cuotas en un producto, que puede aceptarlos tal cual
 * o cargar los suyos desde cero.
 */
export interface ProductCreditDefaults {
  /** Ofrecer estos predeterminados al activar cuotas en un producto. */
  enabled: boolean
  /** Sobre que precio se calculan las cuotas. */
  calculationBase: 'sale' | 'cost'
  /** Con base 'sale', usar el precio de oferta cuando el producto tiene una. */
  respectOffer: boolean
  /** Margen % que se suma al costo cuando la base es 'cost'. */
  costMarkupPercent: number
  /** Periodicidad de las cuotas. */
  frequency: 'weekly' | 'biweekly' | 'monthly'
  /** Entrega inicial en % del total, descontada antes de financiar. */
  downPaymentPercent: number
  /** Planes ofrecidos por defecto. */
  plans: CreditPlanDefault[]
  /** Marcar las cuotas como visibles en la tienda publica al activarlas. */
  publicByDefault: boolean
}

export interface PromotionalCarouselSlide {
  id: string
  title: string
  message: string
  imageUrl: string
  imageAlt: string
  ctaText?: string
  ctaHref?: string
  active: boolean
  textTone: 'light' | 'dark'
  contentAlign: 'left' | 'center' | 'right'
}

export interface PromotionalCarouselSettings {
  enabled: boolean
  autoplay: boolean
  intervalSeconds: number
  slides: PromotionalCarouselSlide[]
}

export interface ServicesSectionSettings {
  badge: string
  title: string
  subtitle: string
}

export interface Service {
  id: string
  title: string
  description: string
  icon: string
  color: string
  benefits: string[]
  active?: boolean
  price?: string | number | null
  priceNote?: string
  duration?: string   // e.g. "30-60 min"
  ctaUrl?: string     // optional link override per service
  featured?: boolean
  category?: string
}

export interface Testimonial {
  id: string
  name: string
  rating: number
  comment: string
  active?: boolean
  role?: string       // e.g. "Cliente desde 2022"
  avatarUrl?: string  // URL to customer photo
}

export interface ProcessStep {
  id: string
  number: number
  title: string
  description: string
}

export interface ProcessFlow {
  id: string
  title: string
  description?: string
  active?: boolean
  steps: ProcessStep[]
}

export interface MaintenanceMode {
  enabled: boolean
  title: string
  message: string
  estimatedEnd?: string
}

export interface BankTransferOption {
  id: string
  bankName: string
  alias?: string
  accountNumber?: string
  accountHolder?: string
}

export interface PaymentMethodConfig {
  enabled: boolean
  label?: string
  instructions?: string
  // Transfer-specific
  bankAlias?: string
  bankCbu?: string
  bankName?: string
  transferOptions?: BankTransferOption[]
  // Digital wallet-specific
  walletAlias?: string
  qrImageUrl?: string
}

export interface DeliveryZoneOption {
  id: string
  name: string
  cost: number
}

export interface DeliveryConfig {
  enabled: boolean
  defaultCost: number           // Gs. shown in cart by default
  freeThreshold: number         // 0 = always paid; >0 = free above this amount
  estimatedTime: string         // e.g. "30–60 min"
  zoneOptions?: DeliveryZoneOption[]
  zones?: string                // free-text description of zones covered
  instructions?: string         // extra info shown to customer
}

export interface PickupConfig {
  enabled: boolean
  estimatedTime: string         // e.g. "20–30 min"
  instructions?: string
}

export type PublicCommerceMode = 'cart' | 'whatsapp' | 'catalog'

export interface CheckoutSettings {
  commerceMode: PublicCommerceMode
  payment: {
    cash: PaymentMethodConfig
    card: PaymentMethodConfig
    transfer: PaymentMethodConfig
    digital_wallet: PaymentMethodConfig
  }
  delivery: DeliveryConfig
  pickup: PickupConfig
  minOrderAmount: number        // 0 = no minimum
  confirmationMessage?: string  // shown on success screen
}

export interface WebsiteSettings {
  company_info: CompanyInfo
  hero_content?: HeroContent
  hero_stats?: HeroStats
  offers_section?: OffersSectionSettings
  promotional_carousel?: PromotionalCarouselSettings
  /** Mismo banner que promotional_carousel, pero para la pagina /ofertas. */
  offers_carousel?: PromotionalCarouselSettings
  product_credit_defaults?: ProductCreditDefaults
  services_section?: ServicesSectionSettings
  services: Service[]
  testimonials: Testimonial[]
  process_steps: ProcessStep[]
  process_flows: ProcessFlow[]
  maintenance_mode?: MaintenanceMode
  checkout?: CheckoutSettings
}

export type WebsiteSettingKey = keyof WebsiteSettings
