import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canOpenDashboard, loginHrefWithReturn } from '@/lib/auth/dashboard-access'

/**
 * La dueña de una tienda entra al catálogo público como cualquiera: a mirar su
 * vidriera, a mandarle un producto a un cliente, a comprar en otra tienda del
 * marketplace. Al iniciar sesión, el modal la mandaba derecho al panel y perdía
 * la página donde estaba. Ahora se queda, y el panel le queda ofrecido en el
 * menú de su perfil.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const MODAL = leer('src/components/public/AuthModal.tsx')
const ENCABEZADO = leer('src/components/public/PublicHeader.tsx')
const NAV_MARKETPLACE = leer('src/components/public/marketplace-public-nav.tsx')
const LOGIN_SISTEMA = leer('src/app/login/page.tsx')
const LOGIN_TIENDA = leer('src/app/[organizationSlug]/cliente/login/page.tsx')

describe('entrar desde la tienda o el marketplace no te saca de la página', () => {
  it('el modal ya no manda a nadie al panel', () => {
    expect(MODAL).not.toContain("router.push('/dashboard')")
    expect(MODAL).toContain('router.refresh()')
  })

  it('y avisa dónde quedó el panel, en vez de llevarte', () => {
    expect(MODAL).toContain('Tenés el panel en el menú de tu perfil.')
  })

  it('el ingreso del sistema vuelve a la página de origen', () => {
    expect(LOGIN_SISTEMA).toContain(
      "const redirectTo = rawRedirectParam ? sanitizeRedirectPath(rawRedirectParam) : '/dashboard'"
    )
    // La lista blanca vieja dejaba afuera a cualquier otra página pública.
    expect(LOGIN_SISTEMA).not.toContain('isCustomerOrOtherSection')
  })

  it('quien es del equipo puede simplemente seguir mirando la tienda', () => {
    expect(LOGIN_TIENDA).toContain('Seguir en la tienda')
    expect(LOGIN_TIENDA).toContain('Ir al panel interno')
  })
})

describe('el enlace de ingreso se lleva la página actual', () => {
  it('para volver ahí después de entrar', () => {
    expect(loginHrefWithReturn('/login', '/marketplace/productos', 'redirect')).toBe(
      '/login?redirect=%2Fmarketplace%2Fproductos'
    )
    expect(loginHrefWithReturn('/4g-celulares/cliente/login', '/4g-celulares/productos', 'next')).toBe(
      '/4g-celulares/cliente/login?next=%2F4g-celulares%2Fproductos'
    )
  })

  it('no se apunta a sí mismo ni a un sitio externo', () => {
    expect(loginHrefWithReturn('/login', '/login', 'redirect')).toBe('/login')
    expect(loginHrefWithReturn('/x/cliente/login', '/x/cliente/login', 'next')).toBe('/x/cliente/login')
    expect(loginHrefWithReturn('/login', 'https://otro-sitio.com', 'redirect')).toBe('/login')
    expect(loginHrefWithReturn('/login', '//otro-sitio.com', 'redirect')).toBe('/login')
    expect(loginHrefWithReturn('/login', null, 'redirect')).toBe('/login')
  })

  it('las barras públicas lo usan', () => {
    expect(ENCABEZADO).toContain("loginHrefWithReturn(`${tenantPrefix}/cliente/login`, pathname, 'next')")
    expect(ENCABEZADO).toContain("loginHrefWithReturn('/login', pathname, 'redirect')")
  })
})

describe('quién ve la entrada al panel', () => {
  it('la dueña de la tienda, que antes no la veía', () => {
    // El encabezado listaba admin, tecnico y vendedor: `owner` quedaba afuera.
    expect(canOpenDashboard({ role: 'owner' })).toBe(true)
    expect(canOpenDashboard({ role: 'admin' })).toBe(true)
    expect(canOpenDashboard({ role: 'super_admin' })).toBe(true)
    expect(canOpenDashboard({ role: 'vendedor' })).toBe(true)
    expect(canOpenDashboard({ role: 'tecnico' })).toBe(true)
    expect(canOpenDashboard({ role: 'inventory_manager' })).toBe(true)
  })

  it('y cualquiera que tenga un negocio, aunque su rol diga «cliente»', () => {
    expect(canOpenDashboard({ role: 'cliente', organization: { slug: '4g-celulares' } })).toBe(true)
  })

  it('un cliente común no', () => {
    expect(canOpenDashboard({ role: 'cliente' })).toBe(false)
    expect(canOpenDashboard({ role: 'cliente', organization: null })).toBe(false)
    expect(canOpenDashboard({})).toBe(false)
    expect(canOpenDashboard(null)).toBe(false)
  })

  it('las dos barras usan la misma definición, para no volver a desincronizarse', () => {
    expect(ENCABEZADO).toContain('const canAccessDashboard = canOpenDashboard(user)')
    expect(NAV_MARKETPLACE).toContain('const canAccessDashboard = canOpenDashboard(user)')
    expect(ENCABEZADO).not.toContain("user?.role === 'vendedor'")
    expect(NAV_MARKETPLACE).not.toContain("user?.role === 'vendedor'")
  })

  it('y el panel sigue estando en el menú', () => {
    expect(ENCABEZADO).toContain('Panel Administrativo')
    expect(ENCABEZADO).toContain('href="/dashboard"')
  })
})
