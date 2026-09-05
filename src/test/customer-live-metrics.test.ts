import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * La ficha completa del cliente en reparaciones mostraba cuatro números
 * —Reparaciones, Compras, Facturado Total, Puntos Fidelidad— leídos de
 * `customers.total_repairs`, `total_purchases`, `lifetime_value` y
 * `loyalty_points`.
 *
 * Esas cuatro columnas existen desde la creación de la tabla, tienen
 * `default 0`, y no hay en todo el proyecto una sola línea que las escriba.
 * Salvo las filas de ejemplo que sembraron las migraciones viejas, valen 0
 * para siempre: los cuatro recuadros mostraban 0 a todo el mundo.
 */
describe('nadie mantiene las columnas de métricas del cliente', () => {
  const COLUMNAS = ['total_repairs', 'total_purchases', 'lifetime_value'] as const

  function archivosSql(): string[] {
    const encontrados: string[] = []
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
        const ruta = join(dir, entrada.name)
        if (entrada.isDirectory()) { recorrer(ruta); continue }
        if (entrada.name.endsWith('.sql')) encontrados.push(ruta)
      }
    }
    recorrer('supabase/migrations')
    return encontrados
  }

  it('ninguna migración las actualiza', () => {
    // Si algún día alguien agrega el trigger que las mantenga, esta prueba
    // falla y hay que revisar si conviene volver a leerlas.
    const escrituras: string[] = []

    for (const ruta of archivosSql()) {
      const contenido = readFileSync(resolve(process.cwd(), ruta), 'utf8')
      for (const columna of COLUMNAS) {
        // `update ... set columna =` en cualquier orden razonable.
        const patron = new RegExp(`update[\\s\\S]{0,400}?set[\\s\\S]{0,200}?\\b${columna}\\s*=`, 'i')
        if (patron.test(contenido)) escrituras.push(`${ruta} → ${columna}`)
      }
    }

    expect(escrituras, `alguien las escribe: ${escrituras.join(', ')}`).toEqual([])
  })
})

describe('la ficha del cliente usa los números reales', () => {
  const hook = leer('src/hooks/use-customer-live-metrics.ts')
  const modal = leer('src/components/dashboard/repairs/CustomerDetailModal.tsx')

  it('consulta ventas, reparaciones y la cuenta de puntos', () => {
    expect(hook).toContain('/api/customers/${customerId}/sales?limit=1')
    expect(hook).toContain('/api/customers/${customerId}/repairs?limit=1')
    expect(hook).toContain('/api/loyalty/customers/${customerId}')
  })

  it('incluye las compras hechas desde la tienda publica', () => {
    const salesRoute = leer('src/app/api/customers/[id]/sales/route.ts')
    expect(salesRoute).toContain(".from('customer_orders')")
    expect(salesRoute).toContain(".eq('organization_id', organization.id)")
    expect(salesRoute).toContain('ordersSpent')
    expect(salesRoute).toContain('posSpent')
  })

  it('solo factura reparaciones terminadas y no cuenta canceladas', () => {
    const repairsRoute = leer('src/app/api/customers/[id]/repairs/route.ts')
    expect(repairsRoute).toContain('isCountableRepair')
    expect(repairsRoute).toContain('validRepairs')
    expect(repairsRoute).not.toContain('const cost = Number(r.final_cost ?? r.estimated_cost ?? 0)')
  })

  it('el facturado suma ventas y reparaciones', () => {
    expect(hook).toContain('ventasGastado + reparacionesGastado')
  })

  it('expone el desglose para explicar el total', () => {
    expect(hook).toContain('posBilled')
    expect(hook).toContain('webBilled')
    expect(hook).toContain('repairsBilled')
    expect(modal).toContain('POS:')
    expect(modal).toContain('Tienda web:')
    expect(modal).toContain('Taller:')
  })

  it('no muestra un total parcial como si fuera bueno', () => {
    // Si falla una de las dos partes, el total sería menor que el real.
    expect(hook).toContain('ventasGastado === null || reparacionesGastado === null')
  })

  it('los puntos salen de loyalty_accounts, no de la columna del cliente', () => {
    // `customers.loyalty_points` nunca fue parte del circuito de fidelidad:
    // el saldo lo mantienen award_loyalty_points_for_sale y adjust_loyalty_points
    // sobre `loyalty_accounts.balance`.
    expect(hook).toContain('loyalty.body.account?.balance')
    // Sin los comentarios: el propio docstring nombra la columna para explicar
    // por que no se usa, y buscarla a secas daba un falso positivo.
    const soloCodigo = hook
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(/\r?\n/)
      .filter((linea) => !linea.trim().startsWith('//'))
      .join(' ')
    expect(soloCodigo).not.toContain('loyalty_points')
  })

  it('distingue "sin puntos" de "fidelidad no activada"', () => {
    // Un 0 afirmaría que el cliente no juntó puntos, cuando el módulo puede
    // no estar en el plan de esa tienda.
    expect(hook).toContain("respuesta.body?.moduleInstalled !== false")
    expect(modal).toContain('Fidelidad no activada')
  })

  it('el modal ya no lee las columnas congeladas', () => {
    expect(modal).toContain('useCustomerLiveMetrics(customer?.id, open)')
    expect(modal).not.toMatch(/activeCustomer\.(total_repairs|total_purchases|lifetime_value|loyalty_points)/)
  })

  it('trata el 403 y el 402 del plan como "fidelidad no activada"', () => {
    // El endpoint de puntos no responde `moduleInstalled: false` cuando el plan
    // no lo incluye: `withTenantAuth` corta antes con 403 (MODULE_DISABLED) o
    // 402 (MODULE_NOT_ENTITLED). Mirando solo el cuerpo, el recuadro quedaba en
    // "—" con la etiqueta "Puntos vigentes", que es lo que no corresponde decir.
    const fn = hook.slice(hook.indexOf('function fidelidadDisponible'))
    expect(fn.slice(0, 400)).toContain('respuesta.status === 402 || respuesta.status === 403')
    expect(fn.slice(0, 400)).toContain("code === 'MODULE_DISABLED'")
    expect(fn.slice(0, 400)).toContain("code === 'MODULE_NOT_ENTITLED'")
  })

  it('distingue "sin cuenta de puntos" de "no se pudo consultar"', () => {
    // Un cliente sin movimientos tiene `account: null` con el modulo activo:
    // eso es 0 puntos de verdad, no una consulta fallida.
    expect(hook).toContain("loyalty.body?.hasOwnProperty('account')")
  })

  it('dice cual consulta fallo, con su codigo HTTP', () => {
    expect(hook).toContain('const fallas: string[] = []')
    expect(hook).toContain('HTTP ${sales.status}')
    expect(modal).toContain("metrics.failed.join(' ni ')")
  })

  it('muestra un guion, no un cero, cuando la consulta falla', () => {
    // Un 0 se lee como dato bueno. Es la misma regla que en el panel de
    // seguridad: si no se pudo contar, no se inventa el número.
    expect(modal).toContain("metrics.repairs ?? '—'")
    expect(modal).toContain("metrics.billed === null ? '—'")
    expect(modal).toContain('No pudimos cargar {metrics.failed')
  })
})
