import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customerIdsWithOutstandingDebt } from '@/lib/credits/customers-with-debt'

/**
 * Auditoría del POS y las ventas a crédito.
 *
 * Tres cosas estaban mal: borrar una venta dejaba el stock perdido y al cliente
 * debiendo una venta inexistente; el mostrador ofrecía crédito calculado contra
 * una columna que nadie actualiza; y el filtro «con deuda» del listado de
 * clientes miraba esa misma columna, así que no encontraba a ningún deudor.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const MIGRACION = leer('supabase/migrations/20260924090000_void_pos_sale.sql')
const API_VENTAS = leer('src/app/api/sales/route.ts')
const API_CLIENTES = leer('src/app/api/customers/route.ts')
const POS = leer('src/app/dashboard/pos/page.tsx')
const OFFLINE = leer('src/app/dashboard/pos/lib/offline-manager.ts')

describe('anular una venta revierte todo lo que hizo', () => {
  it('ya no se borra la fila: se marca anulada', () => {
    expect(API_VENTAS).toContain("rpc('void_pos_sale'")
    expect(API_VENTAS).not.toContain("from('sale_items')\n      .delete()")
    expect(MIGRACION).toContain("set status = 'cancelled'")
  })

  it('devuelve el stock, con y sin variantes', () => {
    expect(MIGRACION).toContain('set stock_quantity = stock_quantity + item.quantity')
    expect(MIGRACION).toContain('update public.branch_inventory')
    // Las variantes tienen su propio inventario por sucursal.
    expect(MIGRACION).toContain('adjust_variant_stock_atomic(')
    expect(MIGRACION).toContain("'void-sale:'")
  })

  it('cancela las cuotas impagas y cierra el crédito', () => {
    expect(MIGRACION).toContain("set status = 'cancelled', updated_at = now()")
    expect(MIGRACION).toContain("where credit_id = credit.id and status <> 'paid'")
    expect(MIGRACION).toContain("update public.customer_credits")
  })

  it('no anula sola una venta cuyo crédito ya cobró', () => {
    // Devolver plata cobrada es una decision del negocio, no de una función.
    expect(MIGRACION).toContain('SALE_CREDIT_ALREADY_PAID')
    expect(API_VENTAS).toContain('ya tiene cuotas cobradas')
  })

  it('el efectivo sale de la caja con un movimiento inverso', () => {
    expect(MIGRACION).toContain("'cash_out'")
    expect(MIGRACION).toContain('VOID_REQUIRES_OPEN_REGISTER')
    // Sin caja abierta se frena: devolver el stock y dejar la plata contada
    // como vendida seria peor que no anular.
    expect(API_VENTAS).toContain('Abrí la caja antes de anular')
  })

  it('anular dos veces no duplica la devolución', () => {
    expect(MIGRACION).toContain("if sale.status = 'cancelled' then")
    expect(MIGRACION).toContain("'already_voided', true")
  })

  it('sin la migración aplicada avisa en vez de romper', () => {
    expect(API_VENTAS).toContain('Falta aplicar la migración de anulación de ventas')
  })
})

describe('el crédito disponible sale de la deuda real', () => {
  it('el POS ya no usa la columna que nadie actualiza', () => {
    expect(POS).not.toContain("Number(activeCustomer?.current_balance || 0)")
    expect(POS).toContain('const creditoDisponible = useMemo(')
    expect(POS).toContain('getCreditSummary(activeCustomer')
  })

  it('y es el mismo cálculo que usa el panel del checkout', () => {
    // `getCreditSummary` suma las cuotas pendientes menos lo pagado, igual que
    // el servidor cuando aprueba o rechaza la venta.
    expect(POS).toContain("useCreditSystem()")
  })
})

describe('«clientes con deuda» encuentra a los que deben', () => {
  const cliente = (creditos: unknown[], cuotas: unknown[]) => ({
    from: (tabla: string) => ({
      select: () => ({
        eq: async () => ({ data: tabla === 'customer_credits' ? creditos : [], error: null }),
        in: () => ({ in: async () => ({ data: cuotas, error: null }) }),
      }),
    }),
  })

  it('cuenta el saldo de cada cuota, no su importe completo', async () => {
    const ids = await customerIdsWithOutstandingDebt(
      cliente(
        [{ id: 'c1', customer_id: 'juan' }, { id: 'c2', customer_id: 'ana' }],
        [
          { credit_id: 'c1', amount: 100_000, amount_paid: 100_000 },
          { credit_id: 'c2', amount: 80_000, amount_paid: 20_000 },
        ],
      ) as never,
      'org-1',
    )

    // Juan ya cubrió la suya; Ana debe 60.000.
    expect(ids).toEqual(['ana'])
  })

  it('sin créditos no consulta cuotas ni devuelve a nadie', async () => {
    const ids = await customerIdsWithOutstandingDebt(cliente([], []) as never, 'org-1')
    expect(ids).toEqual([])
  })

  it('la API dejó de mirar pending_amount y current_balance', () => {
    expect(API_CLIENTES).not.toContain("query.or('pending_amount.gt.0,current_balance.gt.0')")
    expect(API_CLIENTES).toContain('customerIdsWithOutstandingDebt(')
  })
})

describe('las trampas del código muerto', () => {
  it('la sincronización offline ya no miente: falla de frente', () => {
    // Antes marcaba «synced» sin enviar nada: la venta se perdia y el cajero
    // veia que se habia sincronizado.
    expect(OFFLINE).toContain('no está implementada')
    expect(OFFLINE).not.toContain('// TODO: Implement actual API call to Supabase')
  })

  it('el camino de venta sin idempotencia estable ya no existe', () => {
    // `usePOS.processSale` generaba una clave nueva por intento: doble clic,
    // dos ventas. Nadie lo montaba, se fue junto a sus componentes.
    expect(() => leer('src/hooks/usePOS.ts')).toThrow()
    expect(() => leer('src/components/pos/PaymentPanel.tsx')).toThrow()
  })
})

describe('el estado «late» queda documentado', () => {
  it('la columna dice que nadie lo escribe', () => {
    expect(MIGRACION).toContain('comment on column public.credit_installments.status')
    expect(MIGRACION).toContain('la mora se calcula por fecha al leer')
  })
})
