'use client'

import { useEffect, useState } from 'react'

/**
 * Las metricas reales de un cliente: cuantas reparaciones, cuantas compras,
 * cuanto facturo y cuantos puntos tiene.
 *
 * No salen de `customers.total_repairs`, `total_purchases`, `lifetime_value` ni
 * `loyalty_points`. Esas cuatro columnas existen desde la creacion de la tabla,
 * tienen `default 0`, y no hay en todo el proyecto —ni en el codigo ni en un
 * trigger— una sola linea que las escriba. Salvo las filas de ejemplo que
 * sembraron las migraciones viejas, valen 0 para siempre.
 *
 * Los puntos de fidelidad viven en `loyalty_accounts.balance`, que si se
 * mantiene: `award_loyalty_points_for_sale` y `adjust_loyalty_points` la
 * actualizan. `customers.loyalty_points` nunca fue parte de ese circuito.
 */

export type CustomerLiveMetrics = {
  /** Reparaciones registradas. `null` si la consulta falló. */
  repairs: number | null
  /** Ventas registradas. `null` si la consulta falló. */
  purchases: number | null
  /** Ventas + reparaciones, en guaraníes. `null` si alguna consulta falló. */
  billed: number | null
  /** Saldo de puntos. `null` si falló o si el módulo no está instalado. */
  loyaltyPoints: number | null
  /** Distingue "no tiene puntos" de "esta tienda no usa fidelidad". */
  loyaltyModuleInstalled: boolean
  /** Qué consultas fallaron, con nombre, para poder decirlo en pantalla. */
  failed: string[]
  loading: boolean
}

const VACIO: CustomerLiveMetrics = {
  repairs: null,
  purchases: null,
  billed: null,
  loyaltyPoints: null,
  loyaltyModuleInstalled: true,
  failed: [],
  loading: false,
}

type Respuesta = { ok: boolean; status: number; body: any | null }

async function leer(url: string): Promise<Respuesta> {
  try {
    const response = await fetch(url)
    const body = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, body }
  } catch {
    return { ok: false, status: 0, body: null }
  }
}

/**
 * El modulo de fidelidad es opcional por plan, y cuando no esta el endpoint no
 * responde `moduleInstalled: false`: `withTenantAuth` corta antes con 403
 * (MODULE_DISABLED) o 402 (MODULE_NOT_ENTITLED). Mirando solo el cuerpo, esos
 * dos casos se veian como "fallo la consulta" y el recuadro quedaba en "—" con
 * la etiqueta "Puntos vigentes", que es justo lo que no corresponde decir.
 */
function fidelidadDisponible(respuesta: Respuesta): boolean {
  if (respuesta.status === 402 || respuesta.status === 403) return false
  const code = respuesta.body?.code
  if (code === 'MODULE_DISABLED' || code === 'MODULE_NOT_ENTITLED') return false
  return respuesta.body?.moduleInstalled !== false
}

export function useCustomerLiveMetrics(customerId: string | null | undefined, enabled = true): CustomerLiveMetrics {
  const [metrics, setMetrics] = useState<CustomerLiveMetrics>(VACIO)

  useEffect(() => {
    if (!enabled || !customerId) {
      setMetrics(VACIO)
      return
    }

    let vigente = true
    setMetrics({ ...VACIO, loading: true })

    void (async () => {
      const [sales, repairs, loyalty] = await Promise.all([
        leer(`/api/customers/${customerId}/sales?limit=1`),
        leer(`/api/customers/${customerId}/repairs?limit=1`),
        leer(`/api/loyalty/customers/${customerId}`),
      ])

      if (!vigente) return

      const ventasGastado = sales.body?.stats ? Number(sales.body.stats.totalSpent ?? 0) : null
      const reparacionesGastado = repairs.body?.stats ? Number(repairs.body.stats.totalSpent ?? 0) : null

      // Si una de las dos partes falló, el total sería menor que el real y
      // parecería un dato bueno. Mejor no mostrar número.
      const facturado = ventasGastado === null || reparacionesGastado === null
        ? null
        : ventasGastado + reparacionesGastado

      const moduloInstalado = fidelidadDisponible(loyalty)

      // Qué falló, con nombre. Un aviso genérico obliga a abrir la consola para
      // saber por dónde empezar a mirar.
      const fallas: string[] = []
      if (!sales.body?.stats) fallas.push(`compras${sales.status ? ` (HTTP ${sales.status})` : ''}`)
      if (!repairs.body?.stats) fallas.push(`reparaciones${repairs.status ? ` (HTTP ${repairs.status})` : ''}`)
      if (moduloInstalado && !loyalty.body?.hasOwnProperty('account')) {
        fallas.push(`puntos${loyalty.status ? ` (HTTP ${loyalty.status})` : ''}`)
      }

      // El detalle completo va a la consola: el cartel de pantalla tiene que ser
      // corto, pero para arreglarlo hace falta saber qué respondió cada uno.
      if (fallas.length > 0) {
        console.warn('[ficha del cliente] no se pudieron cargar algunas métricas', {
          customerId,
          compras: { status: sales.status, body: sales.body },
          reparaciones: { status: repairs.status, body: repairs.body },
          puntos: { status: loyalty.status, body: loyalty.body },
        })
      }

      setMetrics({
        repairs: repairs.body?.stats ? Number(repairs.body.stats.totalRepairs ?? 0) : null,
        purchases: sales.body?.stats ? Number(sales.body.stats.totalPurchases ?? 0) : null,
        billed: facturado,
        loyaltyPoints: moduloInstalado && loyalty.body?.hasOwnProperty('account')
          ? Number(loyalty.body.account?.balance ?? 0)
          : null,
        loyaltyModuleInstalled: moduloInstalado,
        failed: fallas,
        loading: false,
      })
    })()

    return () => { vigente = false }
  }, [customerId, enabled])

  return metrics
}
