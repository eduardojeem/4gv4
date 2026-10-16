import { deviceTypeConfig } from '@/config/repair-constants'
import type { CompanyInfo, RepairPrintPayload } from '@/lib/repair-receipt'
import { getRepairFinancialPresentation } from '@/lib/repairs/financial-closure'
import type { Repair } from '@/types/repairs'

/**
 * Lo que se imprime de una reparación ya guardada, armado en un solo lugar.
 *
 * La fila del listado y el detalle armaban cada uno su versión, y la de la fila
 * dejaba afuera la garantía de la orden, lo pagado, el IMEI y el número de
 * serie: una orden «sin garantía» salía con la del taller (3 meses firmados),
 * y una con seña mostraba el presupuesto entero como saldo.
 */

/** Datos del cliente que el tipo Customer no declara pero suelen venir. */
type CustomerExtras = Partial<{ address: string; city: string; country: string; document: string }>

/** El número que se imprime y con el que se firma el QR: tienen que ser el mismo. */
export function repairPrintTicketNumber(repair: Pick<Repair, 'ticketNumber' | 'id'>): string {
  return repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()
}

export function buildRepairPrintPayload(
  repair: Repair,
  company: CompanyInfo,
  verificationHash?: string
): RepairPrintPayload {
  const ticketNumber = repairPrintTicketNumber(repair)
  const customer = repair.customer
  // Los mismos totales que muestra la pantalla: sin reparar, cancelado o con
  // cierre propio no se cobran como el presupuesto.
  const financial = getRepairFinancialPresentation({
    status: repair.status,
    finalCost: repair.finalCost,
    estimatedCost: repair.estimatedCost,
    paidAmount: repair.paidAmount,
    deliveryOutcome: repair.deliveryOutcome,
    qualityCheck: repair.qualityCheck,
    closeout: repair.closeout,
  })
  const delivered = repair.status === 'entregado'
  const toDate = (value?: string | null) => (value ? new Date(value) : undefined)
  const extras = (customer || {}) as CustomerExtras

  return {
    ticketNumber,
    date: new Date(repair.createdAt || new Date()),
    priority: repair.priority,
    urgency: repair.urgency,
    customer: {
      id: customer?.id || '',
      name: customer?.name || 'Cliente',
      customerCode: customer?.customerCode || '',
      phone: customer?.phone || '',
      alternate_phone: customer?.alternate_phone || null,
      alternate_phone_label: customer?.alternate_phone_label || null,
      email: customer?.email || '',
      address: extras.address,
      city: extras.city,
      country: extras.country,
      document: extras.document,
    },
    devices: [{
      typeLabel: deviceTypeConfig[repair.deviceType]?.label || repair.deviceType,
      brand: repair.brand,
      model: repair.model,
      serialNumber: repair.serialNumber,
      imei: repair.imei || repair.serialNumber,
      accessType: repair.accessType,
      accessPassword: repair.accessPassword,
      issue: repair.issue,
      description: repair.description,
      technician: repair.technician?.name || 'Sin asignar',
      estimatedCost: repair.estimatedCost,
      finalCost: repair.finalCost,
      paidAmount: repair.paidAmount,
      ticketNumber,
    }],
    finalCost: repair.finalCost || undefined,
    estimatedCost: repair.estimatedCost,
    paidAmount: repair.paidAmount,
    warrantyMonths: repair.warrantyMonths,
    warrantyType: repair.warrantyType,
    warrantyNotes: repair.warrantyNotes,
    company,
    verificationHash,
    financial: {
      total: financial.total,
      paid: financial.paid,
      balance: financial.balance,
      label: 'label' in financial ? financial.label : undefined,
      isUnrepaired: 'isUnrepaired' in financial ? Boolean(financial.isUnrepaired) : false,
    },
    // Ya entregada, se imprime el comprobante de entrega y no la orden de ingreso.
    stage: delivered ? 'delivery' : 'intake',
    deliveredAt: delivered ? toDate(repair.pickedUpAt) ?? toDate(repair.completedAt) : undefined,
    deliveryOutcome: repair.deliveryOutcome ?? undefined,
    warrantyExpiresAt: toDate(repair.warrantyExpiresAt),
    // Es una orden guardada: lo que se imprima es una copia.
    copyPrintedAt: new Date(),
  }
}

/**
 * Pide al servidor la firma del QR de seguimiento. Sin firma el comprobante
 * sale igual, sin QR.
 */
export async function fetchRepairVerificationHash(
  repair: Pick<Repair, 'ticketNumber' | 'id' | 'createdAt' | 'customer'>,
  signal?: AbortSignal
): Promise<string | undefined> {
  try {
    const response = await fetch('/api/repairs/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        ticketNumber: repairPrintTicketNumber(repair),
        customerName: repair.customer?.name || 'Cliente',
        date: new Date(repair.createdAt).toISOString(),
      }),
    })
    const body = await response.json().catch(() => null)
    return body?.success && typeof body.hash === 'string' ? body.hash : undefined
  } catch {
    return undefined
  }
}
