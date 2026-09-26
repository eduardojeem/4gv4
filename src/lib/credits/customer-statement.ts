import type { CreditRow, InstallmentRow } from '@/hooks/use-credits'
import { resolveInstallmentStatus } from './display'
import type { CreditHistoryItem, CreditHistoryPdfInput } from './credit-history-pdf'
import type { CreditHistoryTicketInput } from './credit-history-ticket'

/**
 * Estado de cuenta de un cliente: todos sus creditos en un solo documento.
 *
 * Los generadores (A4 y ticket de 80mm) existian completos pero nadie los
 * llamaba, asi que no habia forma de entregarle a un cliente el resumen de su
 * deuda. Esto arma su entrada a partir de los datos que la pagina ya tiene en
 * memoria, sin consultas nuevas.
 */

export type CustomerStatementParty = {
  customerName: string
  customerCode?: string
  customerPhone?: string
  companyName: string
  companyPhone?: string
  companyAddress?: string
}

export type CustomerStatement = {
  credits: CreditHistoryItem[]
  totalDebt: number
  totalPaid: number
}

function creditTotals(installments: InstallmentRow[]) {
  let charged = 0
  let paid = 0
  for (const installment of installments) {
    charged += Number(installment.amount || 0)
    // Un `amount_paid` negativo no existe como concepto; si llega, se ignora en
    // vez de inflar el saldo pendiente.
    paid += Math.max(0, Number(installment.amount_paid || 0))
  }
  return { charged, paid, remaining: Math.max(0, charged - paid) }
}

export function buildCustomerStatement(
  credits: CreditRow[],
  installments: InstallmentRow[],
  now: Date = new Date()
): CustomerStatement {
  const byCredit = new Map<string, InstallmentRow[]>()
  for (const installment of installments) {
    const list = byCredit.get(installment.credit_id)
    if (list) list.push(installment)
    else byCredit.set(installment.credit_id, [installment])
  }

  // Del mas nuevo al mas viejo: el credito vigente es lo que el cliente quiere
  // ver primero, y en un ticket de 80mm lo que sigue puede quedar lejos.
  const ordered = [...credits].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  )

  let totalDebt = 0
  let totalPaid = 0

  const items: CreditHistoryItem[] = ordered.map((credit) => {
    const own = (byCredit.get(credit.id) ?? []).slice().sort(
      (a, b) => a.installment_number - b.installment_number
    )
    const { paid, remaining } = creditTotals(own)

    // Un credito anulado se sigue mostrando como historial, pero su saldo no es
    // deuda: cobrarselo al cliente en el total seria reclamarle algo que la
    // propia tienda dio de baja. Lo que ya pago, en cambio, lo pago de verdad y
    // suma igual.
    if (credit.status !== 'cancelled') totalDebt += remaining
    totalPaid += paid

    return {
      id: credit.id,
      creditCode: credit.credit_code ?? undefined,
      principal: Number(credit.principal || 0),
      interestRate: Number(credit.interest_rate || 0),
      termMonths: Number(credit.term_months || 0),
      startDate: credit.start_date,
      status: credit.status,
      totalPaid: paid,
      remainingBalance: credit.status === 'cancelled' ? 0 : remaining,
      installments: own.map((installment) => ({
        number: installment.installment_number,
        dueDate: installment.due_date,
        amount: Number(installment.amount || 0),
        amountPaid: Math.max(0, Number(installment.amount_paid || 0)),
        // El mismo estado que muestra la pantalla, no el de la base.
        status: resolveInstallmentStatus(installment, now),
      })),
    }
  })

  return { credits: items, totalDebt, totalPaid }
}

export function toStatementPdfInput(
  party: CustomerStatementParty,
  statement: CustomerStatement,
  generatedAt?: Date
): CreditHistoryPdfInput {
  return { ...party, ...statement, generatedAt }
}

export function toStatementTicketInput(
  party: CustomerStatementParty,
  statement: CustomerStatement
): CreditHistoryTicketInput {
  return { ...party, ...statement }
}
