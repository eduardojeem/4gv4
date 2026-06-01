export interface CompanyInfo {
  name?: string
  phone: string
  email: string
  address: string
  hours: {
    weekdays: string
    saturday: string
    sunday: string
  }
  logoUrl?: string
  brandColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal' | 'rose' | 'amber' | 'emerald' | 'cyan' | 'sky'
  headerStyle?: 'glass' | 'solid' | 'accent' | 'dark'
  headerColor?: string
  showTopBar?: boolean
  whatsapp?: string
  ruc?: string
  businessType?: string
  instagram?: string
  facebook?: string
  tiktok?: string
}

export interface HeroStats {
  repairs: string
  satisfaction: string
  avgTime: string
}

export interface HeroContent {
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
  price?: string      // e.g. "Desde $49.990"
  duration?: string   // e.g. "30-60 min"
  ctaUrl?: string     // optional link override per service
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

export interface MaintenanceMode {
  enabled: boolean
  title: string
  message: string
  estimatedEnd?: string
}

export interface PaymentMethodConfig {
  enabled: boolean
  label?: string
  instructions?: string
  // Transfer-specific
  bankAlias?: string
  bankCbu?: string
  bankName?: string
  // Digital wallet-specific
  walletAlias?: string
  qrImageUrl?: string
}

export interface DeliveryConfig {
  enabled: boolean
  defaultCost: number           // Gs. shown in cart by default
  freeThreshold: number         // 0 = always paid; >0 = free above this amount
  estimatedTime: string         // e.g. "30–60 min"
  zones?: string                // free-text description of zones covered
  instructions?: string         // extra info shown to customer
}

export interface PickupConfig {
  enabled: boolean
  estimatedTime: string         // e.g. "20–30 min"
  instructions?: string
}

export interface CheckoutSettings {
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
  hero_stats: HeroStats
  hero_content: HeroContent
  services: Service[]
  testimonials: Testimonial[]
  process_steps: ProcessStep[]
  maintenance_mode: MaintenanceMode
  checkout: CheckoutSettings
}

export type WebsiteSettingKey = keyof WebsiteSettings

