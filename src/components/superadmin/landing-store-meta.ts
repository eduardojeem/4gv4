import type { LandingAssessment, LandingStatus } from '@/lib/superadmin/landing-readiness'

/** Lo que comparten la lista de tiendas y el detalle de una tienda. */

export type LandingStoreRowData = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  brandColor?: string | null
  customBrandColor?: string | null
  plan?: string | null
  /** `organizations.business_vertical`. */
  vertical?: string | null
  marketplacePublic: boolean
  activeProducts: number | null
  assessment: LandingAssessment
}

export const STATUS_PILLS: Record<LandingStatus, { label: string; pill: string; text: string; bar: string }> = {
  ready: { label: 'Lista para vender', pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  incomplete: { label: 'Incompleta', pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  hidden: { label: 'No publicada', pill: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', bar: 'bg-muted-foreground/50' },
  maintenance: { label: 'En mantenimiento', pill: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
}
