import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeCatalogState } from '@/lib/public/catalog-state'
import { rubroLabel } from '@/lib/public/organization-rubro'
import { organizationAccentColor, organizationAccentSoft } from '@/lib/public/organization-brand'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const MARKETPLACE = leer('src/lib/public/marketplace.ts')
const SAAS = leer('src/components/saas/landing/saas-business-page-content.tsx')
const TARJETA = leer('src/components/public/OrganizationCard.tsx')
const DIRECTORIO = leer('src/components/public/OrganizationDirectoryCard.tsx')
const PERFIL = leer('src/app/marketplace/empresas/[slug]/page.tsx')

/**
 * «0 productos» y «Catálogo en preparación» tapaban tres situaciones distintas:
 * la tienda que no cargó nada, la que carga pero no publica —usa el sistema
 * puertas adentro— y la que publica pero se quedó sin stock.
 */
describe('el estado del catálogo dice cuál es', () => {
  it('cuenta lo publicado cuando hay', () => {
    expect(describeCatalogState({ products_count: 12, products_total: 30 }))
      .toMatchObject({ label: '12 productos', kind: 'published' })
  })

  it('el singular no dice «1 productos»', () => {
    expect(describeCatalogState({ products_count: 1, products_total: 1 }).label).toBe('1 producto')
  })

  it('distingue el catálogo interno del vacío', () => {
    // Decirle «en preparación» a un negocio con mil productos cargados para su
    // propia gestión es sencillamente falso.
    expect(describeCatalogState({ products_count: 0, products_total: 1000 }))
      .toMatchObject({ label: 'Catálogo interno', hint: 'No publica al marketplace', kind: 'internal' })

    expect(describeCatalogState({ products_count: 0, products_total: 0 }))
      .toMatchObject({ label: 'Catálogo en preparación', kind: 'empty' })
  })

  it('sin el total no afirma que sea interno', () => {
    // Quien no pasa `products_total` se queda con el mensaje neutro, en vez de
    // una afirmación que no puede sostener.
    expect(describeCatalogState({ products_count: 0 }).kind).toBe('empty')
  })

  it('se cuenta lo publicado y lo total por separado', () => {
    expect(MARKETPLACE).toContain('const productTotalByOrganization = new Map<string, number>()')
    expect(MARKETPLACE).toContain("row.visibility === 'public' && Number(row.stock_quantity ?? 0) > 0")
  })

  it('lo usan las dos tarjetas públicas', () => {
    expect(SAAS).toContain('describeCatalogState(store)')
    expect(DIRECTORIO).toContain('describeCatalogState(organization)')
  })
})

/**
 * En las tarjetas públicas este lugar lo ocupaba el plan contratado —«LITE»,
 * «PRO+», «ENTERPRISE»—, que le decía a cualquier visitante cuánto paga cada
 * comercio.
 */
describe('no se publica el plan que paga cada comercio', () => {
  it('ninguna pantalla pública lo muestra', () => {
    for (const [nombre, archivo] of [
      ['tarjeta del directorio', TARJETA],
      ['perfil de la tienda', PERFIL],
      ['landing de negocios', SAAS],
    ] as const) {
      expect(archivo, nombre).not.toContain('planStyles')
      expect(archivo, nombre).not.toContain('planClass')
    }
  })

  it('en su lugar va el rubro', () => {
    expect(TARJETA).toContain('rubroLabel(organization.rubro)')
    expect(PERFIL).toContain('rubroLabel(org.rubro)')
    expect(SAAS).toContain('rubroLabel(store.rubro)')
  })

  it('el rubro se traduce a algo legible', () => {
    expect(rubroLabel('tecnologia')).toBe('Tecnología')
    expect(rubroLabel('ferreteria')).toBe('Ferretería')
  })

  it('un rubro sin etiqueta propia se muestra igual', () => {
    // Es mejor que esconder el dato que la tienda cargó.
    expect(rubroLabel('jugueteria')).toBe('Jugueteria')
  })

  it('sin rubro no inventa una etiqueta', () => {
    expect(rubroLabel(null)).toBeNull()
    expect(rubroLabel('  ')).toBeNull()
  })
})

/**
 * `organizations` no tiene estado propio: la suspensión vive en la suscripción.
 */
describe('una tienda suspendida sale de la vitrina', () => {
  it('se filtra por el estado de la suscripción', () => {
    expect(MARKETPLACE).toContain("const ESTADOS_FUERA_DE_VITRINA = new Set(['past_due', 'canceled', 'suspended'])")
    expect(MARKETPLACE).toContain('organizationRows.filter((organization) => !excluidas.has(organization.id))')
  })

  it('tampoco le queda el perfil accesible por URL', () => {
    // Sin esto salía del listado pero su página seguía abierta.
    const perfil = MARKETPLACE.slice(MARKETPLACE.indexOf('export async function getPublicOrganizationPage'))
    expect(perfil.slice(0, 1500)).toContain("['past_due', 'canceled', 'suspended'].includes")
  })

  it('una organización sin suscripción no se excluye', () => {
    // Ya optó explícitamente por publicarse: excluirla por un dato faltante
    // vaciaría la sección sin que nadie sepa por qué.
    expect(MARKETPLACE).toContain('Una organizacion sin fila de suscripcion se deja pasar a')
  })
})

describe('la dirección lleva al mapa', () => {
  it('la tarjeta de negocios enlaza cuando hay mapa', () => {
    expect(SAAS).toContain('href={store.maps_url}')
    expect(SAAS).toContain('Ver «${store.name}» en el mapa')
  })

  it('sin mapa la muestra como texto, no como enlace roto', () => {
    const bloque = SAAS.slice(SAAS.indexOf('{store.address && ('))
    expect(bloque.slice(0, 1400)).toContain('store.maps_url ? (')
  })
})

/**
 * Todas las tarjetas eran cian. Ahora llevan el color que la tienda eligió para
 * su página pública, así el directorio anticipa lo que el visitante va a
 * encontrar si entra.
 */
describe('cada tienda con su color', () => {
  it('resuelve los colores del catálogo', () => {
    expect(organizationAccentColor({ brand_color: 'purple' })).toBe('#9333ea')
    expect(organizationAccentColor({ brand_color: 'EMERALD' })).toBe('#059669')
  })

  it('acepta el color personalizado', () => {
    expect(organizationAccentColor({ brand_color: 'custom', custom_brand_color: '#123abc' })).toBe('#123abc')
  })

  it('ignora un personalizado inválido en vez de romper el estilo', () => {
    expect(organizationAccentColor({ brand_color: 'custom', custom_brand_color: 'azulcito' })).toBeNull()
  })

  it('sin color configurado no inventa uno', () => {
    // Mejor que la tarjeta use el del sitio a inventarle uno por el nombre.
    expect(organizationAccentColor({})).toBeNull()
    expect(organizationAccentColor({ brand_color: 'no-existe' })).toBeNull()
  })

  it('el fondo tenue sale del mismo color, no de una segunda paleta', () => {
    // Dos listas separadas terminan desalineadas.
    expect(organizationAccentSoft('#2563eb')).toBe('rgba(37, 99, 235, 0.12)')
    expect(organizationAccentSoft('#abc')).toBe('rgba(170, 187, 204, 0.12)')
    expect(organizationAccentSoft(null)).toBeUndefined()
  })

  it('las dos tarjetas lo aplican', () => {
    expect(SAAS).toContain('organizationAccentColor(store)')
    expect(DIRECTORIO).toContain('organizationAccentColor(organization)')
  })
})

describe('se muestra el logo de la tienda', () => {
  it('la tarjeta y la cinta lo usan cuando existe', () => {
    expect([...SAAS.matchAll(/src=\{store\.logo_url\}/g)].length).toBe(2)
    expect(SAAS).toContain('alt={`Logo de ${store.name}`}')
  })

  it('las iniciales quedan como respaldo, no al revés', () => {
    expect(SAAS).toContain('{store.logo_url ? (')
    expect(SAAS).toContain('store.name.slice(0, 2).toUpperCase()')
  })

  it('el logo va sobre fondo claro y sin recortarse', () => {
    // Un logo con fondo transparente sobre el color de la marca queda invisible,
    // y `object-cover` le comeria los bordes.
    const bloque = SAAS.slice(SAAS.indexOf('{store.logo_url ? ('))
    expect(bloque.slice(0, 700)).toContain('bg-white')
    expect(bloque.slice(0, 700)).toContain('object-contain')
  })
})
