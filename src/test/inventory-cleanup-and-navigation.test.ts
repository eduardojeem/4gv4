import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { movementTypeAliases, normalizeMovementType } from '@/lib/inventory/movement-type'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const hay = (ruta: string) => existsSync(resolve(process.cwd(), ruta))
const PANTALLA = leer('src/components/admin/inventory/inventory-management.tsx')
const HOOK = leer('src/hooks/use-inventory.ts')
const PROVEEDORES = leer('src/components/admin/inventory/supplier-management.tsx')
const CONTROL = leer('src/components/admin/inventory/stock-control.tsx')
const MOVIMIENTOS = leer('src/components/admin/inventory/stock-movements.tsx')
const DROP_RPCS = leer('supabase/migrations/20260907140000_drop_unscoped_inventory_rpcs.sql')

/**
 * `movement_type` llega con nombres distintos segun quien escriba: `in`/`out`
 * de la RPC de ajuste, `transfer` de la de transferencia, `sale` del trigger de
 * venta, y hay historia en castellano. Habia dos traducciones separadas, una en
 * cada componente, con reglas propias.
 */
describe('una sola traduccion de los tipos de movimiento', () => {
  it('reconoce los nombres de todos los escritores', () => {
    expect(normalizeMovementType('in')).toBe('entrada')
    expect(normalizeMovementType('entry')).toBe('entrada')
    expect(normalizeMovementType('sale')).toBe('salida')
    expect(normalizeMovementType('out')).toBe('salida')
    expect(normalizeMovementType('transfer')).toBe('transferencia')
    expect(normalizeMovementType('branch_transfer')).toBe('transferencia')
    expect(normalizeMovementType('return')).toBe('devolucion')
    expect(normalizeMovementType('adjustment')).toBe('ajuste')
  })

  it('tolera espacios y mayusculas', () => {
    expect(normalizeMovementType('  SALE ')).toBe('salida')
  })

  it('lo desconocido cae en ajuste, pero en un solo lugar', () => {
    expect(normalizeMovementType('algo_nuevo')).toBe('ajuste')
    expect(normalizeMovementType(null)).toBe('ajuste')
  })

  it('el filtro pide a la base todos los alias del tipo', () => {
    expect(movementTypeAliases('salida')).toContain('sale')
    expect(movementTypeAliases('salida')).toContain('out')
  })

  it('los dos componentes la usan', () => {
    expect(MOVIMIENTOS).toContain("from '@/lib/inventory/movement-type'")
    expect(CONTROL).toContain("from '@/lib/inventory/movement-type'")
    expect(CONTROL).not.toContain("m.movement_type === 'entry' || m.movement_type === 'entrada'")
  })
})

describe('el codigo muerto ya no documenta reglas que nadie aplica', () => {
  it('la validacion que reemplazo ProductModal no esta', () => {
    // Exigia categoria y proveedor; hoy nadie la llama, y el proximo que lea el
    // archivo le iba a creer.
    expect(PANTALLA).not.toContain('const handleAddProduct')
    expect(PANTALLA).not.toContain('const handleEditProduct')
    expect(PANTALLA).not.toContain('const validateProduct')
    expect(PANTALLA).not.toContain('const getFieldError')
    expect(PANTALLA).not.toContain('const parseNumberInput')
    expect(PANTALLA).not.toContain('interface ValidationError')
  })

  it('las tres funciones de base sin llamadores tampoco', () => {
    // Ninguna filtraba por organization_id: su firma prometia «estadisticas del
    // inventario» sin decir de quien.
    expect(DROP_RPCS).toContain('DROP FUNCTION IF EXISTS public.get_inventory_stats()')
    expect(DROP_RPCS).toContain('DROP FUNCTION IF EXISTS public.get_products_with_alerts()')
    expect(DROP_RPCS).toContain('DROP FUNCTION IF EXISTS public.get_inventory_filtered(')
  })

  it('el buscador con resultados que nunca llegaban ya no tiene tipo', () => {
    expect(PANTALLA).not.toContain('interface SearchResult')
  })
})

describe('un solo useInventory por pantalla', () => {
  it('proveedores no vuelve a traer todo el catalogo', () => {
    expect(PROVEEDORES).toContain('useInventory({ loadProducts: false, loadStats: false })')
    expect(HOOK).toContain('loadProducts = true')
    expect(HOOK).toContain('if (!loadProducts) {')
  })

  it('y el alta de un proveedor se ve en el formulario de producto', () => {
    expect(PROVEEDORES).toContain('onSuppliersChanged?.()')
    expect(PANTALLA).toContain('<SupplierManagement onSuppliersChanged={refreshSuppliers} />')
  })

  it('sin catalogo, la pantalla no queda cargando para siempre', () => {
    expect(HOOK).toContain('setLoading(false)')
  })
})

describe('la pantalla se puede volver a encontrar', () => {
  it('la pestaña viaja en la URL', () => {
    // Diez secciones y `useState`: recargar te devolvia siempre a «Catalogo».
    expect(PANTALLA).toContain("new URLSearchParams(window.location.search).get('tab')")
    expect(PANTALLA).toContain("url.searchParams.set('tab', value)")
    expect(PANTALLA).toContain('window.history.replaceState')
  })

  it('solo acepta pestañas que existen', () => {
    expect(PANTALLA).toContain('INVENTORY_TAB_VALUES.has(desdeUrl')
  })

  it('«Catalogo» no ensucia la URL', () => {
    expect(PANTALLA).toContain("if (value === 'products') url.searchParams.delete('tab')")
  })
})

describe('la tabla ordena y pagina como se espera', () => {
  it('las cabeceras ordenan por lo que la API ya aceptaba', () => {
    expect(PANTALLA).toContain('<SortableHeader column="name"')
    expect(PANTALLA).toContain('<SortableHeader column="stock"')
    expect(PANTALLA).toContain('<SortableHeader column="price"')
    expect(HOOK).toContain('sort: sort.column')
    expect(HOOK).toContain('direction: sort.direction')
    expect(HOOK).not.toContain("sort: 'created_at',\n        direction: 'desc',")
  })

  it('el orden se anuncia a un lector de pantalla', () => {
    expect(PANTALLA).toContain('aria-sort={active ?')
  })

  it('cambiar el orden vuelve a la primera pagina', () => {
    const bloque = HOOK.slice(HOOK.indexOf('setPage(1)\n  }, ['))
    expect(bloque).toContain('sort.column')
  })

  it('se puede elegir cuantas filas ver', () => {
    // Con 10 fijas, revisar 400 productos eran 40 clics.
    expect(PANTALLA).toContain('setPageSize(Number(value))')
    expect(PANTALLA).toContain('por página')
  })

  it('la paginacion dice donde estas y deja saltar a los extremos', () => {
    expect(PANTALLA).toContain('Página {page} de {totalPages}')
    expect(PANTALLA).toContain('aria-label="Primera página"')
    expect(PANTALLA).toContain('aria-label="Última página"')
  })
})

describe('la pantalla se puede usar en un celular', () => {
  it('la tabla se cambia por tarjetas', () => {
    expect(PANTALLA).toContain('className="hidden overflow-x-auto md:block"')
    expect(PANTALLA).toContain('md:hidden')
  })

  it('las tarjetas tambien muestran carga y vacio', () => {
    // Los dos estados vivian dentro del `tbody`, que en movil queda oculto.
    const movil = PANTALLA.slice(PANTALLA.indexOf('md:hidden'))
    expect(movil).toContain('Cargando catálogo...')
    expect(movil).toContain('<EmptyState')
  })
})

describe('un solo sistema de color', () => {
  it('los dialogos dejan de usar un tercer tono propio', () => {
    expect(PANTALLA).not.toContain('dark:bg-gray-800')
    expect(PANTALLA).not.toContain('dark:border-gray-700')
  })
})

describe('la guia dice lo que el sistema hace', () => {
  it('ya no promete una auditoria que no existia', () => {
    // «Usa ajustes o transferencias para modificar stock de forma auditada» era
    // literalmente falso: el ajuste se escribia y nadie podia leerlo.
    expect(PANTALLA).not.toContain('Usa ajustes o transferencias para modificar stock de forma auditada')
    // La guia vive ahora en su propio componente, con ejemplos.
    const GUIA = leer('src/components/admin/inventory/InventoryGuide.tsx')
    expect(GUIA).toContain('Las ventas no se cargan a mano')
  })
})

describe('el modulo compartido existe donde se espera', () => {
  it('vive en lib/inventory, con el resto de la logica de stock', () => {
    expect(hay('src/lib/inventory/movement-type.ts')).toBe(true)
    expect(hay('src/lib/inventory/stock-status.ts')).toBe(true)
    expect(hay('src/lib/inventory/export.ts')).toBe(true)
  })
})
