"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Coins,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, getDisplayLocale } from '@/lib/currency'
import {
  useCustomerCredits,
  type CreditInfo,
  type CustomerCreditSummary,
  type InstallmentInfo,
  type PaymentInfo,
} from '@/hooks/use-customer-credits'
import { useReprintCreditPayment } from '@/hooks/use-reprint-credit-payment'
import { Customer } from '@/hooks/use-customer-state'
import { formatDateOnlyDisplay } from '@/lib/date-only'
import { creditCalendarDate, creditInstallmentIsOverdue, DEFAULT_CREDIT_TIMEZONE } from '@/lib/credits/calendar'
import { useCreditPrinting } from '@/hooks/use-credit-printing'
import { CreditPaperPicker } from '@/components/dashboard/credits/CreditPaperPicker'
import { buildCustomerStatement, toStatementPdfInput, toStatementTicketInput, type CustomerStatement } from '@/lib/credits/customer-statement'
import { createCreditHistoryPdf } from '@/lib/credits/credit-history-pdf'
import { createCreditHistoryTicket } from '@/lib/credits/credit-history-ticket'
import { downloadPdfDocument, printPdfDocument } from '@/lib/credits/print-receipt'
import { CREDIT_PAPER_LABELS } from '@/lib/credits/paper'
import { createCustomerFilePdf } from '@/lib/customers/customer-file-pdf'

interface CustomerCreditInfoProps {
  customer: Customer
  compact?: boolean
  showActions?: boolean
  onOpenPayment?: () => void
  onEditCustomer?: () => void
}

/**
 * Créditos y pagos de un cliente, en una sola vista.
 *
 * Antes eran cuatro pestañas dentro de la pestaña de la ficha (resumen, deudas,
 * financiaciones, pagos), con el cupo y la deuda repetidos en tres lugares. Un
 * crédito anulado aparecía «En mora», se identificaba con un pedazo del id y
 * no tenía saldo, cuotas ni vencimiento; un pago no decía a qué cuota se
 * aplicó ni se podía reimprimir.
 */

const CREDIT_STATUS: Record<CreditInfo['status'], { label: string; className: string }> = {
  active: { label: 'Activo', className: 'border-primary/30 bg-primary/10 text-primary' },
  completed: { label: 'Pagado', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  defaulted: { label: 'En mora', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200' },
  cancelled: { label: 'Anulado', className: 'border-border bg-muted text-muted-foreground' },
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  store_credit: 'Saldo a favor',
}

const RISK = {
  low: { label: 'Riesgo bajo', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  medium: { label: 'Riesgo medio', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
  high: { label: 'Riesgo alto', className: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200' },
  critical: { label: 'Riesgo crítico', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200' },
} as const

const PAYMENTS_PAGE = 10

const creditCode = (credit: Pick<CreditInfo, 'id' | 'credit_code'>) =>
  credit.credit_code?.trim() || `Crédito ${credit.id.slice(0, 8).toUpperCase()}`

function Section({ title, icon: Icon, action, children, description }: {
  title: string
  icon: typeof Receipt
  action?: React.ReactNode
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            {title}
          </CardTitle>
          {description && <CardDescription className="mt-1 text-xs">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function CustomerCreditInfo({ customer, compact: _compact = false, showActions = true, onOpenPayment, onEditCustomer }: CustomerCreditInfoProps) {
  const { loading, error, creditSummary, credits, installments, payments, refresh } = useCustomerCredits(customer.id, customer)
  const reprintPayment = useReprintCreditPayment()
  const [expandedCredit, setExpandedCredit] = useState<string | null>(null)
  const [visiblePayments, setVisiblePayments] = useState(PAYMENTS_PAGE)
  const [printingId, setPrintingId] = useState<string | null>(null)
  // Qué documento se está armando: 'statement', 'file', 'file-download' o el id de un crédito.
  const [printingDoc, setPrintingDoc] = useState<string | null>(null)
  const { format, changeFormat, issuer } = useCreditPrinting()

  // El mismo estado de cuenta que imprime Créditos, armado con lo que ya cargó la ficha.
  const statement = useMemo(() => buildCustomerStatement(credits, installments), [credits, installments])

  const timeZone = creditSummary?.time_zone || DEFAULT_CREDIT_TIMEZONE

  // Cuotas de cada crédito, ordenadas, para el saldo, el avance y el vencimiento.
  const installmentsByCredit = useMemo(() => {
    const map = new Map<string, InstallmentInfo[]>()
    for (const installment of installments) {
      map.set(installment.credit_id, [...(map.get(installment.credit_id) ?? []), installment])
    }
    for (const list of map.values()) list.sort((a, b) => a.installment_number - b.installment_number)
    return map
  }, [installments])

  const installmentById = useMemo(() => new Map(installments.map((row) => [row.id, row])), [installments])
  const creditById = useMemo(() => new Map(credits.map((row) => [row.id, row])), [credits])

  const sortedCredits = useMemo(() => {
    const order: Record<CreditInfo['status'], number> = { defaulted: 0, active: 1, completed: 2, cancelled: 3 }
    return [...credits].sort((a, b) => order[a.status] - order[b.status] || +new Date(b.start_date) - +new Date(a.start_date))
  }, [credits])

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [payments]
  )
  const totalCollected = useMemo(() => payments.reduce((sum, row) => sum + Number(row.amount || 0), 0), [payments])

  if (loading || (!creditSummary && !error)) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando créditos">
        <div className="h-36 rounded-2xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
      </div>
    )
  }

  // Sin resumen hay dos situaciones distintas que se veian igual: un cliente sin
  // creditos, y una carga que fallo. En el segundo caso el respaldo de abajo
  // mostraba el limite completo como disponible, afirmando con seguridad un
  // numero que nadie verifico.
  if (error && !creditSummary) {
    return (
      <Card className="border-amber-300/70 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardContent role="alert" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                No pudimos cargar la situación crediticia
              </p>
              <p className="text-sm text-amber-800/90 dark:text-amber-200/80">
                No mostramos el cupo disponible para no darte un número equivocado. {error}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Cliente sin creditos: el respaldo es correcto, tiene todo su cupo libre.
  const summary: CustomerCreditSummary = creditSummary || {
    customer_id: customer.id,
    total_credits: 0,
    active_credits: 0,
    completed_credits: 0,
    defaulted_credits: 0,
    total_principal: 0,
    total_paid: 0,
    total_pending: 0,
    current_balance: 0,
    credit_limit: Number(customer.credit_limit || 0),
    available_credit: Number(customer.credit_limit || 0),
    credit_utilization: 0,
    store_balance: 0,
    store_reserved: 0,
    overdue_debt: 0,
    debts: [],
    payment_history: {
      on_time_payments: 0,
      late_payments: 0,
      missed_payments: 0,
      payment_score: 100
    },
    next_payment: null,
    risk_assessment: {
      risk_level: 'low',
      risk_score: 0,
      factors: ['Sin deudas registradas']
    }
  }

  const dateOnly = (value?: string | null) =>
    value ? formatDateOnlyDisplay(creditCalendarDate(value, timeZone) ?? value) : '—'
  const dateTime = (value: string) =>
    new Date(value).toLocaleString(getDisplayLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const risk = RISK[summary.risk_assessment.risk_level] ?? RISK.low
  const history = summary.payment_history
  const next = summary.next_payment

  const handleReprint = async (payment: PaymentInfo) => {
    setPrintingId(payment.id)
    try {
      await reprintPayment(payment, customer.name)
    } finally {
      setPrintingId(null)
    }
  }

  const party = {
    customerName: customer.name,
    customerCode: customer.customerCode || undefined,
    customerPhone: customer.phone || undefined,
    companyName: issuer.businessName,
    companyRuc: issuer.businessRuc,
    companyPhone: issuer.businessPhone,
    companyAddress: issuer.businessAddress,
  }

  const runPrint = async (key: string, build: () => Promise<void>) => {
    if (printingDoc) return
    setPrintingDoc(key)
    try {
      await build()
    } catch (printError) {
      toast.error('No se pudo generar el documento', {
        description: printError instanceof Error ? printError.message : 'Volvé a intentar.',
      })
    } finally {
      setPrintingDoc(null)
    }
  }

  // Estado de cuenta en el papel elegido: todos los créditos, o uno solo.
  const printStatement = (creditId?: string) => {
    const only = creditId ? statement.credits.filter((credit) => credit.id === creditId) : null
    const selected: CustomerStatement = only
      ? {
          credits: only,
          totalDebt: only.reduce((sum, credit) => sum + (credit.remainingBalance ?? 0), 0),
          totalPaid: only.reduce((sum, credit) => sum + (credit.totalPaid ?? 0), 0),
        }
      : statement
    return runPrint(creditId ?? 'statement', async () => {
      const doc = format === 'A4'
        ? await createCreditHistoryPdf(toStatementPdfInput(party, selected))
        : await createCreditHistoryTicket(toStatementTicketInput(party, selected), { format })
      await printPdfDocument(doc)
    })
  }

  // Ficha completa en A4: datos, situación, deudas, créditos con cuotas y pagos.
  const buildFileDoc = () => createCustomerFilePdf({
    company: { name: issuer.businessName, ruc: issuer.businessRuc, phone: issuer.businessPhone, address: issuer.businessAddress },
    customer: {
      name: customer.name,
      code: customer.customerCode,
      ruc: customer.ruc,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      city: customer.city,
      status: customer.status,
      segment: customer.segment,
      since: customer.registration_date || customer.created_at || null,
    },
    situation: {
      creditLimit: summary.credit_limit,
      totalDebt: summary.total_pending,
      overdueDebt: summary.overdue_debt,
      availableCredit: summary.available_credit,
      storeBalance: summary.store_balance,
      totalSpent: Number(customer.lifetime_value || 0) || null,
      purchases: Number(customer.total_purchases || 0) || null,
      nextDue: next?.due_date ? { date: creditCalendarDate(next.due_date, timeZone) ?? next.due_date, amount: next.amount } : null,
    },
    debts: summary.debts.map((debt) => ({
      title: debt.title,
      detail: debt.subtitle,
      dueDate: debt.dueDate ? creditCalendarDate(debt.dueDate, timeZone) ?? debt.dueDate : null,
      overdue: debt.isOverdue,
      pending: debt.pendingAmount,
      total: debt.totalAmount,
    })),
    statement,
    payments: sortedPayments.map((payment) => {
      const credit = creditById.get(payment.credit_id)
      return {
        createdAt: payment.created_at,
        amount: Number(payment.amount || 0),
        method: METHOD_LABELS[payment.payment_method ?? ''] ?? 'Sin especificar',
        creditCode: credit ? creditCode(credit) : 'Crédito',
        installmentNumber: payment.installment_id ? installmentById.get(payment.installment_id)?.installment_number : null,
        notes: payment.notes,
      }
    }),
  })

  const printFile = () => runPrint('file', async () => printPdfDocument(await buildFileDoc()))
  const downloadFile = () => runPrint('file-download', async () => {
    const slug = customer.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    downloadPdfDocument(await buildFileDoc(), `ficha-${slug || 'cliente'}.pdf`)
  })

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ─── Situación ─── */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  Situación del cliente
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={cn('cursor-help gap-1 text-xs', risk.className)}>
                        <Shield className="h-3 w-3" aria-hidden="true" />
                        {risk.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      {summary.risk_assessment.factors.join(' · ') || 'Sin factores de riesgo'}
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription className="mt-1 break-words">
                  {customer.name} · {customer.customerCode}{customer.ruc ? ' · CI/RUC: ' + customer.ruc : ''}
                </CardDescription>
              </div>
              {showActions && (
                <div className="flex flex-wrap gap-2">
                  {onOpenPayment && (
                    <Button onClick={onOpenPayment} className="min-h-11 gap-2" disabled={summary.total_pending <= 0}>
                      <Coins className="h-4 w-4" />Cobrar
                    </Button>
                  )}
                  {onEditCustomer && <Button variant="outline" onClick={onEditCustomer} className="min-h-11">Editar datos</Button>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="min-h-11 gap-2" disabled={printingDoc !== null}>
                        {printingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Imprimir
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ficha del cliente · hoja A4</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => void printFile()} className="items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4" />
                        <div>
                          <p className="font-medium">Imprimir ficha completa</p>
                          <p className="text-xs text-muted-foreground">Datos, situación, deudas, créditos con cuotas y pagos</p>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void downloadFile()} className="gap-2">
                        <Download className="h-4 w-4" />
                        <span className="font-medium">Descargar ficha en PDF</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Créditos · {CREDIT_PAPER_LABELS[format]}</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => void printStatement()} disabled={statement.credits.length === 0} className="items-start gap-2">
                        <Receipt className="mt-0.5 h-4 w-4" />
                        <div>
                          <p className="font-medium">Estado de cuenta completo</p>
                          <p className="text-xs text-muted-foreground">
                            {statement.credits.length === 0 ? 'No tiene créditos' : statement.credits.length === 1 ? 'El crédito con sus cuotas' : `Los ${statement.credits.length} créditos con sus cuotas`}
                          </p>
                        </div>
                      </DropdownMenuItem>
                      <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground">
                        Para un solo crédito, usá «Imprimir» en su tarjeta. El papel se cambia en la sección Créditos.
                      </p>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" onClick={refresh} className="min-h-11 gap-2" aria-label="Actualizar créditos">
                    <RefreshCw className="h-4 w-4" />Actualizar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Deuda total', value: summary.total_pending, help: 'Cuotas y reparaciones pendientes', tone: 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20' },
                { label: 'Deuda vencida', value: summary.overdue_debt, help: 'Parte de la deuda que está en mora', tone: 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20' },
                { label: 'Cupo disponible', value: summary.available_credit, help: summary.credit_limit > 0 ? `De ${formatCurrency(summary.credit_limit)} · ${summary.credit_utilization}% usado` : 'Sin límite de crédito asignado', tone: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' },
                { label: 'Saldo a favor', value: summary.store_balance, help: summary.store_reserved > 0 ? formatCurrency(summary.store_reserved) + ' reservado en pedidos' : 'Disponible para compras', tone: 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20' },
              ].map((metric) => (
                <div key={metric.label} className={cn('min-w-0 rounded-lg border p-3', metric.tone)}>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="mt-1 break-words text-lg font-bold tabular-nums sm:text-xl">{formatCurrency(metric.value)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.help}</p>
                </div>
              ))}
            </div>

            {summary.credit_limit > 0 && (
              <Progress
                value={summary.credit_utilization}
                aria-label="Uso del cupo de crédito"
                className={cn('h-2', summary.credit_utilization > 80 ? '[&>div]:bg-rose-500' : summary.credit_utilization > 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500')}
              />
            )}

            {/* Lo que más se busca al abrir la ficha: cuándo y cuánto paga la próxima vez. */}
            <div className={cn(
              'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
              next?.is_overdue ? 'border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20' : 'bg-muted/40'
            )}>
              <span className="flex items-center gap-2 font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Próximo vencimiento
              </span>
              {next ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{next.title || 'Cuota'}</span>
                  <span className="font-semibold">{next.due_date ? dateOnly(next.due_date) : 'Sin fecha'}</span>
                  <span className="font-bold tabular-nums">{formatCurrency(next.amount)}</span>
                  {next.is_overdue ? (
                    <Badge variant="destructive" className="text-xs">Vencido</Badge>
                  ) : next.days_until_due !== null ? (
                    <Badge variant="outline" className="text-xs">
                      {next.days_until_due === 0 ? 'Vence hoy' : `En ${next.days_until_due} día${next.days_until_due === 1 ? '' : 's'}`}
                    </Badge>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Sin cuotas pendientes</span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {history.payment_score === null
                ? 'Sin historial de pagos suficiente.'
                : `Pagos: ${history.on_time_payments} a tiempo · ${history.late_payments} con atraso · ${history.missed_payments} en mora.`}
              {' '}El saldo a favor no se descuenta automáticamente de la deuda. El cupo disponible no reemplaza la aprobación de la ficha para crédito.
            </p>
          </CardContent>
        </Card>

        {/* ─── Deudas pendientes ─── */}
        <Section
          title="Deudas pendientes"
          icon={Receipt}
          description="Cuotas y reparaciones que el cliente todavía debe."
          action={summary.debts.length > 0 && onOpenPayment ? (
            <Button size="sm" onClick={onOpenPayment} className="shrink-0 gap-1.5">
              <Coins className="h-4 w-4" />Cobrar
            </Button>
          ) : undefined}
        >
          {summary.debts.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              El cliente está al día: no tiene deudas pendientes.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border" role="list">
              {summary.debts.map((debt) => (
                <li key={debt.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {debt.title}
                      {debt.isOverdue && <Badge variant="destructive" className="text-xs">Vencida</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[debt.subtitle, debt.dueDate ? `Vence ${dateOnly(debt.dueDate)}` : null, debt.debtReason ? `Motivo: ${debt.debtReason}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{formatCurrency(debt.pendingAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      de {formatCurrency(debt.totalAmount)}{debt.paidAmount > 0 ? ` · pagado ${formatCurrency(debt.paidAmount)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ─── Créditos ─── */}
        <Section
          title={`Créditos (${credits.length})`}
          icon={CreditCard}
          description="Cada crédito con su saldo, avance y próximo vencimiento."
          action={credits.length > 0 ? <CreditPaperPicker value={format} onChange={changeFormat} className="shrink-0 justify-end" /> : undefined}
        >
          {sortedCredits.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No tiene créditos en cuotas.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedCredits.map((credit) => {
                const rows = installmentsByCredit.get(credit.id) ?? []
                const total = rows.length > 0 ? rows.reduce((sum, row) => sum + Number(row.amount || 0), 0) : Number(credit.principal || 0)
                const paid = rows.reduce((sum, row) => sum + Math.min(Number(row.amount || 0), Math.max(0, Number(row.amount_paid || 0))), 0)
                const balance = credit.status === 'cancelled' ? 0 : Math.max(0, total - paid)
                const paidCount = rows.filter((row) => row.status === 'paid' || Number(row.amount_paid || 0) >= Number(row.amount || 0)).length
                const nextRow = rows.find((row) => row.status !== 'paid' && Number(row.amount_paid || 0) < Number(row.amount || 0))
                const nextOverdue = nextRow ? creditInstallmentIsOverdue(nextRow.due_date, nextRow.status, timeZone) : false
                const status = CREDIT_STATUS[credit.status] ?? CREDIT_STATUS.active
                const expanded = expandedCredit === credit.id
                return (
                  <div key={credit.id} className="rounded-xl border">
                    <div className="space-y-3 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold">{creditCode(credit)}</span>
                          <Badge variant="outline" className={cn('text-xs', status.className)}>{status.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Desde {dateOnly(credit.start_date)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => void printStatement(credit.id)}
                            disabled={printingDoc !== null}
                            title={`Imprimir el estado de cuenta de ${creditCode(credit)}`}
                          >
                            {printingDoc === credit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" aria-hidden="true" />}
                            Imprimir
                          </Button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-muted-foreground">Total financiado</dt>
                          <dd className="font-semibold tabular-nums">{formatCurrency(total)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Pagado</dt>
                          <dd className="font-semibold tabular-nums">{formatCurrency(paid)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Saldo</dt>
                          <dd className="font-bold tabular-nums">{formatCurrency(balance)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Próximo vencimiento</dt>
                          <dd className={cn('font-semibold', nextOverdue && 'text-rose-600 dark:text-rose-400')}>
                            {nextRow ? `${dateOnly(nextRow.due_date)}${nextOverdue ? ' · vencido' : ''}` : '—'}
                          </dd>
                        </div>
                      </dl>
                      {rows.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{paidCount} de {rows.length} cuotas pagadas</span>
                            {credit.interest_rate > 0 && <span>Interés {credit.interest_rate}%</span>}
                          </div>
                          <Progress value={rows.length ? (paidCount / rows.length) * 100 : 0} className="h-1.5" aria-label={`${paidCount} de ${rows.length} cuotas pagadas`} />
                        </div>
                      )}
                    </div>
                    {rows.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedCredit(expanded ? null : credit.id)}
                          aria-expanded={expanded}
                          className="flex w-full items-center justify-center gap-1 border-t py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        >
                          {expanded ? 'Ocultar cuotas' : 'Ver cuotas'}
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                        </button>
                        {expanded && (
                          <div className="overflow-x-auto border-t">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/40 text-xs text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Cuota</th>
                                  <th className="px-3 py-2 text-left font-medium">Vence</th>
                                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                                  <th className="px-3 py-2 text-right font-medium">Pagado</th>
                                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {rows.map((row) => {
                                  const rowPaid = Math.max(0, Number(row.amount_paid || 0))
                                  const done = row.status === 'paid' || rowPaid >= Number(row.amount || 0)
                                  const overdue = !done && creditInstallmentIsOverdue(row.due_date, row.status, timeZone)
                                  return (
                                    <tr key={row.id}>
                                      <td className="px-3 py-2 tabular-nums">{row.installment_number}</td>
                                      <td className="px-3 py-2">{dateOnly(row.due_date)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(row.amount || 0))}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(rowPaid)}</td>
                                      <td className="px-3 py-2">
                                        <Badge
                                          variant="outline"
                                          className={cn('text-xs', done ? CREDIT_STATUS.completed.className : overdue ? CREDIT_STATUS.defaulted.className : '')}
                                        >
                                          {done ? 'Pagada' : overdue ? 'Vencida' : rowPaid > 0 ? 'Parcial' : 'Pendiente'}
                                        </Badge>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* ─── Pagos ─── */}
        <Section
          title={`Pagos (${payments.length})`}
          icon={Coins}
          description={payments.length > 0 ? `Total cobrado en cuotas: ${formatCurrency(totalCollected)}` : undefined}
        >
          {sortedPayments.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay pagos de cuotas registrados.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                      <th className="px-3 py-2 text-left font-medium">Medio</th>
                      <th className="px-3 py-2 text-left font-medium">Aplicado a</th>
                      <th className="px-3 py-2 text-right font-medium"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedPayments.slice(0, visiblePayments).map((payment) => {
                      const credit = creditById.get(payment.credit_id)
                      const installment = payment.installment_id ? installmentById.get(payment.installment_id) : undefined
                      return (
                        <tr key={payment.id} className="align-top">
                          <td className="whitespace-nowrap px-3 py-2">{dateTime(payment.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(Number(payment.amount || 0))}</td>
                          <td className="px-3 py-2">{METHOD_LABELS[payment.payment_method ?? ''] ?? 'Sin especificar'}</td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs">{credit ? creditCode(credit) : 'Crédito'}</span>
                            {installment && <span className="text-muted-foreground"> · Cuota {installment.installment_number}</span>}
                            {payment.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground" title={payment.notes}>{payment.notes}</p>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => void handleReprint(payment)}
                              disabled={printingId === payment.id}
                              title="Reimprimir comprobante"
                            >
                              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Reimprimir</span>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {sortedPayments.length > visiblePayments && (
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => setVisiblePayments((count) => count + PAYMENTS_PAGE)}>
                    Ver más ({sortedPayments.length - visiblePayments} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </Section>
      </div>
    </TooltipProvider>
  )
}
