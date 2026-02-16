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
}

export interface Testimonial {
  id: string
  name: string
  rating: number
  comment: string
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
  maintenance_mode: MaintenanceMode
}

export type WebsiteSettingKey = keyof WebsiteSettings
