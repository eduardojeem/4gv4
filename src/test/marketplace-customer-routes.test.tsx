import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileFavoritesWidget } from '@/components/profile/profile-favorites-widget'
import {
  getTenantSlugFromPath,
  getTenantSlugFromPathname,
  isReservedTenantSlug,
} from '@/lib/saas/tenant'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const hay = (ruta: string) => existsSync(resolve(process.cwd(), ruta))

/**
 * El slug de la tienda sale del primer segmento del path: `/una-tienda/perfil`
 * da `una-tienda`. Al colgar las pantallas del cliente de `/marketplace`, ese
 * primer segmento pasaba a leerse como el nombre de una tienda: el proxy ponia
 * `x-tenant-slug: marketplace`, la pagina lo buscaba en la base, no existia, y
 * terminaba en 404 —o mandaba el login a `/marketplace/cliente/login`—.
 */
describe('marketplace no es el nombre de una tienda', () => {
  it('los segmentos de la app no son slugs', () => {
    expect(isReservedTenantSlug('marketplace')).toBe(true)
    expect(isReservedTenantSlug('MARKETPLACE')).toBe(true)
    expect(isReservedTenantSlug('dashboard')).toBe(true)
    expect(isReservedTenantSlug('api')).toBe(true)
    expect(isReservedTenantSlug('una-tienda')).toBe(false)
    expect(isReservedTenantSlug('')).toBe(false)
    expect(isReservedTenantSlug(null)).toBe(false)
  })

  it('las rutas del marketplace no resuelven tienda', () => {
    expect(getTenantSlugFromPath('/marketplace/perfil')).toBeNull()
    expect(getTenantSlugFromPath('/marketplace/mis-reparaciones')).toBeNull()
    expect(getTenantSlugFromPath('/marketplace/track')).toBeNull()
    expect(getTenantSlugFromPathname('/marketplace/perfil')).toBe('')
  })

  it('las de una tienda siguen resolviendo igual', () => {
    expect(getTenantSlugFromPath('/una-tienda/perfil')).toBe('una-tienda')
    expect(getTenantSlugFromPath('/una-tienda/mis-reparaciones')).toBe('una-tienda')
    expect(getTenantSlugFromPathname('/una-tienda/perfil')).toBe('una-tienda')
  })

  it('un path que no es de tienda sigue sin resolver', () => {
    expect(getTenantSlugFromPath('/marketplace')).toBeNull()
    expect(getTenantSlugFromPath('/una-tienda/algo-que-no-es-seccion')).toBeNull()
  })

  it('el proxy no busca en la base una organizacion llamada marketplace', () => {
    const PROXY = leer('src/proxy.ts')
    expect(PROXY).toContain('isReservedTenantSlug(maybeSlug) || !isTenantPublicSection(section)')
  })
})

/**
 * El menu del marketplace mandaba a `/perfil`, que vive en el grupo `(public)`
 * y se pinta con la vidriera de la tienda por defecto: nav de `/inicio` y
 * `/productos`, pie con el nombre de esa tienda y ninguna vuelta al
 * marketplace. Los datos eran correctos; la cascara no.
 */
describe('el perfil del marketplace vive dentro del marketplace', () => {
  it('existen las pantallas del cliente bajo /marketplace', () => {
    expect(hay('src/app/marketplace/perfil/page.tsx')).toBe(true)
    expect(hay('src/app/marketplace/mis-reparaciones/page.tsx')).toBe(true)
    expect(hay('src/app/marketplace/perfil/creditos/page.tsx')).toBe(true)
    expect(hay('src/app/marketplace/perfil/autorizados/page.tsx')).toBe(true)
    expect(hay('src/app/marketplace/track/page.tsx')).toBe(true)
  })

  it('reusan la misma pagina, no una copia', () => {
    // Si algun dia se duplican, las dos versiones se van a separar sin que nadie
    // lo note hasta que una muestre datos distintos que la otra.
    expect(leer('src/app/marketplace/perfil/page.tsx')).toContain(
      "import CustomerProfilePage from '@/app/(public)/perfil/page'"
    )
    expect(leer('src/app/marketplace/mis-reparaciones/page.tsx')).toContain(
      "import MisReparacionesPage from '@/app/(public)/mis-reparaciones/page'"
    )
  })

  it('le pasan el prefijo para que los enlaces no salgan', () => {
    expect(leer('src/app/marketplace/perfil/page.tsx')).toContain('basePath="/marketplace"')
    expect(leer('src/app/marketplace/mis-reparaciones/page.tsx')).toContain('basePath="/marketplace"')
  })

  it('el menu del marketplace ya no manda afuera', () => {
    const NAV = leer('src/components/public/marketplace-public-nav.tsx')
    expect(NAV).not.toContain('href="/perfil"')
    expect(NAV).not.toContain('href="/mis-reparaciones"')
    expect(NAV).toContain('href="/marketplace/perfil"')
    expect(NAV).toContain('href="/marketplace/mis-reparaciones"')
  })
})

/**
 * El prefijo de los enlaces y el de la tienda dejaron de ser lo mismo: en el
 * marketplace no hay tienda pero las pantallas cuelgan de `/marketplace`.
 * Mezclarlos hacia que `PublicStoreCredit` consultara una tienda llamada
 * «marketplace».
 */
describe('el prefijo de los enlaces se separa del de la tienda', () => {
  const CLIENTE = leer('src/app/(public)/perfil/profile-client.tsx')

  it('los enlaces usan linkPrefix', () => {
    expect(CLIENTE).toContain('linkPrefix = tenantPrefix')
    expect(CLIENTE).toContain('<ProfileQuickActions role={profile.role || \'cliente\'} tenantPrefix={linkPrefix} />')
    expect(CLIENTE).toContain('<ProfileActivity repairs={recentRepairs} tenantPrefix={linkPrefix} />')
  })

  it('el saldo de tienda sigue atado a la tienda, no al prefijo', () => {
    // Con linkPrefix seria `?org=marketplace`: una tienda que no existe.
    expect(CLIENTE).toContain('{tenantPrefix && (')
    expect(CLIENTE).toContain("organizationSlug={tenantPrefix.replace(/^\\//, '') || null}")
  })

  it('la lista de reparaciones separa los dos prefijos', () => {
    const PAGINA = leer('src/app/(public)/mis-reparaciones/page.tsx')
    // El slug de la tienda tiene que salir de `tenantPrefix`: con `linkPrefix`
    // seria «marketplace» y la pagina haria notFound().
    expect(PAGINA).toContain("const tenantSlug = tenantPrefix.replace('/', '') || headerStore.get('x-tenant-slug')")
    expect(PAGINA).toContain("const repairsHref = prefixPublicTenantPath(linkPrefix, '/mis-reparaciones')")
  })
})

describe('los favoritos del perfil se quedan donde esta la persona', () => {
  it('en una tienda, van a la de esa tienda', () => {
    render(<ProfileFavoritesWidget linkPrefix="/tienda-a" />)
    expect(screen.getByRole('link', { name: /Ver todos/i })).toHaveAttribute('href', '/tienda-a/favoritos')
  })

  it('en el marketplace, a la del marketplace', () => {
    render(<ProfileFavoritesWidget linkPrefix="/marketplace" />)
    expect(screen.getByRole('link', { name: /Ver todos/i })).toHaveAttribute('href', '/marketplace/favoritos')
  })

  it('sin prefijo sigue yendo al marketplace', () => {
    // La vidriera por defecto no tiene pagina de favoritos propia.
    render(<ProfileFavoritesWidget />)
    expect(screen.getByRole('link', { name: /Ver todos/i })).toHaveAttribute('href', '/marketplace/favoritos')
  })
})
