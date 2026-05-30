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

export interface WebsiteSettings {
  company_info: CompanyInfo
  hero_stats: HeroStats
  hero_content: HeroContent
  services: Service[]
  testimonials: Testimonial[]
  process_steps: ProcessStep[]
  maintenance_mode: MaintenanceMode
}

export type WebsiteSettingKey = keyof WebsiteSettings

