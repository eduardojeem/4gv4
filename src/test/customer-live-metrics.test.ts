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

  it('el facturado suma ventas y reparaciones', () => {
    expect(hook).toContain('ventasGastado + reparacionesGastado')
  })

  it('no muestra un total parcial como si fuera bueno', () => {
    // Si falla una de las dos partes, el total sería menor que el real.
    expect(hook).toContain('ventasGastado === null || reparacionesGastado === null')
  })

  it('los puntos salen de loyalty_accounts, no de la columna del cliente', () => {
    // `customers.loyalty_points` nunca fue parte del circuito de fidelidad:
    // el saldo lo mantienen award_loyalty_points_for_sale y adjust_loyalty_points
    // sobre `loyalty_accounts.balance`.
    expect(hook).toContain('loyalty.account?.balance')
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
    expect(hook).toContain("loyalty?.moduleInstalled !== false")
    expect(modal).toContain('Fidelidad no activada')
  })

  it('el modal ya no lee las columnas congeladas', () => {
    expect(modal).toContain('useCustomerLiveMetrics(customer?.id, open)')
    expect(modal).not.toMatch(/activeCustomer\.(total_repairs|total_purchases|lifetime_value|loyalty_points)/)
  })

  it('muestra un guion, no un cero, cuando la consulta falla', () => {
    // Un 0 se lee como dato bueno. Es la misma regla que en el panel de
    // seguridad: si no se pudo contar, no se inventa el número.
    expect(modal).toContain("metrics.repairs ?? '—'")
    expect(modal).toContain("metrics.billed === null ? '—'")
    expect(modal).toContain('No pudimos cargar algunos números del cliente')
  })
})
