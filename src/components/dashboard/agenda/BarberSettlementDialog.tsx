'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Calculator, CalendarRange, CheckCircle2, Copy, History, Loader2, MessageCircle, Printer, RotateCcw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { formatCurrency } from '@/lib/currency'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'
import type { Appointment } from '@/components/dashboard/agenda/types'
import { addDays, todayIn, utcToZoned } from '@/lib/agenda/time'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionals: AgendaProfessional[]
  currency?: string
  timeZone?: string
  defaultProfessionalId?: string
}

type PeriodPreset = 'today' | 'this_week' | 'last_week' | 'this_month' | 'custom'

type HistoricalSettlement = {
  id: string
  professional_id: string
  professional_name: string
  receipt_code: string
  period_preset: string
  period_from: string
  period_to: string
  appointments_count: number
  total_billed: number
  commission_rate: number
  commission_amount: number
  deductions_amount: number
  advances_vales_amount: number
  tips_amount: number
  net_amount: number
  remuneration_type: string
  payment_method: string
  payment_reference: string | null
  cash_movement_id: string | null
  settled_at: string
  status: string
  cancellation_reason?: string | null
  cancelled_by?: string | null
  cancelled_at?: string | null
}

/** Devuelve las fechas de inicio y fin para los rangos de liquidación */
function getPeriodDates(preset: PeriodPreset, timeZone: string) {
  const today = todayIn(timeZone)
  const d = new Date(today + 'T12:00:00Z')
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  if (preset === 'today') {
    return { from: today, to: today, days: 1 }
  }

  if (preset === 'this_week') {
    const monday = addDays(today, diffToMonday)
    const sunday = addDays(monday, 6) // Lunes a Domingo (7 días completos para incluir turnos dominicales)
    return { from: monday, to: sunday, days: 7 }
  }

  if (preset === 'last_week') {
    const lastMonday = addDays(today, diffToMonday - 7)
    const lastSunday = addDays(lastMonday, 6)
    return { from: lastMonday, to: lastSunday, days: 7 }
  }

  // this_month
  const firstDay = today.slice(0, 8) + '01'
  return { from: firstDay, to: today, days: Math.max(1, parseInt(today.slice(8, 10), 10)) }
}

/** Convierte un 'YYYY-MM-DD' a Date local (mediodía) para el selector de rango. */
function isoToDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

/** Convierte un Date a 'YYYY-MM-DD' usando su fecha local. */
function dateToIso(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Escapa texto antes de inyectarlo en el HTML del comprobante imprimible. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  )
}

export function BarberSettlementDialog({
  open,
  onOpenChange,
  professionals,
  currency = 'PYG',
  timeZone = 'America/Asuncion',
  defaultProfessionalId,
}: Props) {
  const [operationError, setOperationError] = useState<string | null>(null)
  const [mfaPath, setMfaPath] = useState<string | null>(null)
  const [reviewingPayment, setReviewingPayment] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<HistoricalSettlement | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [activeTab, setActiveTab] = useState<'liquidate' | 'history'>('liquidate')
  const [selectedProfId, setSelectedProfId] = useState<string>(
    defaultProfessionalId || (professionals[0]?.id ?? 'all')
  )
  const submissionLock = useRef(false)
  const attempt = useRef<{key:string; code:string} | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [appointmentsError, setAppointmentsError] = useState(false)
  const [preset, setPreset] = useState<PeriodPreset>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mitiendapy_settlement_preset') as PeriodPreset | null
        if (saved && ['today', 'this_week', 'last_week', 'this_month'].includes(saved)) {
          return saved
        }
      } catch {
        // ignore
      }
    }
    return 'this_week'
  })

  const handlePresetChange = (newPreset: PeriodPreset) => {
    setPreset(newPreset)
    try {
      localStorage.setItem('mitiendapy_settlement_preset', newPreset)
    } catch {
      // ignore
    }
  }

  const [valesAmount, setValesAmount] = useState<number>(0)
  const [tipsAmount, setTipsAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qr'>('cash')
  const [paymentRef, setPaymentRef] = useState<string>('')
  const [settledState, setSettledState] = useState<{
    receiptCode: string
    settledAt: string
    method: string
    amount: number
  } | null>(null)
  // Recibo optimista: se agrega localmente de inmediato al confirmar para que el saldo refleje
  // el pago sin esperar a que loadBalanceSettlements() termine la re-fetch de la API.
  const [optimisticSettlement, setOptimisticSettlement] = useState<HistoricalSettlement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [settlementsHistory, setSettlementsHistory] = useState<HistoricalSettlement[]>([])
  const [balanceSettlements, setBalanceSettlements] = useState<HistoricalSettlement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState(false)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  // Rango personalizado (preset "custom") para resolver períodos que no coinciden con los presets.
  const [customFrom, setCustomFrom] = useState<string>(() => getPeriodDates('this_week', timeZone).from)
  const [customTo, setCustomTo] = useState<string>(() => getPeriodDates('this_week', timeZone).to)
  const [cashSession, setCashSession] = useState<{ count: number; registerName: string | null } | null>(null)
  // Filtros de la pestaña Historial (el GET ya soporta professionalId/from/to).
  const [historyProfId, setHistoryProfId] = useState<string>('all')
  const [historyStatus, setHistoryStatus] = useState<'all' | 'paid' | 'cancelled'>('all')
  const [historyFrom, setHistoryFrom] = useState<string>('')
  const [historyTo, setHistoryTo] = useState<string>('')

  // Resetear estado liquidado si cambia el barbero o período
  useEffect(() => {
    setSettledState(null)
    setOptimisticSettlement(null)
    setReviewingPayment(false)
    setOperationError(null)
    setMfaPath(null)
    setValesAmount(0)
    setTipsAmount(0)
    setPaymentRef('')
  }, [selectedProfId, preset])

  const dates = useMemo(() => {
    if (preset === 'custom') {
      const from = customFrom <= customTo ? customFrom : customTo
      const to = customFrom <= customTo ? customTo : customFrom
      const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1)
      return { from, to, days }
    }
    return getPeriodDates(preset, timeZone)
  }, [preset, timeZone, customFrom, customTo])

  // Cargar turnos del período
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/api/agenda?date=${dates.from}&days=${dates.days}`)
        .then((res) => { if (!res.ok) throw new Error('appointments'); return res.json() })
        .then((payload: { appointments?: Appointment[] } | null) => {
          if (cancelled) return
          setAppointmentsError(false)
          setAppointments(payload?.appointments ?? [])
        })
        .catch(() => {
          if (!cancelled) { setAppointmentsError(true); setAppointments([]); toast.error('No se pudieron cargar los turnos del período') }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, dates.from, dates.days, retryToken])

  // Historial de liquidaciones (pestaña Historial), paginado y filtrado en el servidor.
  const HISTORY_PAGE_SIZE = 20
  const loadHistory = ({ reset }: { reset: boolean }) => {
    if (reset) setLoadingHistory(true)
    else setLoadingMoreHistory(true)
    if (reset) setHistoryError(false)
    const offset = reset ? 0 : settlementsHistory.length
    const params = new URLSearchParams({ offset: String(offset), limit: String(HISTORY_PAGE_SIZE) })
    if (historyProfId !== 'all') params.set('professionalId', historyProfId)
    if (historyStatus !== 'all') params.set('status', historyStatus)
    if (historyFrom) params.set('from', historyFrom)
    if (historyTo) params.set('to', historyTo)
    fetch(`/api/agenda/settlements?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          const hasMfa = typeof body?.mfaPath === 'string' && body.mfaPath.startsWith('/auth/mfa?')
          if (hasMfa) { setMfaPath(body.mfaPath); setOperationError(body?.error || 'Verificá tu sesión en dos pasos.') }
          if (body?.code === 'MIGRATION_REQUIRED') setMigrationPending(true)
          throw new Error('history')
        }
        return body
      })
      .then((data: { settlements?: HistoricalSettlement[]; hasMore?: boolean; migrationPending?: boolean }) => {
        if (data.migrationPending) { setMigrationPending(true); return }
        setMigrationPending(false)
        setHistoryHasMore(Boolean(data.hasMore))
        setSettlementsHistory(prev => reset ? (data.settlements ?? []) : [...prev, ...(data.settlements ?? [])])
      })
      .catch(() => { if (reset) { setHistoryError(true); toast.error('No se pudo cargar el historial. Volvé a intentar.') } else { toast.error('No se pudo cargar más pagos.') } })
      .finally(() => { setLoadingHistory(false); setLoadingMoreHistory(false) })
  }

  // Saldos del período para TODOS los profesionales (permite mostrar cuánto se le debe a cada uno)
  // y contexto de la caja abierta. El filtrado por profesional se hace en memoria.
  const loadBalanceSettlements = () => {
    setLoadingBalance(true)
    setBalanceError(false)
    fetch(`/api/agenda/settlements?from=${dates.from}&to=${dates.to}&limit=200&context=1`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          const hasMfa = typeof body?.mfaPath === 'string' && body.mfaPath.startsWith('/auth/mfa?')
          if (hasMfa) { setMfaPath(body.mfaPath); setOperationError(body?.error || 'Verificá tu sesión en dos pasos.') }
          if (body?.code === 'MIGRATION_REQUIRED') setMigrationPending(true)
          throw new Error('balance')
        }
        return body
      })
      .then((data: { settlements?: HistoricalSettlement[]; migrationPending?: boolean; cashSession?: { count: number; registerName: string | null } | null }) => {
        if (data.migrationPending) { setMigrationPending(true); return }
        setBalanceSettlements(data.settlements ?? [])
        setCashSession(data.cashSession ?? null)
      })
      .catch(() => setBalanceError(true))
      .finally(() => setLoadingBalance(false))
  }

  useEffect(() => {
    if (open) loadHistory({ reset: true })
  }, [open, retryToken, historyProfId, historyStatus, historyFrom, historyTo])

  useEffect(() => {
    if (open) loadBalanceSettlements()
  }, [open, dates.from, dates.to, retryToken])

  const handleCancelSettlement = async (settlementId: string, receiptCode: string) => {
    if (cancellingId || submissionLock.current || cancellationReason.trim().length < 5) return
    setCancellingId(settlementId)
    try {
      const res = await fetch('/api/agenda/settlements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId, action: 'cancel', reason: cancellationReason.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        setOptimisticSettlement(null)
        setSettledState(null)
        setCancelTarget(null)
        toast.success(`Liquidación ${receiptCode} anulada`)
        loadHistory({ reset: true })
        loadBalanceSettlements()
      } else {
        toast.error(data?.error || 'No se pudo anular la liquidación')
      }
    } catch {
      toast.error('Error de conexión al anular la liquidación')
    } finally {
      setCancellingId(null)
    }
  }

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === selectedProfId) ?? null,
    [professionals, selectedProfId]
  )

  // Filtramos turnos del barbero seleccionado que no estén cancelados ni no_show
  const allPeriodAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (selectedProfId !== 'all' && appt.professional_id !== selectedProfId) return false
      return appt.status !== 'cancelled' && appt.status !== 'no_show'
    })
  }, [appointments, selectedProfId])

  // Turnos atendidos (comisionables) vs turnos futuros por venir
  const { relevantAppointments, upcomingAppointments } = useMemo(() => {
    const attended: Appointment[] = []
    const upcoming: Appointment[] = []

    const sorted = [...allPeriodAppointments].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )

    for (const appt of sorted) {
      const isCompleted = appt.status === 'completed'
      if (isCompleted) {
        attended.push(appt)
      } else {
        upcoming.push(appt)
      }
    }
    return { relevantAppointments: attended, upcomingAppointments: upcoming }
  }, [allPeriodAppointments])

  // Porcentajes de comisión del barbero o modelo de alquiler de sillón
  const isChairRental = selectedProfessional?.remuneration_type === 'chair_rental'
  const commServicesRate = isChairRental ? 100 : selectedProfessional?.remuneration_type === 'fixed' ? 0 : (selectedProfessional?.commission_rate_services ?? 50)
  const chairRentalAmount = isChairRental ? (selectedProfessional?.commission_fixed_deduction ?? 0) : 0
  const fixedDeduction = isChairRental ? 0 : (selectedProfessional?.commission_fixed_deduction ?? 0)

  // Métricas financieras calculadas de los servicios atendidos en el período
  const totalBilled = relevantAppointments.reduce((acc, appt) => acc + (appt.price || 0), 0)
  const totalCompletedCount = relevantAppointments.length

  const rawBarberCutCommission = isChairRental ? totalBilled : totalBilled * (commServicesRate / 100)
  const totalDeductions = isChairRental ? chairRentalAmount : fixedDeduction * totalCompletedCount
  const barberNetServices = isChairRental
    ? Math.max(0, totalBilled - chairRentalAmount)
    : Math.max(0, rawBarberCutCommission - totalDeductions)

  // Liquidaciones previas ya pagadas y asentadas en este período para el barbero seleccionado.
  // Combina el historial de la API con el recibo optimista local recién guardado en esta sesión,
  // para que el saldo refleje el pago de inmediato sin esperar a que la re-fetch termine.
  const periodSettlements = useMemo(() => {
    const paid = balanceSettlements.filter((s) => {
      if (s.status !== 'paid') return false
      if (selectedProfId !== 'all' && s.professional_id !== selectedProfId) return false
      return s.period_from <= dates.to && s.period_to >= dates.from
    })
    // Si ya tenemos el optimista Y no está duplicado en los datos del servidor, lo añadimos
    if (
      optimisticSettlement &&
      !paid.some((s) => s.receipt_code === optimisticSettlement.receipt_code)
    ) {
      return [...paid, optimisticSettlement]
    }
    return paid
  }, [balanceSettlements, optimisticSettlement, selectedProfId, dates.from, dates.to])

  const totalSettledAppointmentsCount = useMemo(() => {
    return periodSettlements.reduce((acc, s) => acc + Number(s.appointments_count || 0), 0)
  }, [periodSettlements])

  // Total ya liquidado y pagado en comprobantes previos del período.
  // La fuente de verdad es siempre net_amount (lo que se le entregó en efectivo/transfer/QR)
  // más advances_vales_amount (vales/adelantos que se descontaron del pago en ese recibo).
  // Esa suma es exactamente la porción de la comisión que ya quedó cubierta en ese comprobante.
  const totalCommissionAlreadySettled = useMemo(() => {
    return periodSettlements.reduce((acc, s) => {
      const net = Number(s.net_amount || 0)
      const vales = Number(s.advances_vales_amount || 0)
      return acc + net + vales - Number(s.tips_amount || 0)
    }, 0)
  }, [periodSettlements])

  // Alias para mantener compatibilidad con tests y textos existentes
  const totalAlreadyPaid = totalCommissionAlreadySettled

  // Total neto pagable en este período (servicios + propinas - vales nuevos)
  const totalPeriodPayable = barberNetServices + tipsAmount - valesAmount

  // Saldo real pendiente a liquidar hoy:
  // Es lo que falta para cubrir el total del período, descontando lo que ya se pagó en recibos previos.
  // Math.max(0,...) para nunca mostrar saldo negativo aunque haya sobrepago.
  const pendingBalance = Math.max(0, totalPeriodPayable - totalCommissionAlreadySettled)
  const isFullySettled = totalAlreadyPaid > 0 && barberNetServices <= totalAlreadyPaid && tipsAmount === 0 && valesAmount === 0


  // Turnos no liquidados (remanentes por nuevos cortes agregados con posterioridad)
  const unsettledAppointmentsCount = Math.max(0, totalCompletedCount - totalSettledAppointmentsCount)

  // Saldo pendiente por profesional para el período actual (para mostrarlo en el selector y en un total).
  const professionalSummaries = useMemo(() => {
    return professionals.map((prof) => {
      const attended = appointments.filter((appt) => appt.professional_id === prof.id && appt.status === 'completed')
      const billed = attended.reduce((acc, appt) => acc + (appt.price || 0), 0)
      const count = attended.length
      const chair = prof.remuneration_type === 'chair_rental'
      const rate = chair ? 100 : prof.remuneration_type === 'fixed' ? 0 : (prof.commission_rate_services ?? 50)
      const gross = chair ? billed : billed * (rate / 100)
      const deduction = chair || prof.remuneration_type === 'fixed' ? 0 : (prof.commission_fixed_deduction ?? 0) * count
      const netServices = chair
        ? Math.max(0, billed - (prof.commission_fixed_deduction ?? 0))
        : Math.max(0, gross - deduction)
      const covered = balanceSettlements.reduce((acc, s) => {
        if (s.status !== 'paid' || s.professional_id !== prof.id) return acc
        if (!(s.period_from <= dates.to && s.period_to >= dates.from)) return acc
        return acc + Number(s.net_amount || 0) + Number(s.advances_vales_amount || 0) - Number(s.tips_amount || 0)
      }, 0)
      return { id: prof.id, name: prof.name, pending: Math.max(0, netServices - covered) }
    })
  }, [professionals, appointments, balanceSettlements, dates.from, dates.to])

  const totalPendingAll = useMemo(
    () => professionalSummaries.reduce((acc, item) => acc + item.pending, 0),
    [professionalSummaries]
  )

  const generateWhatsAppMessage = () => settledState
    ? `Recibo ${settledState.receiptCode}\nProfesional: ${selectedProfessional?.name}\nPagado: ${formatCurrency(settledState.amount, { currency })}\nMedio: ${settledState.method}\nFecha: ${settledState.settledAt}`
    : ''

  const handleConfirmSettlement = async () => {
    if (submissionLock.current || !reviewingPayment || !adjustmentsValid || overlappingPeriod || historyError || appointmentsError || loading || loadingHistory) return
    if (pendingBalance <= 0) {
      if (isFullySettled) {
        toast.info('Este período ya se encuentra totalmente liquidado y al día.')
      } else {
        toast.warning('No hay importes ni turnos a liquidar en este período.')
      }
      return
    }

    if (!selectedProfessional) {
      toast.error('Seleccioná un profesional para liquidar')
      return
    }

    submissionLock.current = true
    setOperationError(null)
    setIsSubmitting(true)
    try {
      const profName = selectedProfessional.name || 'STAFF'
      const amountToPay = pendingBalance
      const countForThisPayment = unsettledAppointmentsCount > 0 ? unsettledAppointmentsCount : totalCompletedCount
      const attemptKey = JSON.stringify([selectedProfessional.id,dates.from,dates.to,pendingBalance,countForThisPayment,valesAmount,tipsAmount,paymentMethod,paymentRef])
      if (attempt.current?.key !== attemptKey) attempt.current = {key:attemptKey,code:`LIQ-${crypto.randomUUID()}`}
      const code = attempt.current.code
      const methodLabel =
        paymentMethod === 'cash'
          ? 'Efectivo (Caja POS)'
          : paymentMethod === 'transfer'
          ? 'Transferencia Bancaria'
          : 'Billetera / QR'

      const res = await fetch('/api/agenda/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId: selectedProfessional.id,
          professionalName: profName,
          receiptCode: code,
          periodPreset: preset,
          periodFrom: dates.from,
          periodTo: dates.to,
          appointmentsCount: countForThisPayment,
          totalBilled,
          commissionRate: commServicesRate,
          commissionAmount: rawBarberCutCommission,
          deductionsAmount: totalDeductions,
          advancesValesAmount: valesAmount,
          tipsAmount,
          netAmount: amountToPay,
          remunerationType: selectedProfessional.remuneration_type || 'commission',
          paymentMethod,
          paymentReference: paymentRef.trim() || null,
          notes: paymentRef.trim()
            ? `Ref: ${paymentRef.trim()}${totalAlreadyPaid > 0 ? ` · Pagos previos: ${formatCurrency(totalAlreadyPaid, { currency })}` : ''}`
            : totalAlreadyPaid > 0
            ? `Saldo liquidado (Pagos previos: ${formatCurrency(totalAlreadyPaid, { currency })})`
            : null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.success) {
        const now = new Date()
        const formattedDate = `${now.toLocaleDateString('es-PY')} ${now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`
        const finalCode = data.settlement?.receipt_code || code

        setSettledState({
          receiptCode: finalCode,
          settledAt: formattedDate,
          method: methodLabel + (paymentRef.trim() ? ` (Ref: ${paymentRef.trim()})` : ''),
          amount: amountToPay,
        })

        // Recibo optimista local: actualiza pendingBalance de inmediato sin esperar la re-fetch.
        // Cuando loadBalanceSettlements() termine y el recibo aparezca en balanceSettlements,
        // el useMemo de periodSettlements detecta el duplicado y omite el optimista.
        const profId = selectedProfessional.id
        setOptimisticSettlement({
          id: `optimistic-${finalCode}`,
          professional_id: profId,
          professional_name: selectedProfessional.name || 'STAFF',
          receipt_code: finalCode,
          period_preset: preset,
          period_from: dates.from,
          period_to: dates.to,
          appointments_count: countForThisPayment,
          total_billed: totalBilled,
          commission_rate: commServicesRate,
          commission_amount: rawBarberCutCommission,
          deductions_amount: totalDeductions,
          advances_vales_amount: valesAmount,
          tips_amount: tipsAmount,
          net_amount: amountToPay,
          remuneration_type: selectedProfessional.remuneration_type || 'commission',
          payment_method: paymentMethod,
          payment_reference: paymentRef.trim() || null,
          cash_movement_id: null,
          settled_at: now.toISOString(),
          status: 'paid',
          ...data.settlement,
        })

        setReviewingPayment(false)
        // Limpiar inputs temporales ya procesados en este comprobante
        setValesAmount(0)
        setTipsAmount(0)
        setPaymentRef('')

        toast.success(`Liquidación registrada: ${finalCode}`, {
          description: `Se guardó el pago de ${formatCurrency(amountToPay, { currency })} a ${profName} en la base de datos.${data.cashMovementCreated ? ' (Asentado en Caja POS)' : ''}`,
        })

        loadHistory({ reset: true })
        loadBalanceSettlements()
      } else if (data?.code === 'MIGRATION_REQUIRED') {
        setMigrationPending(true)
        toast.error('Falta aplicar la migración en Supabase', {
          description: 'La tabla agenda_professional_settlements aún no existe en la base de datos.',
        })
      } else {
        setOperationError(data?.error || 'No se pudo guardar la liquidación')
        if (typeof data?.mfaPath === 'string' && data.mfaPath.startsWith('/auth/mfa?')) setMfaPath(data.mfaPath)
        toast.error(data?.error || 'No se pudo guardar la liquidación')
        // Si el saldo cambió en el servidor, refrescamos automáticamente para que el operador
        // revise el nuevo importe en vez de quedar con un error sin salida.
        if (data?.code === 'SETTLEMENT_CHANGED') {
          attempt.current = null
          setReviewingPayment(false)
          setRetryToken(value => value + 1)
        }
      }
    } catch {
      setOperationError('No se pudo confirmar el resultado del pago. Reintentá sin cambiar los datos; el intento no se duplicará.')
      toast.error('No se pudo confirmar el resultado del pago')
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }
  }

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(generateWhatsAppMessage())
    const phone = selectedProfessional?.phone ? selectedProfessional.phone.replace(/\D/g, '') : ''
    const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateWhatsAppMessage())
      toast.success('Resumen copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el texto')
    }
  }

  const money = (value: number) => formatCurrency(value, { currency })
  const busy = isSubmitting || cancellingId !== null
  const dataReady = !loading && !loadingBalance && !balanceError && !appointmentsError && !migrationPending
  const overlappingPeriod = periodSettlements.some(receipt => receipt.period_from !== dates.from || receipt.period_to !== dates.to)
  const adjustmentsValid = Number.isFinite(tipsAmount) && Number.isFinite(valesAmount) && tipsAmount >= 0 && valesAmount >= 0 && valesAmount <= Math.max(0, barberNetServices - totalAlreadyPaid + tipsAmount)
  // El rango personalizado debe caber en 31 días (mismo límite que valida el servidor).
  const customPeriodValid = preset !== 'custom' || (dates.days >= 1 && dates.days <= 31)
  // Transferencia y QR requieren un comprobante de referencia (el servidor lo exige).
  const referenceValid = paymentMethod === 'cash' || paymentRef.trim().length > 0
  const canPay = dataReady && Boolean(selectedProfessional) && pendingBalance > 0 && adjustmentsValid && !overlappingPeriod && customPeriodValid && referenceValid && !busy

  const handlePrintReceipt = (data: {
    receiptCode: string
    professionalName: string
    periodFrom: string
    periodTo: string
    amount: number
    method: string
    settledAt: string
  }) => {
    const win = window.open('', '_blank', 'width=640,height=760')
    if (!win) {
      toast.error('Habilitá las ventanas emergentes para imprimir el comprobante')
      return
    }
    const rows = [
      ['Profesional', data.professionalName],
      ['Período', `${data.periodFrom} al ${data.periodTo}`],
      ['Medio de pago', data.method],
      ['Fecha', data.settledAt],
    ]
      .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join('')
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escapeHtml(data.receiptCode)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;color:#111}h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:13px}th{color:#6b7280;font-weight:500}.amount{font-size:28px;font-weight:700;margin:20px 0 0}.code{font-family:monospace;font-size:12px;color:#6b7280}</style></head><body><h1>Comprobante de liquidación</h1><p class="code">${escapeHtml(data.receiptCode)}</p><table>${rows}</table><p class="amount">${escapeHtml(money(data.amount))}</p><p class="code">Generado el ${escapeHtml(new Date().toLocaleString('es-PY'))}</p></body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
      <DialogContent
        className="flex max-h-[92dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onKeyDown={(event) => {
          // Enter confirma el pago cuando ya se está revisando (y Shift+Enter inserta salto en textos largos).
          if (event.key !== 'Enter' || event.shiftKey) return
          const target = event.target as HTMLElement | null
          if (target?.tagName === 'TEXTAREA') return
          if (activeTab !== 'liquidate' || !reviewingPayment || !canPay || busy) return
          event.preventDefault()
          void handleConfirmSettlement()
        }}
      >
        <DialogHeader className="shrink-0 border-b bg-muted/40 px-5 py-4 pr-12 text-left">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="space-y-0.5">
              <DialogTitle>Liquidación de comisiones</DialogTitle>
              <DialogDescription>Revisá los servicios atendidos y registrá el pago al profesional.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex shrink-0 items-center gap-1 border-b bg-muted/20 px-4 py-2" aria-label="Secciones de liquidación">
          <Button variant={activeTab === 'liquidate' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5" disabled={busy || reviewingPayment} aria-pressed={activeTab === 'liquidate'} onClick={() => setActiveTab('liquidate')}><Calculator className="h-4 w-4" aria-hidden="true"/>Liquidar</Button>
          <Button variant={activeTab === 'history' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5" disabled={busy || reviewingPayment} aria-pressed={activeTab === 'history'} onClick={() => setActiveTab('history')}><History className="h-4 w-4" aria-hidden="true"/>Historial</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {operationError && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"><p>{operationError}</p>{mfaPath && <a className="font-medium underline" href={mfaPath}>Verificar sesión en dos pasos</a>}</div>}
          {(balanceError || appointmentsError || migrationPending) && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"><p>{migrationPending ? 'Las liquidaciones requieren una actualización. Contactá al administrador de la plataforma.' : 'No se pudo consultar la información necesaria para liquidar.'}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => setRetryToken(value => value + 1)}>Reintentar consulta</Button></div>}
          {activeTab === 'history' ? (
            <section aria-label="Pagos registrados" className="space-y-3">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Pagos registrados</h2><Button size="sm" variant="ghost" disabled={busy || loadingHistory} onClick={() => loadHistory({ reset: true })}>Actualizar</Button></div>
              <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1"><Label htmlFor="history-professional">Profesional</Label><Select value={historyProfId} onValueChange={setHistoryProfId}><SelectTrigger id="history-professional" aria-label="Filtrar por profesional" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{professionals.map(professional => <SelectItem key={professional.id} value={professional.id}>{professional.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="history-status">Estado</Label><Select value={historyStatus} onValueChange={value => setHistoryStatus(value as 'all' | 'paid' | 'cancelled')}><SelectTrigger id="history-status" aria-label="Filtrar por estado" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="paid">Pagados</SelectItem><SelectItem value="cancelled">Anulados</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="history-from">Desde</Label><Input id="history-from" type="date" value={historyFrom} max={historyTo || undefined} onChange={event => setHistoryFrom(event.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="history-to">Hasta</Label><Input id="history-to" type="date" value={historyTo} min={historyFrom || undefined} onChange={event => setHistoryTo(event.target.value)} /></div>
              </div>
              {(historyProfId !== 'all' || historyStatus !== 'all' || historyFrom || historyTo) && <Button size="sm" variant="ghost" className="self-start" disabled={busy} onClick={() => { setHistoryProfId('all'); setHistoryStatus('all'); setHistoryFrom(''); setHistoryTo('') }}>Limpiar filtros</Button>}
              {loadingHistory ? <p role="status" className="py-6 text-sm text-muted-foreground">Cargando historial…</p> : historyError ? <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-4 text-sm"><p>No se pudo cargar el historial.</p><Button variant="outline" size="sm" disabled={busy} onClick={() => loadHistory({ reset: true })}>Reintentar</Button></div> : settlementsHistory.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no hay pagos registrados.</p> : settlementsHistory.map(receipt => (
                <article key={receipt.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-medium">{receipt.professional_name}</h3><p className="break-all text-xs text-muted-foreground">{receipt.receipt_code}</p></div><Badge variant="secondary">{receipt.status === 'cancelled' ? 'Anulado' : 'Pagado'}</Badge></div>
                  <p className="text-sm font-semibold tabular-nums">{money(Number(receipt.net_amount))}</p>
                  <p className="text-xs text-muted-foreground">{receipt.period_from} al {receipt.period_to} · {receipt.appointments_count} servicios atendidos</p>
                  <p className="text-xs text-muted-foreground">{receipt.payment_method === 'cash' ? 'Efectivo' : receipt.payment_method === 'transfer' ? 'Transferencia' : 'QR'}{receipt.payment_reference ? ` · Ref. ${receipt.payment_reference}` : ''}</p>
                  {receipt.total_billed != null && <details className="rounded-lg border px-3 py-2 text-xs"><summary className="cursor-pointer font-medium">Ver desglose</summary><dl className="mt-2 space-y-1.5"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Total facturado</dt><dd className="tabular-nums">{money(Number(receipt.total_billed ?? 0))}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Comisión{receipt.commission_rate != null ? ` (${receipt.commission_rate}%)` : ''}</dt><dd className="tabular-nums">{money(Number(receipt.commission_amount ?? 0))}</dd></div>{Number(receipt.deductions_amount ?? 0) > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Deducciones</dt><dd className="tabular-nums text-destructive">− {money(Number(receipt.deductions_amount))}</dd></div>}{Number(receipt.advances_vales_amount ?? 0) > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Adelantos / vales</dt><dd className="tabular-nums text-destructive">− {money(Number(receipt.advances_vales_amount))}</dd></div>}{Number(receipt.tips_amount ?? 0) > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Propinas</dt><dd className="tabular-nums">+ {money(Number(receipt.tips_amount))}</dd></div>}<div className="flex justify-between gap-4 border-t pt-1.5 font-medium"><dt>Neto pagado</dt><dd className="tabular-nums">{money(Number(receipt.net_amount))}</dd></div></dl></details>}
                  {receipt.cancellation_reason && <p className="text-xs text-muted-foreground">Motivo de anulación: {receipt.cancellation_reason}</p>}
                  {receipt.status !== 'cancelled' && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => { void navigator.clipboard.writeText(`Recibo ${receipt.receipt_code}\nProfesional: ${receipt.professional_name}\nPeríodo: ${receipt.period_from} al ${receipt.period_to}\nPagado: ${money(Number(receipt.net_amount))}`).then(() => toast.success('Comprobante copiado')).catch(() => toast.error('No se pudo copiar')) }}>Copiar comprobante</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => handlePrintReceipt({ receiptCode: receipt.receipt_code, professionalName: receipt.professional_name, periodFrom: receipt.period_from, periodTo: receipt.period_to, amount: Number(receipt.net_amount), method: receipt.payment_method === 'cash' ? 'Efectivo' : receipt.payment_method === 'transfer' ? 'Transferencia' : 'QR', settledAt: receipt.settled_at })}><Printer className="h-4 w-4"/>Imprimir</Button><Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { setCancelTarget(receipt); setCancellationReason('') }}>Anular</Button></div>}
                </article>
              ))}
              {historyHasMore && !historyError && <Button size="sm" variant="outline" className="w-full" disabled={busy || loadingMoreHistory} onClick={() => loadHistory({ reset: false })}>{loadingMoreHistory ? <><Loader2 className="h-4 w-4 animate-spin"/>Cargando…</> : 'Cargar más pagos'}</Button>}
              {cancelTarget && <section aria-label="Confirmar anulación" className="space-y-3 rounded-lg border border-destructive/40 p-4"><h3 className="font-semibold">Anular pago de {money(Number(cancelTarget.net_amount))}</h3><p className="text-sm text-muted-foreground">{cancelTarget.professional_name} · {cancelTarget.receipt_code}. {cancelTarget.cash_movement_id ? 'Se registrará un ingreso de devolución en la caja original; debe seguir abierta.' : 'Si pagaste por transferencia o QR, esta acción no devuelve el dinero. Confirmá primero su devolución.'}</p><Label htmlFor="settlement-cancellation-reason">Motivo de anulación</Label><Input id="settlement-cancellation-reason" value={cancellationReason} maxLength={300} disabled={busy} onChange={event => setCancellationReason(event.target.value)} placeholder="Ej.: pago registrado por error"/><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy || cancellationReason.trim().length < 5} onClick={() => void handleCancelSettlement(cancelTarget.id, cancelTarget.receipt_code)}>{cancellingId ? 'Anulando…' : 'Confirmar anulación'}</Button><Button variant="outline" disabled={busy} onClick={() => setCancelTarget(null)}>Conservar pago</Button></div></section>}
            </section>
          ) : (
            <>
              <fieldset disabled={busy || reviewingPayment} className="space-y-5">
                <div className="space-y-2"><Label htmlFor="settlement-professional">Profesional</Label><Select value={selectedProfId} onValueChange={setSelectedProfId}><SelectTrigger id="settlement-professional" aria-label="Profesional" className="h-10 w-full"><SelectValue placeholder="Elegí un profesional">{selectedProfessional ? selectedProfessional.name : undefined}</SelectValue></SelectTrigger><SelectContent>{professionals.map(professional => { const pending = professionalSummaries.find(item => item.id === professional.id)?.pending ?? 0; return <SelectItem key={professional.id} value={professional.id}>{professional.name}{professional.is_active ? '' : ' (inactivo)'}{pending > 0 ? ` · ${money(pending)} pendiente` : ''}</SelectItem> })}</SelectContent></Select>{totalPendingAll > 0 && <p className="text-xs text-muted-foreground" aria-live="polite">Pendiente del período (todos los profesionales): <span className="font-medium tabular-nums">{money(totalPendingAll)}</span></p>}</div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Período de liquidación</p>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1 sm:grid-cols-3">
                    {([{ id: 'today', label: 'Hoy' }, { id: 'this_week', label: 'Esta semana' }, { id: 'last_week', label: 'Semana anterior' }, { id: 'this_month', label: 'Este mes' }, { id: 'custom', label: 'Personalizado' }] as const).map(period => (
                      <Button key={period.id} variant={preset === period.id ? 'secondary' : 'ghost'} size="sm" className={preset === period.id ? 'h-8 shadow-sm' : 'h-8'} aria-pressed={preset === period.id} onClick={() => handlePresetChange(period.id)}>{period.label}</Button>
                    ))}
                  </div>
                  {preset === 'custom' && (
                    <div className="space-y-1.5">
                      <DatePickerWithRange
                        date={{ from: isoToDate(dates.from), to: isoToDate(dates.to) }}
                        onDateChange={range => {
                          if (range?.from) setCustomFrom(dateToIso(range.from))
                          if (range?.to) setCustomTo(dateToIso(range.to))
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Elegí el rango exacto que coincide con el recibo original.</p>
                      {!customPeriodValid && <p role="alert" className="text-xs text-destructive">El rango no puede superar 31 días.</p>}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{dates.from} al {dates.to} · {timeZone}</p>
                </div>
                {loading || loadingHistory ? <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Consultando servicios y pagos…</p> : dataReady && (
                  <>
                    {overlappingPeriod && <div role="alert" className="space-y-2 rounded-lg border border-amber-400/40 p-3 text-sm"><p>Hay pagos con otro período que se superpone. Elegí el mismo período del recibo original antes de continuar.</p>{periodSettlements[0] && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { const receipt = periodSettlements[0]; setCustomFrom(receipt.period_from); setCustomTo(receipt.period_to); handlePresetChange('custom') }}><CalendarRange className="h-4 w-4" aria-hidden="true" />Usar período del recibo ({periodSettlements[0].period_from} al {periodSettlements[0].period_to})</Button>}</div>}
                    <section aria-label="Desglose de liquidación" className="overflow-hidden rounded-xl border">
                      <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">Desglose del saldo</h2>
                      <dl className="space-y-2.5 p-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Servicios atendidos</dt><dd className="font-medium tabular-nums">{totalCompletedCount}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Total de servicios</dt><dd className="tabular-nums">{money(totalBilled)}</dd></div><div className="flex justify-between gap-4"><dt>{isChairRental ? 'Ingresos del profesional' : `Comisión (${commServicesRate}%)`}</dt><dd className="tabular-nums">{money(rawBarberCutCommission)}</dd></div>{totalDeductions > 0 && <div className="flex justify-between gap-4"><dt>{isChairRental ? 'Alquiler de sillón' : 'Deducción por servicios'}</dt><dd className="tabular-nums text-destructive">− {money(totalDeductions)}</dd></div>}<div className="mt-1 flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-2"><dt className="font-medium">Comisión neta del período</dt><dd className="text-base font-semibold tabular-nums">{money(barberNetServices)}</dd></div>{totalAlreadyPaid > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Comisión ya liquidada</dt><dd className="tabular-nums text-destructive">− {money(totalAlreadyPaid)}</dd></div>}</dl>
                      {selectedProfessional?.remuneration_type === 'fixed' && <p className="mt-3 text-xs text-muted-foreground">El sueldo fijo se paga desde la administración de remuneraciones. Este cálculo incluye solo comisiones por servicios.</p>}
                    </section>
                    {totalAlreadyPaid > 0 && unsettledAppointmentsCount > 0 && <p className="text-xs text-muted-foreground">Nuevos servicios atendidos: {unsettledAppointmentsCount}</p>}
                    {totalAlreadyPaid > 0 && <details className="rounded-lg border px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">Pagos previos del período ({periodSettlements.filter(s => !s.id.startsWith('optimistic-')).length})</summary><ul className="mt-2 space-y-2">{periodSettlements.filter(s => !s.id.startsWith('optimistic-')).map(receipt => <li key={receipt.id} className="flex flex-wrap justify-between gap-2 text-xs"><span className="break-all">{receipt.receipt_code}</span><span>{money(Number(receipt.net_amount))} pagados</span></li>)}</ul></details>}
                    <details className="rounded-lg border px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">Ver servicios atendidos ({totalCompletedCount})</summary><ul className="mt-3 divide-y">{relevantAppointments.map(appointment => <li key={appointment.id} className="flex items-start justify-between gap-3 py-2"><div className="min-w-0"><p className="break-words font-medium">{appointment.customer_name}</p><p className="break-words text-xs text-muted-foreground">{appointment.service_name} · {utcToZoned(appointment.starts_at,timeZone).date}</p></div><span className="shrink-0 text-xs tabular-nums">{money(Number(appointment.price))}</span></li>)}</ul>{totalCompletedCount === 0 && <p className="py-3 text-xs text-muted-foreground">No hay servicios atendidos en este período.</p>}</details>
                    {upcomingAppointments.length > 0 && <p className="text-xs text-muted-foreground">{upcomingAppointments.length} turnos pendientes de atención no se incluyen en el pago.</p>}
                    <details className="rounded-lg border px-3 py-2 text-sm" open={tipsAmount > 0 || valesAmount > 0}><summary className="cursor-pointer font-medium">Ajustes de este pago (opcional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="settlement-tips">Propinas a entregar</Label><Input id="settlement-tips" type="number" min={0} max={1e10} step={currency === 'PYG' ? '1' : '0.01'} value={tipsAmount} onChange={event => setTipsAmount(Number(event.target.value))}/></div><div className="space-y-1"><Label htmlFor="settlement-advances">Adelantos a descontar</Label><Input id="settlement-advances" type="number" min={0} max={1e10} step={currency === 'PYG' ? '1' : '0.01'} value={valesAmount} onChange={event => setValesAmount(Number(event.target.value))}/></div></div><p className="mt-2 text-xs text-muted-foreground">Ingresá solo ajustes nuevos. Los adelantos de recibos anteriores ya están considerados.</p>{!adjustmentsValid && <p role="alert" className="mt-2 text-xs text-destructive">Revisá los ajustes: no pueden ser negativos ni superar el saldo disponible.</p>}</details>
                    {isFullySettled ? <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="h-5 w-5"/></span><div><p className="font-semibold">Período al día</p><p className="mt-1 text-sm text-muted-foreground">No queda saldo pendiente de estos servicios.</p></div></div> : <section aria-label="Forma de pago" className="space-y-3">
                      <div className="space-y-2"><Label htmlFor="settlement-payment-method">Medio de pago</Label><Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as 'cash'|'transfer'|'qr')}><SelectTrigger id="settlement-payment-method" aria-label="Medio de pago" className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Efectivo · Caja POS</SelectItem><SelectItem value="transfer">Transferencia</SelectItem><SelectItem value="qr">QR</SelectItem></SelectContent></Select></div>
                      <p className="text-xs text-muted-foreground">{paymentMethod === 'cash' ? (cashSession ? (cashSession.count === 1 ? `Al confirmar se registrará un egreso en la caja abierta${cashSession.registerName ? ` "${cashSession.registerName}"` : ''}.` : cashSession.count === 0 ? 'No hay una caja abierta. Abrí una caja en el POS antes de pagar en efectivo.' : `Hay ${cashSession.count} cajas abiertas. El pago en efectivo requiere una única caja abierta en el negocio.`) : 'Al confirmar se registrará un egreso. Debe haber una única caja abierta en el negocio.') : 'Registrá este pago después de completar la transferencia o el pago por QR. El sistema no mueve dinero desde tu cuenta.'}</p>
                      {paymentMethod === 'cash' && cashSession && cashSession.count !== 1 && <p role="alert" className="text-xs text-destructive">{cashSession.count === 0 ? 'Abrí una caja para poder pagar en efectivo.' : 'Cerrá las cajas sobrantes: debe quedar una sola abierta.'}</p>}
                      <div className="space-y-2"><Label htmlFor="settlement-payment-reference">Referencia o comprobante{paymentMethod !== 'cash' && <span className="text-destructive"> *</span>}</Label><Input id="settlement-payment-reference" value={paymentRef} maxLength={200} aria-required={paymentMethod !== 'cash'} onChange={event => setPaymentRef(event.target.value)} placeholder={paymentMethod === 'cash' ? 'Opcional' : 'Ej.: número de transferencia o ID de operación QR'}/>{paymentMethod !== 'cash' && !referenceValid && <p className="text-xs text-muted-foreground">Ingresá la referencia de la {paymentMethod === 'transfer' ? 'transferencia' : 'operación por QR'} para continuar.</p>}</div>
                    </section>}
                  </>
                )}
              </fieldset>
              {settledState && <section role="status" className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"><div className="flex items-start gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="h-5 w-5"/></span><div className="space-y-0.5"><h2 className="font-semibold">Pago registrado</h2><p className="text-2xl font-semibold tabular-nums">{money(settledState.amount)}</p><p className="break-all text-xs text-muted-foreground">{settledState.receiptCode} · {settledState.method}</p></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void handleCopyClipboard()}><Copy className="h-4 w-4"/>Copiar comprobante</Button><Button size="sm" variant="ghost" onClick={handleSendWhatsApp}><MessageCircle className="h-4 w-4"/>WhatsApp</Button><Button size="sm" variant="ghost" onClick={() => handlePrintReceipt({ receiptCode: settledState.receiptCode, professionalName: selectedProfessional?.name ?? 'STAFF', periodFrom: dates.from, periodTo: dates.to, amount: settledState.amount, method: settledState.method, settledAt: settledState.settledAt })}><Printer className="h-4 w-4"/>Imprimir</Button><Button size="sm" variant="ghost" onClick={() => { setSettledState(null); setReviewingPayment(false) }}><RotateCcw className="h-4 w-4"/>Nueva liquidación</Button></div></section>}
              {reviewingPayment && <section aria-label="Confirmación del pago" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4"><h2 className="font-semibold">Confirmá el pago</h2><p className="text-sm text-muted-foreground">{selectedProfessional?.name} · {dates.from} al {dates.to}</p><p className="text-3xl font-semibold tabular-nums">{money(pendingBalance)}</p><p className="text-sm text-muted-foreground">{paymentMethod === 'cash' ? 'Este importe saldrá de la caja abierta y quedará registrado como pagado.' : 'Confirmás que ya entregaste este importe. Solo se registrará el comprobante.'}</p></section>}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4">
          {activeTab === 'liquidate' && !settledState && dataReady ? <div aria-label="Importe a pagar" aria-live="polite"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">A pagar ahora</p><p className="text-2xl font-bold tabular-nums text-primary">{money(pendingBalance)}</p></div> : <span/>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => reviewingPayment ? setReviewingPayment(false) : onOpenChange(false)}>{reviewingPayment ? 'Volver a revisar' : 'Cerrar'}</Button>{activeTab === 'liquidate' && !settledState && <Button className="h-10 px-5" disabled={!canPay} onClick={() => reviewingPayment ? void handleConfirmSettlement() : setReviewingPayment(true)}>{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin"/>Registrando…</> : reviewingPayment ? `Confirmar y registrar pago (${money(pendingBalance)})` : 'Revisar pago'}</Button>}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
