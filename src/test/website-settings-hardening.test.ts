import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getWebsiteDefaultsForVertical, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { BUSINESS_VERTICALS, OPERATING_MODELS } from '@/lib/organization/business-profile'
import { isSafeLinkOrPath, isWebsiteSettingKey, validateSetting } from '@/lib/validation/website-settings'
import { sanitizeText, sanitizeWebsiteSettings } from '@/lib/sanitization/html'
import { validateTenantSlug } from '@/lib/saas/reserved-slugs'
import { isCustomHeroTitle } from '@/lib/website/template-hero-titles'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/** Lo que guarda el panel: primero el sanitizador, después el esquema. */
const guardar = (key: string, value: unknown) => validateSetting(key, sanitizeWebsiteSettings(value))

describe('los valores predeterminados se pueden guardar', () => {
  /**
   * Las estadísticas de ejemplo («5.000+», «4.9★») no pasaban la validación:
   * una tienda que las tocaba sin cambiarlas no podía guardar la portada.
   */
  it('los de la plataforma y los de cada rubro pasan su propia validación', () => {
    const generic = getWebsiteSettingsDefaults() as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(generic)) {
      if (!isWebsiteSettingKey(key)) continue
      expect(guardar(key, value), `predeterminado ${key}`).toMatchObject({ success: true })
    }
    for (const vertical of BUSINESS_VERTICALS) {
      for (const model of OPERATING_MODELS) {
        const byVertical = getWebsiteDefaultsForVertical(vertical, model) as Record<string, unknown>
        for (const [key, value] of Object.entries(byVertical)) {
          const merged = value && typeof value === 'object' && !Array.isArray(value)
            ? { ...(generic[key] as object), ...(value as object) }
            : value
          expect(guardar(key, merged), `${vertical}/${model} ${key}`).toMatchObject({ success: true })
        }
      }
    }
  })

  it('las estadísticas aceptan las cifras de siempre y rechazan lo raro', () => {
    for (const cifra of ['5.000+', '4.9★', '99.5%', '30-45 min', 'En el día', '24/7', '1,5K']) {
      expect(guardar('hero_stats', { enabled: true, repairs: cifra, satisfaction: '99%', avgTime: '24h' }), cifra).toMatchObject({ success: true })
    }
    expect(guardar('hero_stats', { enabled: true, repairs: '{x}', satisfaction: '99%', avgTime: '24h' })).toMatchObject({ success: false })
  })

  /** Una tienda nueva mostraba «5.000+ reparaciones» sin haber vendido nada. */
  it('las estadísticas de ejemplo vienen apagadas en todos los rubros', () => {
    expect(getWebsiteSettingsDefaults().hero_stats.enabled).toBe(false)
    for (const vertical of BUSINESS_VERTICALS) {
      expect(getWebsiteDefaultsForVertical(vertical, 'retail').hero_stats?.enabled, vertical).toBe(false)
    }
  })
})

describe('guardar la empresa no cambia lo que no se tocó', () => {
  /** Con `default(false)`, guardar la empresa sin el campo apagaba «Cómo comprar». */
  it('no apaga «Cómo comprar» si el campo no viene', () => {
    const r = guardar('company_info', { name: 'Tienda Centro' })
    expect(r.success).toBe(true)
    expect((r as { data: Record<string, unknown> }).data).not.toHaveProperty('processSectionEnabled')
  })

  it('descarta campos inventados, conserva los conocidos', () => {
    const r = guardar('company_info', { name: 'Tienda Centro', repairTrackingEnabled: true, cualquierCosa: 'x'.repeat(5000) })
    expect((r as { data: Record<string, unknown> }).data).toEqual({ name: 'Tienda Centro', repairTrackingEnabled: true })
  })
})

describe('validaciones de lo que se muestra en la tienda', () => {
  it('el email tiene que ser un email', () => {
    expect(guardar('company_info', { email: 'no-es-mail' })).toMatchObject({ success: false, error: expect.stringContaining('email válido') })
    expect(guardar('company_info', { email: 'ventas@tienda.com.py' })).toMatchObject({ success: true })
  })

  it('las redes aceptan el usuario o el enlace del perfil', () => {
    for (const valor of ['@tienda.py', 'tienda_py', 'https://instagram.com/tienda.py', 'instagram.com/tienda']) {
      expect(guardar('company_info', { instagram: valor }), valor).toMatchObject({ success: true })
    }
    expect(guardar('company_info', { instagram: 'hola mundo' })).toMatchObject({ success: false })
  })

  /** Estos valores terminan en `href` o `src` de la tienda pública. */
  it('no se guardan enlaces javascript: ni data:', () => {
    expect(isSafeLinkOrPath('/ofertas')).toBe(true)
    expect(isSafeLinkOrPath('https://cdn.tienda.com/logo.png')).toBe(true)
    expect(isSafeLinkOrPath('javascript:alert(1)')).toBe(false)
    expect(isSafeLinkOrPath('//otro-sitio.com')).toBe(false)
    expect(isSafeLinkOrPath('data:image/png;base64,xx')).toBe(false)

    expect(guardar('company_info', { logoUrl: 'javascript:alert(1)' })).toMatchObject({ success: false })
    expect(guardar('brands_section', {
      enabled: true, title: 'Marcas', items: [{ id: '1', name: 'JBL', active: true, href: 'javascript:alert(1)' }],
    })).toMatchObject({ success: false })
    const checkout = getWebsiteSettingsDefaults().checkout
    expect(guardar('checkout', {
      ...checkout,
      payment: { ...checkout.payment, digital_wallet: { ...checkout.payment.digital_wallet, qrImageUrl: 'javascript:alert(1)' } },
    })).toMatchObject({ success: false })
    expect(guardar('announcements', [{
      enabled: false, images: [{ url: 'https://cdn/x.jpg', href: 'javascript:alert(1)' }],
    }])).toMatchObject({ success: false })
  })

  it('la portada y el mantenimiento se pueden apagar sin completar los textos', () => {
    expect(guardar('hero_content', { enabled: false, badge: '', title: '', subtitle: '' })).toMatchObject({ success: true })
    expect(guardar('hero_content', { enabled: true, badge: '', title: '', subtitle: '' })).toMatchObject({ success: false })
    expect(guardar('maintenance_mode', { enabled: false, title: '', message: '' })).toMatchObject({ success: true })
    expect(guardar('maintenance_mode', { enabled: true, title: '', message: '' })).toMatchObject({ success: false })
    expect(guardar('hero_stats', { enabled: false, repairs: '', satisfaction: '', avgTime: '' })).toMatchObject({ success: true })
  })

  it('los errores salen en castellano aunque el campo no tenga mensaje propio', () => {
    const r = guardar('offers_section', { ...getWebsiteSettingsDefaults().offers_section, eyebrow: 'x' })
    expect(r.success).toBe(false)
    expect((r as { error: string }).error).not.toMatch(/Too small|expected/i)
  })
})

describe('el sanitizador conserva los saltos de línea', () => {
  it('junta espacios pero no renglones', () => {
    expect(sanitizeText('Banco Itaú\r\nAlias:   tienda.py\n\n\n\nTitular: Ana  ')).toBe('Banco Itaú\nAlias: tienda.py\n\nTitular: Ana')
    expect(sanitizeText('<b>Hola</b>   <script>alert(1)</script>mundo')).toBe('Hola mundo')
  })
})

describe('direcciones y datos públicos', () => {
  /** Una tienda podía cambiar su dirección a `dashboard` y chocar con esa ruta. */
  it('cambiar la dirección aplica las mismas reservas que el registro', () => {
    expect(validateTenantSlug('dashboard')).toMatchObject({ ok: false, reason: 'reserved' })
    expect(validateTenantSlug('-tienda-')).toMatchObject({ ok: false })
    expect(leer('src/app/api/admin/website/sync-company/route.ts')).toContain('validateTenantSlug(canonicalSlug)')
  })

  it('la API pública manda el alias de billetera y no la configuración de crédito', () => {
    const api = leer('src/app/api/public/website/settings/route.ts')
    expect(api).toContain('walletAlias: normalized.checkout.payment.digital_wallet.walletAlias')
    expect(api).toContain('delete (normalized as Partial<WebsiteSettings>).product_credit_defaults')
  })

  it('el guardado por lote tiene límite y la inicialización usa el rubro', () => {
    const api = leer('src/app/api/admin/website/settings/route.ts')
    expect(api).toContain("rateLimiter.check(`website-settings:${context.user.id}`")
    expect(api).toContain('getWebsiteDefaultsForVertical(')
  })
})

describe('guía de configuración', () => {
  /** Comparaba contra un título viejo y daba por hecha la portada de plantilla. */
  it('la portada de cualquier plantilla no cuenta como hecha', () => {
    expect(isCustomHeroTitle(getWebsiteSettingsDefaults().hero_content.title)).toBe(false)
    expect(isCustomHeroTitle('Reparación profesional para tu equipo')).toBe(false)
    for (const vertical of BUSINESS_VERTICALS) {
      expect(isCustomHeroTitle(getWebsiteDefaultsForVertical(vertical, 'retail').hero_content?.title), vertical).toBe(false)
    }
    expect(isCustomHeroTitle('Celulares con garantía real en Luque')).toBe(true)
    expect(isCustomHeroTitle('')).toBe(false)
  })
})
