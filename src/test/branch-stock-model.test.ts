import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { applyBranchInventoryToProducts, loadBranchInventoryStockMap } from '@/lib/branches/inventory'
import { resolveStockLevel } from '@/lib/inventory/stock-status'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const MIGRACION = leer('supabase/migrations/20260907130000_branch_stock_thresholds_and_totals.sql')
const NAV = leer('src/config/admin-navigation.ts')
const PANTALLA = leer('src/components/admin/inventory/inventory-management.tsx')

/**
 * `branch_inventory` solo guardaba `stock_quantity` y `reserved_quantity`. Con
 * una sucursal activa se comparaba el stock DE ESA SUCURSAL contra el
 * `min_stock` GLOBAL del producto: un minimo de 50 pensado para el deposito
 * central dejaba al kiosco en «Stock bajo» permanente.
 */
describe('cada sucursal puede tener su umbral', () => {
  it('la tabla los guarda, y NULL sigue usando el del producto', () => {
    expect(MIGRACION).toContain('ADD COLUMN IF NOT EXISTS min_stock INTEGER')
    expect(MIGRACION).toContain('ADD COLUMN IF NOT EXISTS max_stock INTEGER')
    // Una instalacion que nunca los configure se comporta como antes.
    expect(MIGRACION).toContain('v_branch_min := COALESCE(v_branch_min, v_product.min_stock, 0)')
  })

  it('el trigger de alertas usa el de la sucursal', () => {
    expect(MIGRACION).toContain('SELECT bi.stock_quantity, bi.min_stock')
    expect(MIGRACION).toContain('ELSIF v_branch_stock <= v_branch_min THEN')
  })

  it('el umbral de la sucursal pisa al del producto solo si esta configurado', () => {
    const conUmbral = applyBranchInventoryToProducts(
      [{ id: 'p1', stock_quantity: 100, min_stock: 50 }],
      new Map([['p1', 8]]),
      true,
      new Map([['p1', { minStock: 3, maxStock: null }]])
    )[0] as { stock_quantity: number; min_stock: number }
    expect(conUmbral.stock_quantity).toBe(8)
    expect(conUmbral.min_stock).toBe(3)
    // Con el minimo global de 50, un kiosco con 8 unidades estaba «bajo» siempre.
    expect(resolveStockLevel(conUmbral)).toBe('normal')

    const sinUmbral = applyBranchInventoryToProducts(
      [{ id: 'p1', stock_quantity: 100, min_stock: 50 }],
      new Map([['p1', 8]]),
      true,
      new Map([['p1', { minStock: null, maxStock: null }]])
    )[0] as { min_stock: number }
    expect(sinUmbral.min_stock).toBe(50)
  })

  it('sin mapa de umbrales se comporta como antes', () => {
    const producto = applyBranchInventoryToProducts(
      [{ id: 'p1', stock_quantity: 100, min_stock: 50 }],
      new Map([['p1', 8]]),
      true
    )[0] as { stock_quantity: number; min_stock: number }
    expect(producto.stock_quantity).toBe(8)
    expect(producto.min_stock).toBe(50)
  })
})

/**
 * La venta descuenta las dos tablas, pero el PUT del producto con sucursal
 * activa escribe solo `branch_inventory`: la columna global solo bajaba y nunca
 * subia, hasta llegar a cero y quedarse ahi. Y es la que leen
 * /dashboard/products, la vitrina publica y el informe sin sucursal.
 */
describe('el stock global vuelve a significar algo', () => {
  it('es la suma de las sucursales, mantenida por trigger', () => {
    expect(MIGRACION).toContain('CREATE OR REPLACE FUNCTION public.sync_product_total_stock(')
    expect(MIGRACION).toContain('CREATE TRIGGER trg_branch_inventory_sync_total')
    expect(MIGRACION).toContain('AFTER INSERT OR UPDATE OF stock_quantity OR DELETE ON public.branch_inventory')
  })

  it('sin filas por sucursal no borra el unico dato que hay', () => {
    // Una instalacion de una sola sucursal que nunca inicializo
    // `branch_inventory` habria quedado con todo el catalogo en cero.
    expect(MIGRACION).toContain('IF v_rows = 0 THEN')
    expect(MIGRACION).toContain('    RETURN;')
  })

  it('pone al dia lo que ya se desincronizo', () => {
    expect(MIGRACION).toContain('UPDATE public.products product')
    expect(MIGRACION).toContain('SET stock_quantity = totales.total')
  })

  it('y deja escrito que la columna no se toca a mano', () => {
    expect(MIGRACION).toContain('COMMENT ON COLUMN public.products.stock_quantity IS')
    expect(MIGRACION).toContain('Suma del stock de todas las sucursales')
  })
})

describe('lo reservado deja de contarse como disponible', () => {
  it('la lectura por sucursal lo trae', async () => {
    const resultado = await loadBranchInventoryStockMap(
      {
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ product_id: 'p1', stock_quantity: 10, reserved_quantity: 4, min_stock: null, max_stock: null }],
              error: null,
            }),
          }),
        }),
      } as never,
      'sucursal-1'
    )
    expect(resultado.reservedMap.get('p1')).toBe(4)
  })

  it('la tabla lo muestra junto a lo disponible', () => {
    expect(PANTALLA).toContain('Number(product.reserved_quantity || 0) > 0 &&')
    expect(PANTALLA).toContain('disponible')
  })
})

describe('el menu pide el permiso que la pantalla necesita', () => {
  it('inventario exige products.read, como /api/products', () => {
    // `inventory.read` se satisface tambien con `inventory.stock.manage`: quien
    // tuviera solo ese veia la seccion y encontraba el catalogo vacio.
    const bloque = NAV.slice(NAV.indexOf("key: 'inventory'"), NAV.indexOf("key: 'reports'"))
    expect(bloque).toContain("permissions: ['products.read']")
    expect(bloque).not.toContain("permissions: ['inventory.read']")
  })
})
