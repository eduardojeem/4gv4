import {
  calculateCustomerAccountSummary,
  type CustomerAccountSummary,
  type CustomerCreditBalanceRow,
  type CustomerOrderBalanceRow,
  type CustomerRepairBalanceRow,
} from './customer-account-summary'

export interface CustomerStoreInfo {
  id: string
  name: string
  slug: string
  logo_url?: string | null
}

export interface CustomerStoreSummary {
  organizationId: string
  organization: CustomerStoreInfo | null
  summary: CustomerAccountSummary
  /** Hay algo que hacer en esta tienda: plata que deber o un equipo que retirar. */
  needsAttention: boolean
}

type WithOrganization<T> = T & { organization_id?: string | null }

export interface CustomerStoresInput {
  repairs: Array<WithOrganization<CustomerRepairBalanceRow>>
  orders: Array<WithOrganization<CustomerOrderBalanceRow>>
  credits: Array<WithOrganization<CustomerCreditBalanceRow>>
  storeCreditMovements: Array<WithOrganization<{ amount?: number | string | null }>>
  organizations: Map<string, CustomerStoreInfo>
}

function bucket<T extends { organization_id?: string | null }>(
  rows: T[],
  into: Map<string, T[]>
) {
  for (const row of rows) {
    const orgId = row.organization_id
    if (!orgId) continue
    const existing = into.get(orgId)
    if (existing) existing.push(row)
    else into.set(orgId, [row])
  }
}

/**
 * Abre la cuenta del cliente por tienda.
 *
 * El resumen general suma todo junto, y entre varias tiendas eso no dice nada
 * accionable: «por pagar 800.000» no aclara a quien, y el saldo a favor de una
 * no se gasta en otra. Cada tienda se calcula con la MISMA funcion que el total
 * general, asi que las partes cierran con el todo por construccion —si algun dia
 * cambia una regla de cobro, cambia en los dos lados a la vez—.
 *
 * Las filas sin `organization_id` se ignoran: no se pueden atribuir, y meterlas
 * en una tienda cualquiera seria peor que no mostrarlas.
 */
export function summarizeCustomerStores(input: CustomerStoresInput): CustomerStoreSummary[] {
  const repairsByOrg = new Map<string, CustomerStoresInput['repairs']>()
  const ordersByOrg = new Map<string, CustomerStoresInput['orders']>()
  const creditsByOrg = new Map<string, CustomerStoresInput['credits']>()
  const movementsByOrg = new Map<string, CustomerStoresInput['storeCreditMovements']>()

  bucket(input.repairs, repairsByOrg)
  bucket(input.orders, ordersByOrg)
  bucket(input.credits, creditsByOrg)
  bucket(input.storeCreditMovements, movementsByOrg)

  const orgIds = new Set<string>([
    ...repairsByOrg.keys(),
    ...ordersByOrg.keys(),
    ...creditsByOrg.keys(),
    ...movementsByOrg.keys(),
  ])

  const rows: CustomerStoreSummary[] = []

  for (const organizationId of orgIds) {
    const summary = calculateCustomerAccountSummary({
      repairs: repairsByOrg.get(organizationId) ?? [],
      orders: ordersByOrg.get(organizationId) ?? [],
      credits: creditsByOrg.get(organizationId) ?? [],
      storeCreditMovements: movementsByOrg.get(organizationId) ?? [],
    })

    rows.push({
      organizationId,
      organization: input.organizations.get(organizationId) ?? null,
      summary,
      needsAttention: summary.totalDue > 0 || summary.equipment.ready > 0,
    })
  }

  // Primero donde hay algo que hacer, despues por monto adeudado y por volumen.
  // El nombre desempata para que el orden no baile entre recargas.
  return rows.sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1
    if (a.summary.totalDue !== b.summary.totalDue) return b.summary.totalDue - a.summary.totalDue

    const aVolume = a.summary.equipment.total + a.summary.orders.pendingCount + a.summary.orders.paidCount
    const bVolume = b.summary.equipment.total + b.summary.orders.pendingCount + b.summary.orders.paidCount
    if (aVolume !== bVolume) return bVolume - aVolume

    return (a.organization?.name ?? '').localeCompare(b.organization?.name ?? '')
  })
}
