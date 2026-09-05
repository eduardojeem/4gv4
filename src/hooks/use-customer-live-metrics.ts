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
  loading: boolean
}

const VACIO: CustomerLiveMetrics = {
  repairs: null,
  purchases: null,
  billed: null,
  loyaltyPoints: null,
  loyaltyModuleInstalled: true,
  loading: false,
}

async function leerJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
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
        leerJson(`/api/customers/${customerId}/sales?limit=1`),
        leerJson(`/api/customers/${customerId}/repairs?limit=1`),
        leerJson(`/api/loyalty/customers/${customerId}`),
      ])

      if (!vigente) return

      const ventasGastado = sales?.stats ? Number(sales.stats.totalSpent ?? 0) : null
      const reparacionesGastado = repairs?.stats ? Number(repairs.stats.totalSpent ?? 0) : null

      // Si una de las dos partes falló, el total sería menor que el real y
      // parecería un dato bueno. Mejor no mostrar número.
      const facturado = ventasGastado === null || reparacionesGastado === null
        ? null
        : ventasGastado + reparacionesGastado

      // El módulo de fidelidad es opcional por plan. Cuando no está, decirlo:
      // un 0 afirmaría que el cliente no juntó puntos.
      const moduloInstalado = loyalty?.moduleInstalled !== false

      setMetrics({
        repairs: repairs?.stats ? Number(repairs.stats.totalRepairs ?? 0) : null,
        purchases: sales?.stats ? Number(sales.stats.totalPurchases ?? 0) : null,
        billed: facturado,
        loyaltyPoints: moduloInstalado && loyalty ? Number(loyalty.account?.balance ?? 0) : null,
        loyaltyModuleInstalled: moduloInstalado,
        loading: false,
      })
    })()

    return () => { vigente = false }
  }, [customerId, enabled])

  return metrics
}
