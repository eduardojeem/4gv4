import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RepairStoreFilter } from '@/components/public/repairs/repair-store-filter'
import { buildCustomerRepairsHref, parseCustomerRepairsQuery } from '@/lib/public/customer-repairs'

const PAGINA = readFileSync(resolve(process.cwd(), 'src/app/(public)/mis-reparaciones/page.tsx'), 'utf8')

const TIENDAS = [
  { id: 'a', name: 'Precimax Celulares', slug: 'precimax-celulares' },
  { id: 'b', name: 'Servicio Tecnico Don Jose', slug: 'don-jose' },
]

/**
 * Desde el marketplace la lista junta los equipos de todas las tiendas donde la
 * persona tiene ficha, y no habia forma de saber de cual era cada uno: la
 * etiqueta del taller solo aparecia cuando habia mas de uno, asi que con una
 * sola tienda la pregunta seguia sin respuesta.
 */
describe('cada equipo dice de que taller es', () => {
  it('la etiqueta se muestra siempre fuera de una tienda', () => {
    expect(PAGINA).toContain('const showStorePerRepair = !organization')
    expect(PAGINA).not.toContain('!organization && repairStoreIds.length > 1')
  })

  it('adentro de una tienda no se repite', () => {
    // Todo lo listado es de ella: la etiqueta seria la misma en cada tarjeta.
    const bloque = PAGINA.slice(PAGINA.indexOf('const showStorePerRepair'))
    expect(bloque.slice(0, 60)).toContain('!organization')
  })
})

describe('el filtro por taller', () => {
  it('acepta un slug valido y descarta basura', () => {
    expect(parseCustomerRepairsQuery({ store: 'don-jose' }).store).toBe('don-jose')
    expect(parseCustomerRepairsQuery({ store: '  DON-JOSE ' }).store).toBe('don-jose')
    expect(parseCustomerRepairsQuery({ store: '../otra' }).store).toBeNull()
    expect(parseCustomerRepairsQuery({ store: "a' or 1=1--" }).store).toBeNull()
    expect(parseCustomerRepairsQuery({}).store).toBeNull()
  })

  it('viaja en el enlace junto con el estado y la pagina', () => {
    expect(buildCustomerRepairsHref('/marketplace/mis-reparaciones', 'all', 1, 'don-jose')).toBe(
      '/marketplace/mis-reparaciones?store=don-jose'
    )
    expect(buildCustomerRepairsHref('/marketplace/mis-reparaciones', 'ready', 2, 'don-jose')).toBe(
      '/marketplace/mis-reparaciones?store=don-jose&status=ready&page=2'
    )
  })

  it('sin taller el enlace queda como estaba', () => {
    expect(buildCustomerRepairsHref('/marketplace/mis-reparaciones', 'all', 1)).toBe(
      '/marketplace/mis-reparaciones'
    )
  })

  it('el slug se resuelve contra los talleres de esta persona', () => {
    // Un slug ajeno pasa la validacion de formato pero no encuentra tienda, asi
    // que no filtra por un `organization_id` que no le corresponde.
    expect(PAGINA).toContain('storesForFilter.find((store) => store.slug === parsedQuery.store)')
  })

  it('filtra el listado y tambien los contadores', () => {
    // Si solo filtrara el listado, los chips de estado seguirian contando las
    // reparaciones de los otros talleres y los numeros no cerrarian.
    expect(PAGINA).toContain("if (selectedStore) repairsQuery = repairsQuery.eq('organization_id', selectedStore.id)")
    expect(PAGINA).toContain('const counts = scopedFinancialRepairs.reduce(')
    expect(PAGINA).toContain('repairs: scopedFinancialRepairs,')
  })

  it('el encabezado dice que taller se esta mirando', () => {
    expect(PAGINA).toContain('`Reparaciones en ${selectedStore.name}`')
  })

  it('solo aparece cuando hay mas de un taller', () => {
    expect(PAGINA).toContain('{storesForFilter.length > 1 && (')
  })
})

describe('los chips del filtro', () => {
  it('conservan el estado elegido al cambiar de taller', () => {
    render(
      <RepairStoreFilter
        stores={TIENDAS}
        counts={new Map([['a', 5], ['b', 2]])}
        total={7}
        selectedStoreId={null}
        status="ready"
        baseHref="/marketplace/mis-reparaciones"
      />
    )

    expect(screen.getByRole('link', { name: /Precimax Celulares/ })).toHaveAttribute(
      'href',
      '/marketplace/mis-reparaciones?store=precimax-celulares&status=ready'
    )
    // Volver a «todos» tampoco pierde el estado.
    expect(screen.getByRole('link', { name: /Todos los talleres/ })).toHaveAttribute(
      'href',
      '/marketplace/mis-reparaciones?status=ready'
    )
  })

  it('marcan cual esta activo para lectores de pantalla', () => {
    render(
      <RepairStoreFilter
        stores={TIENDAS}
        counts={new Map([['a', 5], ['b', 2]])}
        total={7}
        selectedStoreId="b"
        status="all"
        baseHref="/marketplace/mis-reparaciones"
      />
    )

    expect(screen.getByRole('link', { name: /Servicio Tecnico Don Jose/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Todos los talleres/ })).not.toHaveAttribute('aria-current')
  })

  it('muestra cuantos equipos hay en cada uno', () => {
    render(
      <RepairStoreFilter
        stores={TIENDAS}
        counts={new Map([['a', 5]])}
        total={5}
        selectedStoreId={null}
        status="all"
        baseHref="/marketplace/mis-reparaciones"
      />
    )

    // Un taller sin equipos en el conteo muestra 0, no vacio. JSX no deja
    // espacio entre los spans, asi que el nombre accesible los pega.
    expect(screen.getByRole('link', { name: /Servicio Tecnico Don Jose\s*0/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Precimax Celulares\s*5/ })).toBeInTheDocument()
  })
})
