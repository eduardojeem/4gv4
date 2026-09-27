import { useEffect, useState } from 'react'
import { applyCustomerSpend, fetchCustomerSpend } from '@/lib/customers/customer-spend-client'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { mapRawToCustomer, type Customer } from './use-customer-state'

/** Las vistas globales cargan el padrón completo solo mientras están abiertas. */
export function useCustomerInsightsData(enabled: boolean, includeSpend: boolean) {
  const organizationId = useOptionalActiveOrganization()?.organization?.id ?? null
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setCustomers([])
      setLoading(false)
      setError(null)
      return
    }
    const controller = new AbortController()
    setCustomers([])
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows: Customer[] = []
        let page = 1
        let total = 0
        do {
          const response = await fetch(`/api/customers?page=${page}&limit=200&summary=0`, { signal: controller.signal })
          const result = await response.json()
          if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron cargar los datos de clientes.')
          const batch = (result.data || []).map(mapRawToCustomer) as Customer[]
          total = Number(result.pagination?.total || 0)
          rows.push(...batch)
          if (batch.length === 0) break
          page += 1
        } while (rows.length < total && !controller.signal.aborted)
        if (controller.signal.aborted) return
        if (includeSpend) {
          const spend = await fetchCustomerSpend(rows.map((customer) => customer.id))
          if (!controller.signal.aborted) setCustomers(applyCustomerSpend(rows, spend))
        } else if (!controller.signal.aborted) {
          setCustomers(rows)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los clientes.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [enabled, includeSpend, organizationId])

  return { customers, loading, error }
}
