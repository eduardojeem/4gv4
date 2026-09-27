/**
 * Qué tan lista está la landing pública de cada tienda.
 *
 * La pantalla anterior contaba «hero personalizado» comparando contra un solo
 * texto de plantilla, así que una tienda con la portada por defecto de su rubro
 * figuraba como personalizada. Y medía el contenido suelto, no lo que un
 * visitante necesita para comprar: que la tienda esté publicada, tenga
 * productos y una forma de contactarla.
 */

export type LandingCheckKey =
  | 'published'
  | 'products'
  | 'contact'
  | 'logo'
  | 'hero'
  | 'banner'
  | 'location'
  | 'social'

export type LandingCheck = {
  key: LandingCheckKey
  label: string
  ok: boolean
  /** Imprescindible para vender; el resto suma, pero no bloquea. */
  essential: boolean
  /** Qué hacer cuando falta. */
  hint: string
}

export type LandingStatus = 'maintenance' | 'hidden' | 'incomplete' | 'ready'

export type LandingAssessment = {
  status: LandingStatus
  checks: LandingCheck[]
  /** Checks cumplidos sobre el total, de 0 a 100. */
  score: number
  missingEssentials: LandingCheck[]
  heroTitle: string | null
  heroCustom: boolean
  activeSlides: number
  testimonials: number
  trustItems: number
  brandItems: number
  offersEnabled: boolean
  processSteps: number
  lastUpdatedAt: string | null
}

type SettingsRow = { key: string; value: unknown; updated_at: string | null }

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function normalizeHeroTitle(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, ' ')
}

export function assessLanding(input: {
  storefrontPublic: boolean | null
  organizationLogoUrl: string | null
  activeProducts: number | null
  settings: SettingsRow[]
  /** Títulos de portada que vienen de la plantilla, ya normalizados. */
  templateHeroTitles: Set<string>
}): LandingAssessment {
  const byKey = new Map(input.settings.map((row) => [row.key, row.value]))
  const company = record(byKey.get('company_info'))
  const hero = record(byKey.get('hero_content'))
  const carousel = record(byKey.get('promotional_carousel'))
  const maintenance = record(byKey.get('maintenance_mode'))
  const trustBar = record(byKey.get('trust_bar'))
  const brands = record(byKey.get('brands_section'))
  const offers = record(byKey.get('offers_section'))

  const heroTitle = text(hero.title) || null
  const heroCustom = Boolean(heroTitle && !input.templateHeroTitles.has(normalizeHeroTitle(heroTitle)))
  const activeSlides = list(carousel.slides).filter((slide) => {
    const s = record(slide)
    return s.active !== false && text(s.imageUrl)
  }).length
  const bannerVisible = carousel.enabled !== false && activeSlides > 0

  const checks: LandingCheck[] = [
    {
      key: 'published',
      label: 'Publicada',
      ok: input.storefrontPublic === true,
      essential: true,
      hint: 'La tienda no es pública: nadie puede entrar a la landing.',
    },
    {
      key: 'products',
      label: 'Productos',
      ok: (input.activeProducts ?? 0) > 0,
      essential: true,
      hint: 'No tiene productos activos: la landing no muestra nada para comprar.',
    },
    {
      key: 'contact',
      label: 'WhatsApp o teléfono',
      ok: Boolean(text(company.whatsapp) || text(company.phone)),
      essential: true,
      hint: 'Sin WhatsApp ni teléfono, un visitante no tiene cómo consultar.',
    },
    {
      key: 'logo',
      label: 'Logo',
      ok: Boolean(text(company.logoUrl) || text(input.organizationLogoUrl)),
      essential: true,
      hint: 'Sin logo la tienda se muestra con la inicial.',
    },
    {
      key: 'hero',
      label: 'Portada propia',
      // Sin portada pero con banner propio, el banner encabeza la página.
      ok: heroCustom || (hero.enabled === false && bannerVisible),
      essential: true,
      hint: heroTitle ? 'La portada usa el texto de la plantilla.' : 'No cargó la portada: se ve la de la plantilla.',
    },
    {
      key: 'banner',
      label: 'Banner con imágenes',
      ok: bannerVisible,
      essential: false,
      hint: 'Sin banner propio con imágenes.',
    },
    {
      key: 'location',
      label: 'Dirección',
      ok: Boolean(text(company.address)),
      essential: false,
      hint: 'Sin dirección: no se puede ubicar el local.',
    },
    {
      key: 'social',
      label: 'Redes sociales',
      ok: Boolean(text(company.instagram) || text(company.facebook) || text(company.tiktok)),
      essential: false,
      hint: 'Sin Instagram, Facebook ni TikTok.',
    },
  ]

  const missingEssentials = checks.filter((check) => check.essential && !check.ok)
  const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100)

  const status: LandingStatus = maintenance.enabled === true
    ? 'maintenance'
    : input.storefrontPublic !== true
      ? 'hidden'
      : missingEssentials.length > 0
        ? 'incomplete'
        : 'ready'

  const lastUpdatedAt = input.settings
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null

  return {
    status,
    checks,
    score,
    missingEssentials,
    heroTitle,
    heroCustom,
    activeSlides,
    testimonials: list(byKey.get('testimonials')).filter((item) => record(item).active !== false).length,
    trustItems: trustBar.enabled === false ? 0 : list(trustBar.items).length,
    brandItems: brands.enabled === false ? 0 : list(brands.items).length,
    offersEnabled: byKey.has('offers_section') && offers.enabled !== false,
    processSteps: list(byKey.get('process_steps')).length,
    lastUpdatedAt,
  }
}

export type LandingSummary = {
  total: number
  byStatus: Record<LandingStatus, number>
  /** Cuántas tiendas cumplen cada check. */
  byCheck: Record<LandingCheckKey, number>
  heroCustom: number
}

export function summarizeLandings(assessments: LandingAssessment[]): LandingSummary {
  const byStatus: Record<LandingStatus, number> = { maintenance: 0, hidden: 0, incomplete: 0, ready: 0 }
  const byCheck = {} as Record<LandingCheckKey, number>
  let heroCustom = 0

  for (const assessment of assessments) {
    byStatus[assessment.status] += 1
    if (assessment.heroCustom) heroCustom += 1
    for (const check of assessment.checks) {
      byCheck[check.key] = (byCheck[check.key] ?? 0) + (check.ok ? 1 : 0)
    }
  }

  return { total: assessments.length, byStatus, byCheck, heroCustom }
}
