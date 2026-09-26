import { applyCustomerSpend, fetchCustomerSpend } from './customer-spend-client'
import { customerDirectoryParams } from '@/hooks/use-customer-directory-state'
import { mapRawToCustomer, type Customer, type CustomerFilters } from '@/hooks/use-customer-state'
import { customersToCSV } from '@/lib/export/customers-export'

/** Descarga todos los resultados filtrados sin conservar las filas en el estado de React. */
export async function exportCustomerDirectory(filters: CustomerFilters, sortBy: string, sortOrder: 'asc' | 'desc'): Promise<number> {
  const csvParts: string[] = ['\uFEFF']
  let exported = 0
  let page = 1
  let total = 0

  do {
    const params = customerDirectoryParams(filters, page, 200, sortBy, sortOrder)
    params.set('summary', '0')
    const response = await fetch(`/api/customers?${params.toString()}`)
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudieron exportar los clientes.')
    const customers = (result.data || []).map(mapRawToCustomer) as Customer[]
    total = Number(result.pagination?.total || 0)
    if (customers.length === 0) break
    const spend = await fetchCustomerSpend(customers.map((customer) => customer.id))
    const csv = customersToCSV(applyCustomerSpend(customers, spend))
    csvParts.push(exported === 0 ? csv : `\n${csv.slice(csv.indexOf('\n') + 1)}`)
    exported += customers.length
    page += 1
  } while (exported < total)

  if (exported === 0) throw new Error('No hay clientes para exportar.')
  const url = URL.createObjectURL(new Blob(csvParts, { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return exported
}

/** Exportaciones con columnas/formato personalizados: carga filas bajo demanda. */
export async function loadCustomerDirectoryForExport(filters: CustomerFilters, sortBy: string, sortOrder: 'asc' | 'desc'): Promise<Customer[]> {
  const all: Customer[] = []
  let page = 1
  let total = 0
  do {
    const params = customerDirectoryParams(filters, page, 200, sortBy, sortOrder)
    params.set('summary', '0')
    const response = await fetch(`/api/customers?${params.toString()}`)
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudieron cargar los clientes para exportar.')
    const customers = (result.data || []).map(mapRawToCustomer) as Customer[]
    total = Number(result.pagination?.total || 0)
    if (customers.length === 0) break
    const spend = await fetchCustomerSpend(customers.map((customer) => customer.id))
    all.push(...applyCustomerSpend(customers, spend))
    page += 1
  } while (all.length < total)
  return all
}
