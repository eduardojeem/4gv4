'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Globe,
  Layers,
  LayoutGrid,
  List,
  Minus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUrlListState } from '@/hooks/useUrlListState'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
import { MonitoringRobotMascot, type RobotMood } from '../MonitoringRobotMascot'

import type { EditForm, SuperAdminSubscription, SortValue, TabValue } from './types'
import {
  csvCell,
  daysUntil,
  formatDate,
  formatMoney,
  getRecommendation,
  isAttention,
  periodLabel,
  periodProgress,
  toDateTimeLocalValue,
  PLAN_STYLES,
  STATUS_STYLES,
} from './utils'
import { SubscriptionStats } from './subscription-stats'
import { SubscriptionFilters } from './subscription-filters'
import { SubscriptionTable } from './subscription-table'
import { SubscriptionCard } from './subscription-card'
import { SubscriptionDetailDialog } from './subscription-detail-dialog'
import { SubscriptionSidebar } from './subscription-sidebar'
import { PlanBadge, StatusBadge } from './subscription-badges'
import { cn } from '@/lib/utils'

// Re-export type for the page
export type { SuperAdminSubscription }

type Props = {
  subscriptions: SuperAdminSubscription[]
  planOptions: string[]
  loadError: string | null
}

function toEditForm(sub: SuperAdminSubscription): EditForm {
  return {
    plan: sub.plan.toUpperCase(),
    status: sub.status,
    trial_ends_at: toDateTimeLocalValue(sub.trial_ends_at),
    current_period_starts_at: toDateTimeLocalValue(sub.current_period_starts_at),
    current_period_ends_at: toDateTimeLocalValue(sub.current_period_ends_at),
    cancel_at_period_end: sub.cancel_at_period_end,
  }
}

// ---------------------------------------------------------------------------
// Subscription Focus Hero Component
// ---------------------------------------------------------------------------

function SubscriptionFocusHero({
  subscription: sub,
  onOpenEdit,
  onClearFilter,
  onCopy,
}: {
  subscription: SuperAdminSubscription
  onOpenEdit: () => void
  onClearFilter: () => void
  onCopy: (val: string | null) => void
}) {
  const renewalDays = daysUntil(sub.current_period_ends_at)
  const trialDays = daysUntil(sub.trial_ends_at)
  const progress = periodProgress(sub)
  const priceFormatted = sub.plan_details?.price_monthly
    ? formatMoney(sub.plan_details.price_monthly, sub.plan_details.currency || 'PYG')
    : 'Gratuito / N/A'

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/80 p-3.5 dark:border-violet-800/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-indigo-950/40 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-violet-900 dark:text-violet-200">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span>Mostrando Suscripción de Tenant Seleccionado</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilter}
          className="h-8 gap-1.5 rounded-xl text-xs font-bold border-violet-300 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
          Ver todas las suscripciones
        </Button>
      </div>

      {/* Main Focus Card */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-900/95">

        {/* Header Hero */}
        <div className="flex flex-col gap-5 border-b border-slate-100 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white text-xl font-black shadow-md ring-2 ring-white dark:ring-slate-800">
              {sub.organization_name.slice(0, 2).toUpperCase()}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                  {sub.organization_name}
                </h2>
                <PlanBadge plan={sub.plan} />
                <StatusBadge status={sub.status} />
                <Badge variant="outline" className="rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                  {priceFormatted}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                {sub.organization_slug && (
                  <button
                    type="button"
                    onClick={() => onCopy(`${window.location.origin}/${sub.organization_slug}/inicio`)}
                    className="inline-flex items-center gap-1 font-mono font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 transition-colors cursor-pointer"
                    title="Copiar URL pública"
                  >
                    <span>/{sub.organization_slug}</span>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-500 font-medium">Proveedor: <strong className="text-slate-800 dark:text-slate-200">{sub.provider.toUpperCase()}</strong></span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() => onCopy(sub.id)}
                  className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Copiar UUID de suscripción"
                >
                  <span className="truncate max-w-[120px] sm:max-w-[200px]">ID: {sub.id}</span>
                  <Copy className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={onOpenEdit}
              size="sm"
              className="gap-1.5 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 shadow-md cursor-pointer"
            >
              <Wrench className="h-3.5 w-3.5" />
              Editar Suscripción
            </Button>
            <EnterSupportButton organizationId={sub.organization_id} organizationName={sub.organization_name} />
            {sub.organization_slug && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer">
                <a href={`/${sub.organization_slug}/inicio`} target="_blank" rel="noreferrer">
                  <Globe className="h-3.5 w-3.5 text-cyan-600" />
                  Abrir tienda
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer">
              <Link href={`/superadmin/organizations?q=${encodeURIComponent(sub.organization_slug || sub.organization_name)}`}>
                <Building2 className="h-3.5 w-3.5 text-violet-600" />
                Ficha Empresa
              </Link>
            </Button>
          </div>
        </div>

        {/* Focus KPI Bar */}
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Plan & Facturación</p>
            <p className="truncate text-base font-black text-slate-900 dark:text-slate-100">{sub.plan_details?.name || sub.plan}</p>
            <p className="truncate text-xs text-slate-500 font-medium">{priceFormatted}</p>
          </div>

          <div className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Vigencia del Período</p>
              <span className={cn('text-xs font-extrabold', renewalDays !== null && renewalDays <= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {renewalDays === null ? 'Sin vencimiento' : renewalDays < 0 ? `${Math.abs(renewalDays)}d vencido` : `${renewalDays}d restantes`}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-[11px] text-slate-400 font-medium">{periodLabel(sub)}</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Uso Operativo del Tenant</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {sub.members_count ?? 0} miembros · {sub.products_count ?? 0} productos
            </p>
            <p className="text-xs text-slate-500 font-medium">{sub.sales_count ?? 0} ventas registradas</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Acción Recomendada</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{getRecommendation(sub)}</p>
            <p className="text-xs text-slate-500 font-medium">Owner: {sub.owner_email || 'Sin email'}</p>
          </div>
        </div>

      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function SubscriptionsDashboard({ subscriptions, planOptions: configuredPlanOptions, loadError }: Props) {
  const router = useRouter()

  // Filters
  const { state, setValue } = useUrlListState({
    q: '',
    plan: 'ALL',
    status: 'ALL',
    provider: 'ALL',
    sort: 'attention',
    tab: 'all',
    page: '1',
    size: '25',
  })
  const query = state.q
  const plan = state.plan
  const status = state.status
  const provider = state.provider
  const sort = state.sort as SortValue
  const tab = state.tab as TabValue
  const setFilter = (key: 'q' | 'plan' | 'status' | 'provider' | 'sort' | 'tab', value: string) => {
    setValue(key, value)
    setValue('page', '1')
  }
  const setQuery = (value: string) => setFilter('q', value)
  const setPlan = (value: string) => setFilter('plan', value)
  const setStatus = (value: string) => setFilter('status', value)
  const setProvider = (value: string) => setFilter('provider', value)
  const setSort = (value: SortValue) => setFilter('sort', value)
  const setTab = (value: TabValue) => setFilter('tab', value)

  // Detail dialog
  const [selected, setSelected] = useState<SuperAdminSubscription | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Derived filter options
  const planOptions = useMemo(
    () => Array.from(new Set([...configuredPlanOptions, ...subscriptions.map((s) => s.plan.toUpperCase())])).sort(),
    [configuredPlanOptions, subscriptions]
  )
  const statusOptions = useMemo(
    () => Array.from(new Set(subscriptions.map((s) => s.status))).sort(),
    [subscriptions]
  )
  const providerOptions = useMemo(
    () => Array.from(new Set(subscriptions.map((s) => s.provider || 'manual'))).sort(),
    [subscriptions]
  )

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: subscriptions.length,
    attention: subscriptions.filter(isAttention).length,
    canceling: subscriptions.filter((s) => s.cancel_at_period_end).length,
    renewals: subscriptions.filter((s) => {
      const d = daysUntil(s.current_period_ends_at)
      return d !== null && d >= 0 && d <= 14
    }).length,
    trials: subscriptions.filter((s) => {
      const d = daysUntil(s.trial_ends_at)
      return s.status === 'trialing' || (d !== null && d >= 0 && d <= 14)
    }).length,
  }), [subscriptions])

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return subscriptions
      .filter((s) => {
        const renewalDays = daysUntil(s.current_period_ends_at)
        const trialDays = daysUntil(s.trial_ends_at)

        const matchesQuery =
          !q ||
          [
            s.organization_name,
            s.organization_slug,
            s.owner_name,
            s.owner_email,
            s.provider,
            s.provider_customer_id,
            s.provider_subscription_id,
            s.id,
            s.organization_id,
          ].some((v) => v?.toLowerCase().includes(q))

        const matchesPlan = plan === 'ALL' || s.plan.toUpperCase() === plan
        const matchesStatus = status === 'ALL' || s.status === status
        const matchesProvider = provider === 'ALL' || s.provider === provider

        const matchesTab =
          tab === 'all' ||
          (tab === 'attention' && isAttention(s)) ||
          (tab === 'renewals' && renewalDays !== null && renewalDays >= 0 && renewalDays <= 14) ||
          (tab === 'trials' &&
            (s.status === 'trialing' || (trialDays !== null && trialDays >= 0 && trialDays <= 14))) ||
          (tab === 'canceling' && s.cancel_at_period_end)

        return matchesQuery && matchesPlan && matchesStatus && matchesProvider && matchesTab
      })
      .sort((a, b) => {
        if (sort === 'renewal')
          return (daysUntil(a.current_period_ends_at) ?? 99999) - (daysUntil(b.current_period_ends_at) ?? 99999)
        if (sort === 'trial')
          return (daysUntil(a.trial_ends_at) ?? 99999) - (daysUntil(b.trial_ends_at) ?? 99999)
        if (sort === 'plan') return a.plan.localeCompare(b.plan)
        if (sort === 'name') return a.organization_name.localeCompare(b.organization_name)
        return Number(isAttention(b)) - Number(isAttention(a))
      })
  }, [plan, provider, query, sort, status, subscriptions, tab])

  const pagination = useMemo(
    () => paginateList(filtered, state.page, state.size),
    [filtered, state.page, state.size]
  )

  const focusedSubscription = query.trim() && filtered.length === 1 ? filtered[0] ?? null : null

  // Stats
  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active').length
    const trialing = subscriptions.filter((s) => s.status === 'trialing').length
    const atRisk = subscriptions.filter((s) => ['past_due', 'unpaid'].includes(s.status)).length
    const canceling = subscriptions.filter((s) => s.cancel_at_period_end).length
    const renewingSoon = tabCounts.renewals
    const estimatedMrr = subscriptions
      .filter((s) => ['active', 'trialing'].includes(s.status))
      .reduce((sum, s) => sum + (s.plan_details?.price_monthly ?? 0), 0)
    const conversionBase = active + trialing
    const activeRate = conversionBase ? Math.round((active / conversionBase) * 100) : 0

    return { active, activeRate, atRisk, canceling, estimatedMrr, renewingSoon, trialing, total: subscriptions.length }
  }, [subscriptions, tabCounts.renewals])

  const attentionList = useMemo(() => filtered.filter(isAttention).slice(0, 5), [filtered])

  // Handlers
  function clearFilters() {
    setQuery('')
    setPlan('ALL')
    setStatus('ALL')
    setProvider('ALL')
    setSort('attention')
  }

  function exportCsv() {
    const rows = [
      [
        'Organización', 'Slug', 'Plan', 'Estado', 'Provider',
        'Provider customer', 'Provider subscription', 'Periodo actual',
        'Trial termina', 'Cancela al final', 'Acción sugerida', 'Owner', 'Email owner',
      ],
      ...filtered.map((s) => [
        s.organization_name,
        s.organization_slug || '',
        s.plan,
        s.status,
        s.provider,
        s.provider_customer_id || '',
        s.provider_subscription_id || '',
        periodLabel(s),
        s.trial_ends_at || '',
        s.cancel_at_period_end ? 'si' : 'no',
        getRecommendation(s),
        s.owner_name || s.owner_id || '',
        s.owner_email || '',
      ]),
    ]
    const blob = new Blob(
      [rows.map((row) => row.map(csvCell).join(',')).join('\n')],
      { type: 'text/csv;charset=utf-8;' }
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `suscripciones-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Reporte CSV descargado con éxito')
  }

  async function copyValue(value: string | null) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  function openDetail(sub: SuperAdminSubscription) {
    setSelected(sub)
    setEditForm(toEditForm(sub))
    setSaveError(null)
  }

  function closeDetail() {
    setSelected(null)
    setEditForm(null)
    setSaveError(null)
  }

  async function saveSubscription() {
    if (!selected || !editForm) return
    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/superadmin/subscriptions/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: editForm.plan,
          status: editForm.status,
          trial_ends_at: editForm.trial_ends_at || null,
          current_period_starts_at: editForm.current_period_starts_at || null,
          current_period_ends_at: editForm.current_period_ends_at || null,
          cancel_at_period_end: editForm.cancel_at_period_end,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar la suscripción')
      }

      toast.success('Suscripción actualizada correctamente')
      router.refresh()
      closeDetail()
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'No se pudo actualizar la suscripción'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const TABS: { value: TabValue; label: string }[] = [
    { value: 'all', label: `Todas (${tabCounts.all})` },
    { value: 'attention', label: `Atención (${tabCounts.attention})` },
    { value: 'renewals', label: `Renovaciones (${tabCounts.renewals})` },
    { value: 'trials', label: `Trials (${tabCounts.trials})` },
    { value: 'canceling', label: `Cancelan (${tabCounts.canceling})` },
  ]

  // Robot Mascot Mood & Insight
  const robotMood: RobotMood = focusedSubscription
    ? focusedSubscription.status === 'active' ? 'healthy' : 'warning'
    : stats.atRisk > 0 ? 'warning' : 'healthy'

  const robotMessage = focusedSubscription
    ? `Suscripción de ${focusedSubscription.organization_name} · Plan ${focusedSubscription.plan} (${formatMoney(focusedSubscription.plan_details?.price_monthly ?? 0, 'PYG')}) · ${getRecommendation(focusedSubscription)}`
    : `MRR Estimado: ${formatMoney(stats.estimatedMrr, 'PYG')} · ${stats.active} suscripciones activas (${stats.activeRate}% tasa de conversión). ${stats.atRisk} cuentas requieren atención.`

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            <CreditCard className="h-3.5 w-3.5 text-violet-500" />
            Superadmin · Facturación & Planes SaaS
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Control de Suscripciones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Monitoreo operativo de planes, trials, renovaciones y cuentas en riesgo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 shadow-md cursor-pointer">
            <Link href="/superadmin/plans">
              <Sparkles className="h-3.5 w-3.5" />
              Catálogo de Planes
            </Link>
          </Button>
        </div>
      </header>

      {/* 🤖 ROBOT MASCOT GUARDIAN */}
      <MonitoringRobotMascot
        mood={robotMood}
        statusText={robotMessage}
        headline={focusedSubscription ? `Auditoría: ${focusedSubscription.organization_name}` : 'Analista Financiero SaaS'}
        metrics={{
          healthScore: stats.activeRate,
          activeAlerts: stats.atRisk,
        }}
        onQuickAction={() => router.refresh()}
        actionLabel="Sincronizar Datos"
      />

      {/* Focused Subscription Hero Panel */}
      {focusedSubscription && (
        <SubscriptionFocusHero
          subscription={focusedSubscription}
          onOpenEdit={() => openDetail(focusedSubscription)}
          onClearFilter={() => setQuery('')}
          onCopy={copyValue}
        />
      )}

      {/* Load error */}
      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar las suscripciones</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      {!focusedSubscription && <SubscriptionStats stats={stats} />}

      {/* Main content + sidebar */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Table card */}
        <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                    Cartera de Suscripciones
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                    {filtered.length} de {subscriptions.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Segmenta la cartera, ordena por urgencia y edita sin salir del flujo.
                </CardDescription>
              </div>
            </div>

            <div className="pt-2">
              <SubscriptionFilters
                query={query}
                plan={plan}
                status={status}
                provider={provider}
                sort={sort}
                planOptions={planOptions}
                statusOptions={statusOptions}
                providerOptions={providerOptions}
                filteredCount={filtered.length}
                totalCount={subscriptions.length}
                onQueryChange={setQuery}
                onPlanChange={setPlan}
                onStatusChange={setStatus}
                onProviderChange={setProvider}
                onSortChange={setSort}
                onClear={clearFilters}
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as TabValue)}
            >
              {/* Tab list */}
              <div className="overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-6 dark:border-slate-800 dark:bg-slate-900/30">
                <TabsList className="h-11 gap-2 rounded-none bg-transparent p-0">
                  {TABS.map(({ value, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-11 rounded-none border-b-2 border-transparent px-3 text-xs font-bold text-slate-500 data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 dark:text-slate-400 dark:data-[state=active]:border-violet-400 dark:data-[state=active]:text-violet-300 transition-all cursor-pointer"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Tab content */}
              {TABS.map(({ value }) => (
                <TabsContent key={value} value={value} className="m-0">
                  {/* Desktop table */}
                  <div className="hidden lg:block">
                    <SubscriptionTable
                      items={pagination.items}
                      onOpenDetail={openDetail}
                      onCopyValue={copyValue}
                    />
                  </div>

                  {/* Mobile/tablet cards */}
                  <div className="grid gap-3 p-4 lg:hidden">
                    {filtered.length > 0 ? (
                      pagination.items.map((sub) => (
                        <SubscriptionCard
                          key={sub.id}
                          subscription={sub}
                          onOpenDetail={openDetail}
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-400">
                          No hay suscripciones que coincidan con los filtros.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <Pagination
              className="border-t border-slate-100 dark:border-slate-800 px-6 py-4"
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              itemsPerPage={pagination.pageSize}
              totalItems={filtered.length}
              itemsPerPageOptions={[...SUPERADMIN_PAGE_SIZES]}
              onPageChange={(page) => setValue('page', String(page))}
              onItemsPerPageChange={(size) => {
                setValue('size', String(size))
                setValue('page', '1')
              }}
            />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <SubscriptionSidebar
          attentionList={attentionList}
          stats={stats}
          onOpenDetail={openDetail}
        />
      </div>

      {/* Detail dialog */}
      <SubscriptionDetailDialog
        subscription={selected}
        editForm={editForm}
        isSaving={isSaving}
        planOptions={planOptions}
        saveError={saveError}
        onClose={closeDetail}
        onEditFormChange={setEditForm}
        onSave={saveSubscription}
        onCopyValue={copyValue}
      />
    </div>
  )
}
