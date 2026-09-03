import { createAdminSupabase } from '@/lib/supabase/admin'

export type PlatformBranding = {
  platformName: string
  platformTagline: string
  logoUrl: string
  logoDarkUrl?: string
  faviconUrl?: string
  hideNavBrandText?: boolean
  hideNavTagline?: boolean
  logoHeight?: 'sm' | 'md' | 'lg' | 'xl'
  /** Alto exacto en px. Si esta definido, manda sobre `logoHeight`. */
  logoHeightPx?: number
  logoGlowDark?: boolean
  marketplaceName: string
  marketplaceTagline: string
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel: string
  secondaryCtaHref: string
  loginEyebrow: string
  loginSubtitle: string
  seoTitle: string
  seoDescription: string
  footerText: string
}

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  platformName: 'Plataforma',
  platformTagline: 'POS, inventario, marketplace y servicios',
  logoUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  hideNavBrandText: false,
  hideNavTagline: false,
  logoHeight: 'md',
  logoHeightPx: 0,
  logoGlowDark: true,
  marketplaceName: 'Marketplace',
  marketplaceTagline: 'Empresas y productos',
  primaryCtaLabel: 'Crear empresa',
  primaryCtaHref: '/register',
  secondaryCtaLabel: 'Ver productos',
  secondaryCtaHref: '/marketplace',
  loginEyebrow: 'Panel interno',
  loginSubtitle: 'Panel de administracion y staff',
  seoTitle: 'POS, inventario, marketplace y servicios',
  seoDescription: 'Plataforma SaaS multiempresa para POS, inventario, ecommerce, reparaciones, servicios y marketplace.',
  footerText: 'Una plataforma para operar POS, catalogos, servicios y marketplace.',
}

const BRANDING_KEY = 'saas_branding'

function readString(value: unknown, fallback: string, maxLength = 240) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, maxLength)
}

function readPath(value: unknown, fallback: string) {
  const path = readString(value, fallback, 500)
  if (!path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://')) {
    return fallback
  }
  return path
}

/** 0 significa "sin tamaño personalizado": manda el preset. */
function readLogoHeightPx(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  // Mismos limites que el control del formulario, para que un valor manipulado
  // no pueda romper la barra de navegacion con un logo gigante.
  return Math.min(96, Math.max(24, Math.round(parsed)))
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return fallback
}

export function normalizePlatformBranding(value: unknown): PlatformBranding {
  const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}

  const rawLogoHeight = readString(source.logoHeight, DEFAULT_PLATFORM_BRANDING.logoHeight || 'md', 10)
  const validHeight = (['sm', 'md', 'lg', 'xl'].includes(rawLogoHeight) ? rawLogoHeight : 'md') as 'sm' | 'md' | 'lg' | 'xl'

  return {
    platformName: readString(source.platformName, DEFAULT_PLATFORM_BRANDING.platformName, 80),
    platformTagline: readString(source.platformTagline, DEFAULT_PLATFORM_BRANDING.platformTagline, 140),
    logoUrl: readString(source.logoUrl, DEFAULT_PLATFORM_BRANDING.logoUrl, 500),
    logoDarkUrl: readString(source.logoDarkUrl, '', 500),
    faviconUrl: readString(source.faviconUrl, '', 500),
    hideNavBrandText: readBoolean(source.hideNavBrandText, DEFAULT_PLATFORM_BRANDING.hideNavBrandText || false),
    hideNavTagline: readBoolean(source.hideNavTagline, DEFAULT_PLATFORM_BRANDING.hideNavTagline || false),
    logoHeight: validHeight,
    logoHeightPx: readLogoHeightPx(source.logoHeightPx),
    logoGlowDark: readBoolean(source.logoGlowDark, DEFAULT_PLATFORM_BRANDING.logoGlowDark ?? true),
    marketplaceName: readString(source.marketplaceName, DEFAULT_PLATFORM_BRANDING.marketplaceName, 80),
    marketplaceTagline: readString(source.marketplaceTagline, DEFAULT_PLATFORM_BRANDING.marketplaceTagline, 140),
    primaryCtaLabel: readString(source.primaryCtaLabel, DEFAULT_PLATFORM_BRANDING.primaryCtaLabel, 50),
    primaryCtaHref: readPath(source.primaryCtaHref, DEFAULT_PLATFORM_BRANDING.primaryCtaHref),
    secondaryCtaLabel: readString(source.secondaryCtaLabel, DEFAULT_PLATFORM_BRANDING.secondaryCtaLabel, 50),
    secondaryCtaHref: readPath(source.secondaryCtaHref, DEFAULT_PLATFORM_BRANDING.secondaryCtaHref),
    loginEyebrow: readString(source.loginEyebrow, DEFAULT_PLATFORM_BRANDING.loginEyebrow, 80),
    loginSubtitle: readString(source.loginSubtitle, DEFAULT_PLATFORM_BRANDING.loginSubtitle, 120),
    seoTitle: readString(source.seoTitle, DEFAULT_PLATFORM_BRANDING.seoTitle, 160),
    seoDescription: readString(source.seoDescription, DEFAULT_PLATFORM_BRANDING.seoDescription, 240),
    footerText: readString(source.footerText, DEFAULT_PLATFORM_BRANDING.footerText, 180),
  }
}

export function getBrandingFromFeatures(features: unknown) {
  const record = typeof features === 'object' && features !== null ? features as Record<string, unknown> : {}
  return normalizePlatformBranding(record[BRANDING_KEY])
}

export function withBrandingInFeatures(features: unknown, branding: PlatformBranding) {
  const record = typeof features === 'object' && features !== null ? features as Record<string, unknown> : {}
  return {
    ...record,
    [BRANDING_KEY]: normalizePlatformBranding(branding),
  }
}

export async function getPlatformBranding() {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('system_settings')
    .select('features')
    .eq('id', 'system')
    .maybeSingle()

  return getBrandingFromFeatures((data as { features?: unknown } | null)?.features)
}
