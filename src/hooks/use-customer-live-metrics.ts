'use client'

import { useEffect, useState } from 'react'

export type CustomerLiveMetrics = {
  repairs: number | null
  purchases: number | null
  billed: number | null
  posBilled: number | null
  webBilled: number | null
  repairsBilled: number | null
  loyaltyPoints: number | null
  loyaltyModuleInstalled: boolean
  canView: boolean | null
  failed: string[]
  loading: boolean
}

const EMPTY: CustomerLiveMetrics = {
  repairs: null,
  purchases: null,
  billed: null,
  posBilled: null,
  webBilled: null,
  repairsBilled: null,
  loyaltyPoints: null,
  loyaltyModuleInstalled: false,
  canView: null,
  failed: [],
  loading: false,
}

type MetricsPayload = {
  metrics?: Omit<CustomerLiveMetrics, 'canView' | 'failed' | 'loading'>
}

export function useCustomerLiveMetrics(
  customerId: string | null | undefined,
  enabled = true,
): CustomerLiveMetrics {
  const [metrics, setMetrics] = useState<CustomerLiveMetrics>(EMPTY)

  useEffect(() => {
    if (!enabled || !customerId) return

    const controller = new AbortController()

    void (async () => {
      await Promise.resolve()
      if (controller.signal.aborted) return
      setMetrics({ ...EMPTY, loading: true })

      try {
        const response = await fetch(`/api/customers/${customerId}/metrics`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null) as MetricsPayload | null
        if (controller.signal.aborted) return

        if (response.status === 401 || response.status === 403) {
          setMetrics({ ...EMPTY, canView: false })
          return
        }

        if (!response.ok || !body?.metrics) {
          setMetrics({ ...EMPTY, canView: true, failed: [`actividad (HTTP ${response.status || 0})`] })
          return
        }

        setMetrics({ ...body.metrics, canView: true, failed: [], loading: false })
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn('[ficha del cliente] no se pudo cargar el resumen comercial', {
          customerId,
          errorType: error instanceof Error ? error.name : 'unknown',
        })
        setMetrics({ ...EMPTY, canView: true, failed: ['actividad (sin conexión)'] })
      }
    })()

    return () => controller.abort()
  }, [customerId, enabled])

  return enabled && customerId ? metrics : EMPTY
}
