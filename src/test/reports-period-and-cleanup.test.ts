import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const hay = (ruta: string) => existsSync(resolve(process.cwd(), ruta))

const REPORTES = leer('src/app/dashboard/reports/page.tsx')
const EXPORTADOR = leer('src/lib/reports/section-pdf-exporter.ts')

/**
 * El informe de reparaciones filtraba por `created_at` —cuando ingreso el
 * equipo— pero leia el estado de HOY. Eso responde «de las que entraron,
 * cuantas ya entregamos», no «cuantas entregamos». Un equipo que entro antes
 * del periodo y se entrego dentro no aparecia en ningun lado, y el mismo
 * informe daba distinto segun el dia en que se lo bajaba.
 */
describe('el informe distingue ingresadas de entregadas', () => {
  it('consulta las entregas por su propia fecha', () => {
    expect(REPORTES).toContain(".eq('status', 'entregado')")
    expect(REPORTES).toContain(".gte('delivered_at', dateRange.from.toISOString())")
    expect(REPORTES).toContain(".lte('delivered_at', dateRange.to.toISOString())")
  })

  it('sigue respetando la sucursal elegida', () => {
    // La consulta original pasa por `withBranchFilter`; la nueva tambien, o los
    // dos numeros hablarian de universos distintos.
    const bloque = REPORTES.slice(
      REPORTES.indexOf('Segunda lectura'),
      REPORTES.indexOf('const deliveredInPeriod')
    )
    expect(bloque).toContain('withBranchFilter(')
    expect(bloque).toContain('selectedBranchId')
  })

  it('si la fecha no esta cargada avisa en vez de mostrar cero', () => {
    // Un cero se lee como «no entregamos nada»; null permite no mostrar la cifra.
    expect(REPORTES).toContain('const deliveredInPeriod = deliveredError ? null : (deliveredData ?? []).length')
    expect(REPORTES).toContain('deliveredInPeriod: number | null')
  })

  it('la pantalla muestra las dos lecturas', () => {
    expect(REPORTES).toContain("{ label: 'Ingresadas en el período'")
    expect(REPORTES).toContain("{ label: 'Entregadas / ingresadas'")
    expect(REPORTES).toContain("repairsMetrics.deliveredInPeriod !== null ? [")
  })

  it('el PDF tambien, y explica la diferencia', () => {
    expect(EXPORTADOR).toContain("'Ingresadas en el Período': formatNumber(params.metrics.total)")
    expect(EXPORTADOR).toContain("'Ya Entregadas (de las ingresadas)': formatNumber(params.metrics.completed)")
    expect(EXPORTADOR).toContain("'Entregadas en el Período': formatNumber(params.metrics.deliveredInPeriod)")
    expect(EXPORTADOR).toContain('no cambia si se vuelve a bajar el informe mas adelante')
  })

  it('las etiquetas viejas, que no decian que median, ya no estan', () => {
    expect(EXPORTADOR).not.toContain("'Órdenes Totales'")
    expect(EXPORTADOR).not.toContain("'Finalizadas / Entregadas'")
  })
})

/**
 * El carrito guarda solo el slug, y el panel armaba un nombre capitalizando cada
 * palabra: `servicio-tecnico-don-jose` salia «Servicio Tecnico Don Jose». Se
 * parece a un nombre pero no es el nombre.
 */
describe('los carritos ya no inventan el nombre de la tienda', () => {
  const CARRITOS = leer('src/components/profile/profile-store-carts.tsx')

  it('usa el nombre real que guardan los favoritos', () => {
    expect(CARRITOS).toContain("import { useFavorites } from '@/lib/public/favorites-store'")
    expect(CARRITOS).toContain('if (favorite.slug && favorite.store) map.set(favorite.slug, favorite.store)')
  })

  it('sin nombre real muestra el slug, no un titulo inventado', () => {
    expect(CARRITOS).toContain('return realNames.get(slug) || slug')
    expect(CARRITOS).not.toContain(".map((word) => word.charAt(0).toUpperCase() + word.slice(1))")
  })
})

describe('un solo buscador de clientes en todo el panel', () => {
  it('la pestaña de creditos usa el modulo compartido', () => {
    const CREDITOS = leer('src/components/dashboard/customers/CustomerActiveCreditsTab.tsx')
    expect(CREDITOS).toContain("import { searchCustomers } from '@/lib/customers/search'")
    expect(CREDITOS).toContain('return searchCustomers(byStatus, searchTerm)')
    // El `includes` crudo que no ignoraba tildes ni normalizaba telefonos.
    expect(CREDITOS).not.toContain('const matchesName = c.name?.toLowerCase().includes(term)')
  })

  it('el buscador muerto ya no esta', () => {
    // 318 lineas con reglas propias y cero importadores: existir alcanzaba para
    // confundir a quien buscara donde se filtra.
    expect(hay('src/hooks/use-customer-search.ts')).toBe(false)
  })
})

describe('el marketplace no enlaza a una ruta que no existe', () => {
  it('«Ver todas las tiendas» va a /marketplace/empresas', () => {
    const PRODUCTOS = leer('src/app/marketplace/productos/page.tsx')
    expect(PRODUCTOS).toContain('<Link href="/marketplace/empresas">')
    expect(PRODUCTOS).not.toContain('/marketplace/tiendas')
  })
})
