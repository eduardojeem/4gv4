"use client"

/**
 * Ficha completa del cliente.
 *
 * Orden de lectura: quién es y cuánto vale (encabezado y métricas), qué debe
 * (pendiente de cobro), qué hizo (actividad) y, al costado, cómo contactarlo,
 * su cuenta y su perfil. El detalle de cada tema vive en su pestaña.
 */

import React, { useState } from 'react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CustomerCreditInfo } from './CustomerCreditInfo'
import { CustomerGlobalPaymentModal } from './CustomerGlobalPaymentModal'
import { CustomerHistoryList } from './CustomerHistoryList'
import { SaleDetailsModal } from '@/app/dashboard/pos/components/SaleDetailsModal'
import { RepairDetailDialog } from '@/components/dashboard/repairs/RepairDetailDialog'
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Coins,
  Copy,
  CreditCard,
  Edit,
  FileText,
  Hash,
  History,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageSquare,
  PhoneCall,
  Shield,
  ShieldCheck,
  Tag,
  User,
  Wallet,
} from 'lucide-react'
import { Customer, keepComputedSpend } from '@/hooks/use-customer-state'
import { useCustomerSalesMetricsMap } from '@/hooks/use-customer-metrics'
import { useCustomerData } from '@/hooks/useCustomerData'
import { useCustomerRepairs } from '@/hooks/useCustomerRepairs'
import { useCustomerCredits } from '@/hooks/use-customer-credits'
import { useCustomerHistory } from '@/hooks/use-customer-history'
import { useAuthorizedPersons, prefetchAuthorizedPersons } from '@/hooks/useAuthorizedPersons'
import { createClient } from '@/lib/supabase/client'
import { CustomerDetailHeader } from './CustomerDetailHeader'
import { CustomerDetailMetrics } from './CustomerDetailMetrics'
import { CustomerLinkAccount } from './CustomerLinkAccount'
import { WholesaleToggle } from './WholesaleToggle'
import { formatCurrency } from '@/lib/currency'

// Trae su propio fetch: se carga solo cuando el usuario abre la pestaña.
const CustomerPointsHistory = dynamic(
  () => import('@/components/dashboard/loyalty').then((m) => ({ default: m.CustomerPointsHistory })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl border bg-muted/30" /> }
)

interface CustomerDetailProps {
  customer: Customer
  onBack: () => void
  onEdit: (customer: Customer) => void
  onViewHistory: (customer: Customer) => void
  compact?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas de la ficha
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('gap-0 overflow-hidden py-0 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}

type ContactAction = { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }

function ContactRow({
  label,
  icon: Icon,
  value,
  note,
  mono,
  actions = [],
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value?: string | null
  note?: string
  mono?: boolean
  actions?: ContactAction[]
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className={cn('break-words text-sm text-foreground', mono && 'font-mono', !value && 'italic text-muted-foreground')}>
          {value || 'No registrado'}
        </dd>
        {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
      </div>
      {value && actions.length > 0 && (
        <div className="flex shrink-0 items-center gap-0.5">
          {actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={action.onClick}
              aria-label={action.label}
              title={action.label}
            >
              <action.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value * 10)}%` }} />
      </span>
      <span className="tabular-nums">{value}/10</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Saldo a favor
// ─────────────────────────────────────────────────────────────────────────────
interface StoreCreditMovement {
  id: string
  amount: number
  reason: string
  source_type: 'after_sales' | 'sale' | 'repair' | 'manual'
  source_id: string | null
  created_at: string
}

function CustomerStoreCreditPanel({ customerId }: { customerId?: string | null }) {
  const [balance, setBalance] = React.useState(0)
  const [movements, setMovements] = React.useState<StoreCreditMovement[]>([])
  const [loading, setLoading] = React.useState(Boolean(customerId))
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    if (!customerId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await fetch(`/api/customers/${customerId}/store-credit?page=1&pageSize=20`)
        if (!resp.ok) throw new Error('Error al cargar saldo a favor')
        const payload = await resp.json().catch(() => null)
        if (!payload?.success) throw new Error(payload?.error || 'Error al cargar saldo a favor')
        if (cancelled) return
        setBalance(Number(payload.data?.balance || 0))
        setMovements(payload.data?.movements ?? [])
      } catch {
        if (!cancelled) setError('No se pudo cargar el saldo a favor.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [customerId])

  if (!customerId) return null

  const sourceLabel = (s: StoreCreditMovement['source_type']) =>
    ({ after_sales: 'Posventa', sale: 'Venta', repair: 'Reparación', manual: 'Ajuste manual' }[s] || 'Movimiento')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="h-4 w-4" />
          Saldo a favor
        </span>
        {loading ? (
          <span className="h-4 w-20 animate-pulse rounded bg-muted" aria-label="Cargando saldo" />
        ) : error ? (
          <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </span>
        ) : (
          <span className={cn('font-mono text-sm font-bold tabular-nums', balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
            {formatCurrency(balance)}
          </span>
        )}
      </div>

      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          {balance > 0
            ? 'Se puede aplicar en la próxima compra o reparación.'
            : 'Se genera con devoluciones, créditos o ajustes manuales.'}
        </p>
      )}

      {!loading && !error && movements.length > 0 && (
        <>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            {expanded ? 'Ocultar movimientos' : `Ver ${movements.length} movimiento${movements.length !== 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {movements.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{m.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {sourceLabel(m.source_type)} · {new Date(m.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={cn('shrink-0 font-mono text-sm font-bold tabular-nums', m.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {m.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(Number(m.amount)))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

const TAB_TRIGGER =
  'h-11 shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'

export function CustomerDetail({ customer, onBack, onEdit, onViewHistory, compact }: CustomerDetailProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null)
  const { data: freshData, error: customerError, mutate: refreshCustomer } = useCustomerData(customer.id)

  // Use fresh data if available, otherwise fallback to prop
  // La recarga trae la fila cruda: se conservan los totales ya calculados.
  const currentCustomer = freshData ? keepComputedSpend({ ...customer, ...freshData } as Customer, customer) : customer

  const { repairs, fetchRepairs } = useCustomerRepairs()
  const { creditSummary, refresh: refreshCredits } = useCustomerCredits(currentCustomer.id, currentCustomer)
  const { summary: historySummary, refresh: refreshHistory } = useCustomerHistory(currentCustomer.id)
  // Los totales salen de la misma regla que la lista y la analítica. Antes el
  // detalle sumaba solo las últimas 100 ventas, ignoraba la tienda pública y
  // contaba las reparaciones con otro criterio: el mismo cliente tenía dos
  // «gastados» distintos.
  const spendMap = useCustomerSalesMetricsMap([currentCustomer.id])
  const spend = spendMap[currentCustomer.id]

  // Las filas completas de las reparaciones, para abrir su ficha desde el historial.
  React.useEffect(() => {
    fetchRepairs(currentCustomer.id)
  }, [currentCustomer.id, fetchRepairs])

  const stats = React.useMemo(() => {
    // Mientras llega el cálculo se usa lo que ya trae el cliente desde la lista,
    // que sale de la misma regla. Nunca de las columnas viejas de la ficha.
    const fromList = (currentCustomer as Customer & { spend_synced?: boolean }).spend_synced ? currentCustomer : null
    const salesSum = spend?.purchaseTotal ?? 0
    const repairsSum = spend?.repairTotal ?? 0
    const totalSpent = spend?.total ?? fromList?.lifetime_value ?? 0
    const salesCount = spend?.purchaseCount ?? fromList?.total_purchases ?? historySummary?.salesCount ?? 0
    const repairsCount = spend?.repairCount ?? (fromList as { total_repairs?: number } | null)?.total_repairs ?? historySummary?.repairsCount ?? 0
    const totalPurchases = salesCount + repairsCount
    const averageTicket = totalPurchases > 0 ? Math.round(totalSpent / totalPurchases) : 0

    // La última visita es la última operación, no la última edición de la ficha.
    const lastVisit = spend?.lastDate ?? fromList?.last_visit ?? null

    const creditLimit = creditSummary?.credit_limit ?? currentCustomer.credit_limit ?? 0
    const pendingDebt = creditSummary?.total_pending ?? (currentCustomer as any).credit_outstanding ?? (currentCustomer as any).pending_amount ?? 0
    const availableCredit = creditSummary?.available_credit ?? Math.max(0, creditLimit - pendingDebt)
    const storeBalance = creditSummary?.store_balance ?? 0

    return {
      totalSpent,
      salesTotal: salesSum,
      repairsTotal: repairsSum,
      totalPurchases,
      salesCount,
      repairsCount,
      lastVisit,
      averageTicket,
      pendingDebt,
      availableCredit,
      creditLimit,
      storeBalance,
    }
  }, [currentCustomer, creditSummary, spend, historySummary])

  // Si la recarga falla se seguian mostrando los datos que traia la lista, sin
  // ninguna senal: el credito y el saldo podian estar viejos y nadie lo sabia.
  const isStale = Boolean(customerError) && !freshData
  const [resolvedProfileId, setResolvedProfileId] = useState<string | null>((currentCustomer as Customer & { profile_id?: string }).profile_id ?? null)
  const resolvedEmail = (freshData?.email ?? (customer as Customer & { email?: string }).email) as string | undefined

  const selectedRepair = React.useMemo(
    () => (selectedRepairId ? (repairs.find((r) => r.id === selectedRepairId) as unknown as Record<string, unknown> | undefined) ?? null : null),
    [repairs, selectedRepairId]
  )

  const normalizedRepair = React.useMemo(() => {
    if (!selectedRepair) return null
    return {
      ...selectedRepair,
      ticketNumber: selectedRepair.ticketNumber || selectedRepair.ticket_number,
      device: selectedRepair.device || `${selectedRepair.device_brand || ''} ${selectedRepair.device_model || ''}`.trim() || 'Dispositivo',
      deviceType: selectedRepair.deviceType || selectedRepair.device_type || 'smartphone',
      brand: selectedRepair.brand || selectedRepair.device_brand || '',
      model: selectedRepair.model || selectedRepair.device_model || '',
      serialNumber: selectedRepair.serialNumber || selectedRepair.serial_number || selectedRepair.imei || '',
      problem: selectedRepair.problem || selectedRepair.problem_description || 'Sin descripción',
      priority: selectedRepair.priority || 'medium',
      urgency: selectedRepair.urgency || 'normal',
      status: selectedRepair.status || 'recibido',
      createdAt: selectedRepair.createdAt || selectedRepair.created_at || new Date().toISOString(),
      finalCost: selectedRepair.finalCost ?? selectedRepair.final_cost ?? selectedRepair.estimatedCost ?? selectedRepair.estimated_cost ?? 0,
      customer: selectedRepair.customer || {
        id: currentCustomer.id,
        name: currentCustomer.name,
        customerCode: currentCustomer.customerCode || '',
        phone: currentCustomer.phone || '',
        email: currentCustomer.email || '',
      }
    }
  }, [selectedRepair, currentCustomer])

  React.useEffect(() => {
    const fetchProfileId = async () => {
      if (activeTab !== 'authorized') return
      if (resolvedProfileId) return
      if (!resolvedEmail) return
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', resolvedEmail)
          .limit(1)
          .maybeSingle()
        if (data?.id) setResolvedProfileId(data.id as string)
      } catch {}
    }
    fetchProfileId()
  }, [activeTab, resolvedProfileId, resolvedEmail])

  const { data: authorizedPersons, isLoading: authorizedLoading, error: authorizedError } = useAuthorizedPersons(
    resolvedProfileId,
    activeTab === 'authorized'
  )

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'No disponible'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const copyAction = (text: string): ContactAction => ({ label: 'Copiar', icon: Copy, onClick: () => void copyToClipboard(text) })

  const openPayment = () => setIsPaymentModalOpen(true)
  const creditUsage = stats.creditLimit > 0 ? Math.min(100, Math.round((stats.pendingDebt / stats.creditLimit) * 100)) : 0
  const address = currentCustomer.address || currentCustomer.city

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <CustomerDetailHeader
        customer={currentCustomer}
        onBack={onBack}
        onEdit={() => onEdit(currentCustomer)}
        onViewHistory={() => onViewHistory(currentCustomer)}
        onOpenPayment={openPayment}
        compact={compact}
        stats={stats}
      />

      {isStale && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <div className="text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Estos datos pueden estar desactualizados</p>
            <p className="text-xs">No pudimos traer la ficha más reciente del cliente.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshCustomer()}>
            Reintentar
          </Button>
        </div>
      )}

      <CustomerDetailMetrics customer={currentCustomer} stats={stats} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
        <div className="overflow-x-auto border-b">
          <TabsList className="h-11 w-max gap-6 rounded-none bg-transparent p-0">
            <TabsTrigger value="overview" className={TAB_TRIGGER}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="history" className={TAB_TRIGGER}>
              <History className="mr-2 h-4 w-4" />
              Historial
              {historySummary && historySummary.withBalance > 0 && (
                <span className="ml-2 rounded-full bg-rose-500/15 px-1.5 text-[11px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                  {historySummary.withBalance}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="credits" className={TAB_TRIGGER}>
              <CreditCard className="mr-2 h-4 w-4" />
              Créditos y pagos
            </TabsTrigger>
            <TabsTrigger value="points" className={TAB_TRIGGER}>
              <Coins className="mr-2 h-4 w-4" />
              Puntos
            </TabsTrigger>
            <TabsTrigger
              value="authorized"
              className={TAB_TRIGGER}
              onMouseEnter={() => {
                const pid = resolvedProfileId || (currentCustomer as Customer & { profile_id?: string }).profile_id
                if (pid) prefetchAuthorizedPersons(pid as string)
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Autorizados
            </TabsTrigger>
            <TabsTrigger value="notes" className={TAB_TRIGGER}>
              <FileText className="mr-2 h-4 w-4" />
              Notas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Resumen ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {historySummary && historySummary.withBalance > 0 && (
                <Section
                  title="Pendiente de cobro"
                  icon={Coins}
                  description={[
                    historySummary.owed > 0 ? `Debe ${formatCurrency(historySummary.owed)}` : null,
                    historySummary.dueOnPickup > 0 ? `${formatCurrency(historySummary.dueOnPickup)} se cobran al retirar` : null,
                  ].filter(Boolean).join(' · ') || undefined}
                  action={
                    <Button size="sm" onClick={openPayment}>
                      <Coins className="mr-1.5 h-4 w-4" />
                      Cobrar
                    </Button>
                  }
                >
                  <CustomerHistoryList
                    customerId={currentCustomer.id}
                    onlyWithBalance
                    limit={4}
                    onShowAll={() => setActiveTab('history')}
                    onViewSale={setSelectedSaleId}
                    onViewRepair={setSelectedRepairId}
                  />
                </Section>
              )}

              <Section title="Actividad reciente" icon={History} description="Últimas ventas y reparaciones, con su estado de pago.">
                <CustomerHistoryList
                  customerId={currentCustomer.id}
                  limit={6}
                  onShowAll={() => setActiveTab('history')}
                  onViewSale={setSelectedSaleId}
                  onViewRepair={setSelectedRepairId}
                  onCollect={openPayment}
                />
              </Section>
            </div>

            <aside className="space-y-6">
              <Section title="Contacto" icon={User}>
                <dl className="-my-2.5 divide-y">
                  <ContactRow
                    label="Teléfono"
                    icon={PhoneCall}
                    value={currentCustomer.phone}
                    mono
                    actions={currentCustomer.phone ? [
                      { label: 'Llamar', icon: PhoneCall, onClick: () => window.open(`tel:${encodeURIComponent(currentCustomer.phone)}`) },
                      { label: 'WhatsApp', icon: MessageSquare, onClick: () => window.open(`https://wa.me/${currentCustomer.phone?.replace(/[^\d]/g, '')}`) },
                      copyAction(currentCustomer.phone),
                    ] : []}
                  />

                  {/* Contacto alternativo: el telefono del cliente suele ser el
                      equipo que dejo en el taller, asi que ahi no se lo puede
                      ubicar justo cuando hay algo que avisarle. */}
                  {currentCustomer.alternate_phone && (
                    <ContactRow
                      label="Otro teléfono para avisarle"
                      icon={PhoneCall}
                      value={currentCustomer.alternate_phone}
                      mono
                      note={currentCustomer.alternate_phone_label
                        ? `de ${currentCustomer.alternate_phone_label}`
                        : 'sin aclarar de quién es'}
                      actions={[
                        { label: 'Llamar', icon: PhoneCall, onClick: () => window.open(`tel:${encodeURIComponent(currentCustomer.alternate_phone || '')}`) },
                        { label: 'WhatsApp', icon: MessageSquare, onClick: () => window.open(`https://wa.me/${(currentCustomer.alternate_phone || '').replace(/[^\d]/g, '')}`) },
                        copyAction(currentCustomer.alternate_phone || ''),
                      ]}
                    />
                  )}

                  <ContactRow
                    label="Email"
                    icon={Mail}
                    value={currentCustomer.email}
                    actions={currentCustomer.email ? [
                      { label: 'Escribir', icon: Mail, onClick: () => window.open(`mailto:${encodeURIComponent(currentCustomer.email)}`) },
                      copyAction(currentCustomer.email),
                    ] : []}
                  />

                  <ContactRow
                    label="Dirección"
                    icon={MapPin}
                    value={address}
                    actions={address ? [
                      { label: 'Ver en el mapa', icon: MapPin, onClick: () => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank') },
                      copyAction(address),
                    ] : []}
                  />

                  {currentCustomer.ruc && (
                    <ContactRow label="RUC / CI" icon={Hash} value={currentCustomer.ruc} mono actions={[copyAction(currentCustomer.ruc)]} />
                  )}

                  {currentCustomer.customerCode && (
                    <ContactRow label="Código de cliente" icon={Hash} value={currentCustomer.customerCode} mono actions={[copyAction(currentCustomer.customerCode)]} />
                  )}
                </dl>
              </Section>

              <Section
                title="Cuenta"
                icon={Wallet}
                action={
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setActiveTab('credits')}>
                    Ver detalle
                  </Button>
                }
              >
                <div className="space-y-4">
                  {stats.creditLimit > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs text-muted-foreground">Línea de crédito</span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(stats.pendingDebt)}
                          <span className="font-normal text-muted-foreground"> / {formatCurrency(stats.creditLimit)}</span>
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={creditUsage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Uso de la línea de crédito"
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            creditUsage > 80 ? 'bg-rose-500' : creditUsage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          )}
                          style={{ width: `${creditUsage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Disponible <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.availableCredit)}</span>
                        </span>
                        <span className="tabular-nums">{creditUsage}% usado</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CreditCard className="h-4 w-4" />
                        Línea de crédito
                      </span>
                      <span className="text-xs text-muted-foreground">Sin línea asignada</span>
                    </div>
                  )}

                  {stats.pendingDebt > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                      <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Deuda total</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300">{formatCurrency(stats.pendingDebt)}</span>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <CustomerStoreCreditPanel customerId={currentCustomer.id} />
                  </div>
                </div>
              </Section>

              <Section
                title="Perfil"
                icon={Tag}
                action={
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(currentCustomer)}>
                    <Edit className="mr-1 h-3 w-3" />
                    Editar
                  </Button>
                }
              >
                <dl className="-my-2 divide-y">
                  <ProfileRow label="Estado">
                    <Badge variant={currentCustomer.status === 'active' || !currentCustomer.status ? 'secondary' : 'outline'}>
                      {currentCustomer.status === 'inactive' ? 'Inactivo' : currentCustomer.status === 'suspended' ? 'Suspendido' : 'Activo'}
                    </Badge>
                  </ProfileRow>
                  <ProfileRow label="Tipo">
                    {currentCustomer.customer_type === 'premium' ? 'Premium'
                      : currentCustomer.customer_type === 'empresa' ? 'Empresa'
                      : currentCustomer.customer_type === 'wholesale' ? 'Mayorista' : 'Regular'}
                  </ProfileRow>
                  <ProfileRow label="Segmento">
                    {currentCustomer.segment === 'vip' ? 'VIP' : currentCustomer.segment === 'premium' ? 'Premium' : 'Regular'}
                  </ProfileRow>
                  <ProfileRow label="Cliente desde">{formatDate(currentCustomer.registration_date)}</ProfileRow>
                  <ProfileRow label="Última visita">{stats.lastVisit ? formatDate(stats.lastVisit) : 'Sin operaciones'}</ProfileRow>
                  {currentCustomer.credit_score ? (
                    <ProfileRow label="Puntaje de crédito"><ScoreBar value={currentCustomer.credit_score} /></ProfileRow>
                  ) : null}
                  {currentCustomer.satisfaction_score ? (
                    <ProfileRow label="Satisfacción"><ScoreBar value={currentCustomer.satisfaction_score} /></ProfileRow>
                  ) : null}
                </dl>

                <div className="mt-4 space-y-2 border-t pt-4">
                  <p className="text-xs text-muted-foreground">Etiquetas</p>
                  {currentCustomer.tags && currentCustomer.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {currentCustomer.tags.map((tag, i) => (
                        <Badge key={`${tag}-${i}`} variant="outline" className="font-normal">{tag}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">Sin etiquetas</p>
                  )}
                </div>

                <div className="mt-4 space-y-1 border-t pt-4">
                  <p className="text-xs text-muted-foreground">Nota</p>
                  <p className={cn('whitespace-pre-line text-sm', currentCustomer.notes ? 'text-foreground' : 'italic text-muted-foreground')}>
                    {currentCustomer.notes || 'Sin notas.'}
                  </p>
                </div>
              </Section>

              <div className="space-y-3">
                <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Acceso online</h3>
                <CustomerLinkAccount
                  customerId={currentCustomer.id}
                  customerName={currentCustomer.name}
                  customerEmail={resolvedEmail}
                  profileId={resolvedProfileId}
                  onLinked={() => window.location.reload()}
                />
                {(resolvedProfileId || currentCustomer.id) && (
                  <WholesaleToggle
                    profileId={resolvedProfileId || currentCustomer.id}
                    customerName={currentCustomer.name}
                  />
                )}
              </div>
            </aside>
          </div>
        </TabsContent>

        {/* ── Historial ───────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-0">
          <Section title="Historial de ventas y reparaciones" icon={History} description="Cada operación con lo que se cobró y lo que falta.">
            <CustomerHistoryList
              customerId={currentCustomer.id}
              showSummary
              onViewSale={setSelectedSaleId}
              onViewRepair={setSelectedRepairId}
              onCollect={openPayment}
            />
          </Section>
        </TabsContent>

        {/* ── Créditos y pagos ────────────────────────────────────────────── */}
        <TabsContent value="credits" className="mt-0 space-y-6">
          <CustomerCreditInfo
            customer={currentCustomer}
            compact={compact}
            showActions={true}
            onOpenPayment={openPayment}
            onEditCustomer={() => onEdit(currentCustomer)}
          />
        </TabsContent>

        {/* ── Puntos ──────────────────────────────────────────────────────── */}
        <TabsContent value="points" className="mt-0">
          <CustomerPointsHistory customerId={currentCustomer.id} />
        </TabsContent>

        {/* ── Autorizados ─────────────────────────────────────────────────── */}
        <TabsContent value="authorized" className="mt-0">
          <Section
            title="Personas autorizadas para retirar"
            icon={ShieldCheck}
            action={<Badge variant="secondary">{authorizedLoading ? '…' : (authorizedPersons?.length || 0)}</Badge>}
          >
            {authorizedError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No se pudieron cargar los autorizados. Reintentá en unos segundos.
              </div>
            )}
            {!authorizedError && !authorizedLoading && !resolvedProfileId && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Este cliente no tiene un perfil vinculado (falta email), por eso no se pueden mostrar autorizados.
              </div>
            )}
            {authorizedLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/50" />
                ))}
              </div>
            ) : authorizedPersons && authorizedPersons.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {authorizedPersons.map((person: { id: string; full_name: string; document_number: string; relationship?: string; phone?: string }) => (
                  <div key={person.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-foreground">{person.full_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">CI {person.document_number}</p>
                      {(person.relationship || person.phone) && (
                        <p className="text-xs text-muted-foreground">
                          {[person.relationship, person.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">Sin autorizados</p>
                <p className="text-xs text-muted-foreground">Este cliente aún no designó personas para retirar sus equipos.</p>
              </div>
            )}

            <p className="mt-6 flex gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong className="text-foreground">Al entregar a un tercero</strong> pedí el documento original y verificá que coincida con lo registrado acá.
              </span>
            </p>
          </Section>
        </TabsContent>

        {/* ── Notas ───────────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-0">
          <Section
            title="Notas"
            icon={FileText}
            action={
              <Button size="sm" variant="outline" onClick={() => onEdit(currentCustomer)}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                {currentCustomer.notes ? 'Editar nota' : 'Agregar nota'}
              </Button>
            }
          >
            <p className={cn('whitespace-pre-line text-sm', currentCustomer.notes ? 'text-foreground' : 'italic text-muted-foreground')}>
              {currentCustomer.notes || 'No hay notas registradas para este cliente.'}
            </p>
          </Section>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Button>
      </div>

      {/* Modal de Cobro / Abono Unificado */}
      <CustomerGlobalPaymentModal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        customer={currentCustomer}
        onSuccess={() => {
          setIsPaymentModalOpen(false)
          // Lo cobrado tiene que verse enseguida en el historial y en la cuenta.
          void refreshHistory()
          refreshCredits()
          void refreshCustomer()
          fetchRepairs(currentCustomer.id)
        }}
      />

      {/* Modal de Detalle de Venta */}
      <SaleDetailsModal
        isOpen={Boolean(selectedSaleId)}
        onClose={() => setSelectedSaleId(null)}
        saleId={selectedSaleId}
      />

      {/* Modal de Detalle de Reparación */}
      <RepairDetailDialog
        open={Boolean(normalizedRepair)}
        onClose={() => setSelectedRepairId(null)}
        repair={normalizedRepair as unknown as React.ComponentProps<typeof RepairDetailDialog>['repair']}
      />
    </div>
  )
}
