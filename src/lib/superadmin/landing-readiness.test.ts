import { describe, expect, it } from 'vitest'
import { assessLanding, normalizeHeroTitle, summarizeLandings } from './landing-readiness'

const PLANTILLA = new Set(['Los mejores productos al mejor precio', 'Reparación profesional para tu equipo'].map(normalizeHeroTitle))

const completa = {
  storefrontPublic: true,
  organizationLogoUrl: null,
  activeProducts: 40,
  templateHeroTitles: PLANTILLA,
  settings: [
    { key: 'company_info', value: { whatsapp: '0981 000 000', logoUrl: 'https://cdn/logo.png', address: 'Mcal. López 123', instagram: '@tienda' }, updated_at: '2026-09-01T10:00:00Z' },
    { key: 'hero_content', value: { enabled: true, title: 'Celulares con garantía real' }, updated_at: '2026-09-10T10:00:00Z' },
    { key: 'promotional_carousel', value: { enabled: true, slides: [{ active: true, imageUrl: 'https://cdn/1.jpg' }, { active: false, imageUrl: 'https://cdn/2.jpg' }] }, updated_at: null },
    { key: 'testimonials', value: [{ active: true }, { active: false }, { active: true }], updated_at: null },
  ],
}

const conAjuste = (key: string, value: unknown) => ({
  ...completa,
  settings: completa.settings.map((row) => (row.key === key ? { ...row, value } : row)),
})

describe('landing de una tienda', () => {
  it('una tienda completa está lista y suma todo', () => {
    const r = assessLanding(completa)
    expect(r.status).toBe('ready')
    expect(r.score).toBe(100)
    expect(r.activeSlides).toBe(1)
    expect(r.testimonials).toBe(2)
    expect(r.lastUpdatedAt).toBe('2026-09-10T10:00:00Z')
  })

  /**
   * Antes se comparaba contra un solo texto: la portada por defecto de otro
   * rubro contaba como personalizada.
   */
  it('la portada de cualquier plantilla no cuenta como propia', () => {
    const r = assessLanding(conAjuste('hero_content', { title: '  Reparación profesional  para tu equipo ' }))
    expect(r.heroCustom).toBe(false)
    expect(r.status).toBe('incomplete')
    expect(r.missingEssentials.map((c) => c.key)).toEqual(['hero'])
  })

  it('sin portada pero con banner propio, el banner cuenta como portada', () => {
    const r = assessLanding(conAjuste('hero_content', { enabled: false }))
    expect(r.checks.find((c) => c.key === 'hero')?.ok).toBe(true)
  })

  it('sin productos o sin contacto no está lista, aunque tenga lo demás', () => {
    expect(assessLanding({ ...completa, activeProducts: 0 }).missingEssentials.map((c) => c.key)).toEqual(['products'])
    const sinContacto = assessLanding(conAjuste('company_info', { logoUrl: 'x' }))
    expect(sinContacto.missingEssentials.map((c) => c.key)).toEqual(['contact'])
    // Dirección y redes suman, pero no bloquean.
    expect(sinContacto.checks.filter((c) => !c.ok && !c.essential).map((c) => c.key)).toEqual(['location', 'social'])
  })

  it('el logo de la organización también sirve', () => {
    const r = assessLanding({ ...conAjuste('company_info', { phone: '021' }), organizationLogoUrl: 'https://cdn/org.png' })
    expect(r.checks.find((c) => c.key === 'logo')?.ok).toBe(true)
  })

  it('mantenimiento y no publicada tienen prioridad sobre lo que falte', () => {
    const enMantenimiento = { ...completa, settings: [...completa.settings, { key: 'maintenance_mode', value: { enabled: true }, updated_at: null }] }
    expect(assessLanding(enMantenimiento).status).toBe('maintenance')
    expect(assessLanding({ ...completa, storefrontPublic: false }).status).toBe('hidden')
  })

  it('un banner sin imágenes no cuenta', () => {
    const r = assessLanding(conAjuste('promotional_carousel', { enabled: true, slides: [{ active: true, imageUrl: '' }] }))
    expect(r.checks.find((c) => c.key === 'banner')?.ok).toBe(false)
  })

  it('si no se pudieron contar los productos, no la da por completa', () => {
    expect(assessLanding({ ...completa, activeProducts: null }).checks.find((c) => c.key === 'products')?.ok).toBe(false)
  })

  it('resume cuántas tiendas cumplen cada cosa', () => {
    const s = summarizeLandings([assessLanding(completa), assessLanding({ ...completa, activeProducts: 0 })])
    expect(s.byStatus).toEqual({ maintenance: 0, hidden: 0, incomplete: 1, ready: 1 })
    expect(s.byCheck.products).toBe(1)
    expect(s.byCheck.contact).toBe(2)
    expect(s.heroCustom).toBe(2)
  })
})
