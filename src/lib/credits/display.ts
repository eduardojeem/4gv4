import { formatCreditId } from '@/lib/utils'
import type { CreditRow, InstallmentRow } from '@/hooks/use-credits'

/**
 * Lo minimo que la vista necesita de una venta. Se exporta para que el hook
 * declare exactamente esta forma: antes guardaba las ventas como
 * `Record<string, unknown>` y el compilador no podia verificar nada, asi que un
 * cambio en la consulta solo se notaba cuando el credito ya se veia mal.
 */
export type SaleLike = {
  id: string
  code?: string | null
  created_at?: string | null
  total_amount?: number | null
}

export type SaleItemLike = {
  sale_id?: string | null
  quantity?: number | null
  product?: { name?: string | null } | null
}

export type CreditDisplayInfo = {
  creditCode: string
  originLabel: string
  originDescription: string
  creditTypeLabel: string
  creditLabel: string
  saleCode?: string
  saleId?: string
  productSummary: string
  installmentCount: number
  paidInstallmentCount: number
  pendingInstallmentCount: number
  nextInstallment?: InstallmentRow
  nextInstallmentLabel: string
}

const CREDIT_TYPE_LABELS: Record<string, string> = {
  product_financing: 'Financiacion de productos',
  service_financing: 'Financiacion de servicios',
  repair_financing: 'Financiacion de reparacion',
  cash_loan: 'Prestamo',
  carry_over_balance: 'Saldo trasladado',
  refinancing: 'Refinanciacion',
  manual: 'Credito manual',
}

const ORIGIN_LABELS: Record<string, string> = {
  sale: 'Compra POS',
  repair: 'Reparacion',
  manual: 'Manual',
  migration: 'Migrado',
  refinancing: 'Refinanciado',
}

export function getCreditDisplayInfo(
  credit: CreditRow | undefined,
  installments: InstallmentRow[],
  sales: SaleLike[] = [],
  saleItems: SaleItemLike[] = []
): CreditDisplayInfo {
  const creditInstallments = credit
    ? installments.filter((installment) => installment.credit_id === credit.id)
    : []
  const linkedSaleId = credit?.sale_id || creditInstallments.find((installment) => installment.sale_id)?.sale_id || undefined
  const linkedSale = linkedSaleId ? sales.find((sale) => sale.id === linkedSaleId) : undefined
  const linkedItems = linkedSaleId ? saleItems.filter((item) => item.sale_id === linkedSaleId) : []
  const explicitCreditCode = credit?.credit_code?.trim() || undefined
  const explicitLabel = credit?.label?.trim() || undefined
  const explicitOrigin = credit?.origin_type?.trim() || undefined
  const explicitCreditType = credit?.credit_type?.trim() || undefined
  const openInstallments = creditInstallments
    .filter((installment) => installment.status !== 'paid')
    .sort((a, b) => a.installment_number - b.installment_number)
  const nextInstallment = openInstallments[0]
  const paidInstallmentCount = creditInstallments.filter((installment) => installment.status === 'paid').length

  const productSummary = linkedItems.length > 0
    ? linkedItems
        .slice(0, 2)
        .map((item) => {
          const quantity = Number(item.quantity || 1)
          const name = item.product?.name || 'Producto'
          return `${quantity}x ${name}`
        })
        .join(', ')
    : linkedSale
      ? 'Venta POS sin detalle de productos'
      : 'Saldo anterior o credito manual'

  const saleCode = credit?.sale_code || linkedSale?.code || undefined
  const originLabel = explicitOrigin
    ? (ORIGIN_LABELS[explicitOrigin] || explicitOrigin)
    : linkedSale
      ? 'Compra POS'
      : 'Saldo anterior'
  const creditTypeLabel = explicitCreditType
    ? (CREDIT_TYPE_LABELS[explicitCreditType] || explicitCreditType)
    : linkedSale
      ? 'Financiacion de productos'
      : 'Credito manual'
  const creditLabel = explicitLabel
    || (saleCode ? `Venta ${saleCode}` : linkedSale ? 'Venta POS' : 'Saldo anterior o credito manual')

  return {
    creditCode: explicitCreditCode || formatCreditId(credit?.id),
    originLabel,
    originDescription: linkedSale
      ? 'Venta a credito vinculada a ticket'
      : explicitOrigin === 'migration'
        ? 'Credito migrado desde datos anteriores'
        : explicitOrigin === 'manual'
          ? 'Credito cargado manualmente'
          : 'Credito consolidado o migrado',
    creditTypeLabel,
    creditLabel,
    saleCode,
    saleId: linkedSale?.id,
    productSummary,
    installmentCount: creditInstallments.length,
    paidInstallmentCount,
    pendingInstallmentCount: openInstallments.length,
    nextInstallment,
    nextInstallmentLabel: nextInstallment
      ? `Cuota #${nextInstallment.installment_number}`
      : creditInstallments.length > 0
        ? 'Sin cuotas pendientes'
        : 'Sin plan de cuotas',
  }
}

export function getInstallmentDisplayInfo(
  installment: InstallmentRow,
  credit: CreditRow | undefined,
  installments: InstallmentRow[],
  sales: SaleLike[] = [],
  saleItems: SaleItemLike[] = []
): CreditDisplayInfo {
  const display = getCreditDisplayInfo(credit, installments, sales, saleItems)
  const saleId = installment.sale_id || display.saleId
  const sale = saleId ? sales.find((row) => row.id === saleId) : undefined
  const items = saleId ? saleItems.filter((item) => item.sale_id === saleId) : []

  return {
    ...display,
    originLabel: sale ? 'Compra POS' : display.originLabel,
    originDescription: sale ? 'Cuota vinculada a una venta POS' : display.originDescription,
    saleCode: sale?.code || display.saleCode,
    saleId: sale?.id || display.saleId,
    productSummary: items.length > 0
      ? items
          .slice(0, 2)
          .map((item) => `${Number(item.quantity || 1)}x ${item.product?.name || 'Producto'}`)
          .join(', ')
      : display.productSummary,
  }
}
