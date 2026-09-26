import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadBranchInventoryStockMap } from '@/lib/branches/inventory'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const MIGRACION = leer('supabase/migrations/20260907120000_inventory_movement_traceability.sql')
const PRODUCTOS_API = leer('src/app/api/products/route.ts')
const PRODUCTO_API = leer('src/app/api/products/[id]/route.ts')
const CONTROL = leer('src/components/admin/inventory/stock-control.tsx')
const REPORTES = leer('src/components/admin/reports/inventory-reports.tsx')

/**
 * La pestaña «Movimientos» se veía vacía aunque el stock se moviera todos los
 * días, por tres fallas encadenadas: la venta no escribía movimiento; el ajuste
 * sí lo escribía pero sin `organization_id`; y la política de lectura es
 * `has_org_permission(organization_id, …)`, que con NULL nunca es verdadera. La
 * fila se escribía y quedaba invisible para siempre.
 */
describe('la venta deja movimiento', () => {
  it('lo registra un trigger sobre las líneas de venta', () => {
    // Va sobre `sale_items` y no dentro de la RPC para cubrir todo camino que
    // registre una venta con un solo lugar que mantener.
    expect(MIGRACION).toContain('CREATE TRIGGER trg_sale_items_log_movement')
    expect(MIGRACION).toContain('AFTER INSERT ON public.sale_items')
    expect(MIGRACION).toContain("'sale',")
  })

  it('el stock previo se lee de la sucursal de la venta', () => {
    expect(MIGRACION).toContain('WHERE bi.branch_id = v_sale.branch_id')
    // Sin fila en esa sucursal, el descuento va contra el stock global.
    expect(MIGRACION).toContain('SELECT p.stock_quantity INTO v_previous_stock')
  })

  it('la fila nace con empresa y sucursal, o no se puede leer nunca más', () => {
    expect(MIGRACION).toContain('v_sale.organization_id,')
    expect(MIGRACION).toContain('v_sale.branch_id,')
  })
})

describe('el ajuste por sucursal declara su alcance', () => {
  it('escribe organization_id y branch_id explícitos', () => {
    const rpc = MIGRACION.slice(
      MIGRACION.indexOf('CREATE FUNCTION public.set_branch_inventory_stock'),
      MIGRACION.indexOf('CREATE OR REPLACE FUNCTION public.log_sale_item_stock_movement')
    )
    expect(rpc).toContain('INSERT INTO public.product_movements (\n    organization_id,\n    branch_id,')
    expect(rpc).toContain('v_organization_id,')
    expect(rpc).toContain('p_branch_id,')
  })

  it('rechaza la sucursal de otra empresa', () => {
    expect(MIGRACION).toContain('La sucursal no pertenece a la empresa del producto.')
  })

  it('no pisa lo que pasó mientras el formulario estaba abierto', () => {
    // Mandaba un absoluto calculado en el navegador sobre un stock leído al
    // cargar la lista: una venta ocurrida en el medio quedaba borrada.
    expect(MIGRACION).toContain('p_expected_previous_stock INTEGER DEFAULT NULL')
    expect(MIGRACION).toContain("RAISE EXCEPTION 'STOCK_CHANGED|%|%'")
    expect(MIGRACION).toContain('FOR UPDATE')
    expect(CONTROL).toContain('p_expected_previous_stock: selectedProduct.stock,')
  })

  it('el cajero lee castellano, no el código de Postgres', () => {
    expect(CONTROL).toContain('El stock cambió mientras tenías el formulario abierto')
    expect(CONTROL).toContain('describeStockRpcError(branchError)')
  })
})

describe('ningún escritor futuro puede dejar una fila invisible', () => {
  it('un trigger completa la empresa desde el producto', () => {
    expect(MIGRACION).toContain('CREATE TRIGGER trg_product_movements_fill_scope')
    expect(MIGRACION).toContain('BEFORE INSERT ON public.product_movements')
    expect(MIGRACION).toContain('NEW.organization_id := v_product_org')
  })

  it('y descarta la sucursal que sea de otra empresa', () => {
    // El DEFAULT de la columna es `get_default_branch_id()`, que no filtra por
    // empresa: devuelve la sucursal por defecto de cualquier inquilino.
    expect(MIGRACION).toContain('IF v_branch_org IS DISTINCT FROM v_product_org THEN')
    expect(MIGRACION).toContain('NEW.branch_id := NULL;')
  })

  it('rescata las filas que ya quedaron huérfanas', () => {
    expect(MIGRACION).toContain('SET organization_id = product.organization_id')
    expect(MIGRACION).toContain('AND movement.organization_id IS NULL')
  })
})

/**
 * `branchScoped: false` significaba dos cosas a la vez: «no hay sucursal
 * seleccionada» y «no pude leer la sucursal». Río abajo las dos se pintaban
 * igual: el stock global, bajo un encabezado con el nombre de la sucursal.
 */
describe('un fallo de lectura ya no se ve como un dato', () => {
  it('el resultado distingue el fallo del caso sin sucursal', async () => {
    const sinSucursal = await loadBranchInventoryStockMap({ from: () => { throw new Error('no debería llamarse') } } as never, null)
    expect(sinSucursal.branchScoped).toBe(false)
    expect(sinSucursal.failed).toBe(false)

    const falla = await loadBranchInventoryStockMap(
      {
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } }),
          }),
        }),
      } as never,
      'sucursal-1'
    )
    expect(falla.branchScoped).toBe(false)
    expect(falla.failed).toBe(true)
    expect(falla.error).toContain('permission denied')
    expect(falla.error).toContain('42501')
  })

  it('la lectura correcta sigue devolviendo el mapa', async () => {
    const ok = await loadBranchInventoryStockMap(
      {
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: [{ product_id: 'p1', stock_quantity: 7 }], error: null }),
          }),
        }),
      } as never,
      'sucursal-1'
    )
    expect(ok.failed).toBe(false)
    expect(ok.branchScoped).toBe(true)
    expect(ok.stockMap.get('p1')).toBe(7)
  })

  it('la API corta en vez de devolver el stock global', () => {
    // Mismo criterio que ya usaba POST /api/orders.
    expect(PRODUCTOS_API).toContain('if (branchScope.branchId && branchStockFailed) {')
    expect(PRODUCTOS_API).toContain("code: 'BRANCH_STOCK_UNAVAILABLE'")
    expect(PRODUCTOS_API).toContain('{ status: 503 }')
  })

  it('«Stock por sucursal» avisa y ofrece reintentar', () => {
    expect(CONTROL).toContain('if (selectedBranchId && branchStockFailed) {')
    expect(CONTROL).toContain('setLoadError(')
    expect(CONTROL).toContain('Reintentar')
  })

  it('el informe no se genera con el número equivocado', () => {
    expect(REPORTES).toContain('if (selectedBranchId && branchStock.failed) {')
    expect(REPORTES).toContain('asi que el informe no se genera')
  })
})

describe('reponer desde la ficha del producto también deja rastro', () => {
  it('lee el stock previo y escribe el movimiento', () => {
    expect(PRODUCTO_API).toContain("from('branch_inventory')")
    expect(PRODUCTO_API).toContain('const previousStock = Number(previousRow?.stock_quantity ?? 0)')
    expect(PRODUCTO_API).toContain("from('product_movements')")
    expect(PRODUCTO_API).toContain("movement_type: 'adjustment',")
  })

  it('no escribe movimiento si el stock no cambió', () => {
    expect(PRODUCTO_API).toContain('if (nextStock !== previousStock) {')
  })

  it('si falla el registro, el stock queda pero el hueco se avisa', () => {
    expect(PRODUCTO_API).toContain('Stock updated without movement record')
  })
})

describe('el umbral de las alertas es el del producto', () => {
  it('sale del mínimo real y no de un 5 fijo', () => {
    expect(CONTROL).toContain('threshold: Number(a.product?.min_stock ?? 0),')
    expect(CONTROL).toContain('product:products(name, sku, stock_quantity, min_stock)')
    expect(CONTROL).not.toContain('threshold: 5,')
  })
})

/**
 * `process_pos_sale_atomic_v5` llama a v4 —que inserta las lineas— y despues
 * BORRA y VUELVE A INSERTAR las lineas con variante para completarles los datos
 * de la variante. Con un trigger que insertaba una fila por INSERT, eso dejaba
 * dos movimientos por producto con variante, y ademas discrepantes: el primero
 * leia el stock antes del descuento y el segundo despues.
 */
describe('el movimiento de venta no se duplica', () => {
  const IDEMPOTENTE = leer('supabase/migrations/20260908020000_sale_movement_idempotent.sql')

  it('refleja el total vigente en vez de acumular inserciones', () => {
    // Acumular no servia: no hay forma de distinguir «otra linea del mismo
    // producto» de «la misma linea reinsertada».
    expect(IDEMPOTENTE).toContain('SELECT COALESCE(SUM(item.quantity), 0)')
    expect(IDEMPOTENTE).toContain('AND item.product_id = v_product_id')
    expect(IDEMPOTENTE).toContain('SET quantity = v_total,')
  })

  it('conserva el stock previo de la primera vez', () => {
    // Recalcularlo en la reinsercion leeria el stock YA descontado.
    expect(IDEMPOTENTE).toContain('new_stock = v_previous_stock - v_total')
    expect(IDEMPOTENTE).toContain('ORDER BY movement.created_at ASC')
  })

  it('corre tambien al borrar y al cambiar la cantidad', () => {
    expect(IDEMPOTENTE).toContain('AFTER INSERT OR UPDATE OF quantity OR DELETE ON public.sale_items')
  })

  it('si el producto sale de la venta, el movimiento se va con el', () => {
    expect(IDEMPOTENTE).toContain('IF v_total <= 0 THEN')
    expect(IDEMPOTENTE).toContain('DELETE FROM public.product_movements WHERE id = v_movement_id')
  })
})
