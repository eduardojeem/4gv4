'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Download,
  LayoutGrid,
  LayoutList,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUrlListState } from '@/hooks/useUrlListState'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'

import type { EditForm, SuperAdminSubscription, SortValue, TabValue } from './types'
import {
  csvCell,
  daysUntil,
  formatMoney,
  getRecommendation,
  isAttention,
  periodLabel,
  toDateTimeLocalValue,
} from './utils'
import { SubscriptionStats } from './subscription-stats'
import { SubscriptionFilters } from './subscription-filters'
import { SubscriptionTable } from './subscription-table'
import { SubscriptionCard } from './subscription-card'
import { SubscriptionDetailDialog } from './subscription-detail-dialog'

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
    storefront_public: Boolean(sub.storefront_public),
    marketplace_public: Boolean(sub.marketplace_public),
  }
}

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

  // Risk banner dismissal
  const [riskBannerDismissed, setRiskBannerDismissed] = useState(false)

  // View mode toggle: table (default on desktop) or grid cards
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

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
          storefront_public: editForm.storefront_public,
          marketplace_public: editForm.marketplace_public,
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

  const TABS: { value: TabValue; label: string; count: number; alertColor?: string }[] = [
    { value: 'all', label: 'Todas', count: tabCounts.all },
    { value: 'attention', label: 'Atención', count: tabCounts.attention, alertColor: tabCounts.attention > 0 ? 'rose' : undefined },
    { value: 'renewals', label: 'Renovaciones', count: tabCounts.renewals, alertColor: tabCounts.renewals > 0 ? 'amber' : undefined },
    { value: 'trials', label: 'Trials', count: tabCounts.trials },
    { value: 'canceling', label: 'Cancelan', count: tabCounts.canceling },
  ]

  const hasActiveFilters = query !== '' || plan !== 'ALL' || status !== 'ALL' || provider !== 'ALL' || sort !== 'attention'

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">

      {/* ── Page header ───────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <CreditCard className="h-3.5 w-3.5 text-violet-500" />
            Superadmin · Facturación & Planes SaaS
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Suscripciones
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button
            asChild
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 shadow-sm cursor-pointer"
          >
            <Link href="/superadmin/plans">
              <Sparkles className="h-3.5 w-3.5" />
              Catálogo de Planes
            </Link>
          </Button>
        </div>
      </header>

      {/* ── Load error ────────────────────────────────────────────── */}
      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar las suscripciones</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <SubscriptionStats
        stats={stats}
        onNavigate={(targetTab) => {
          setTab(targetTab as TabValue)
          setRiskBannerDismissed(false)
        }}
      />

      {/* ── Risk alert banner ─────────────────────────────────────── */}
      {stats.atRisk > 0 && !riskBannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              {stats.atRisk} {stats.atRisk === 1 ? 'cuenta requiere' : 'cuentas requieren'} atención inmediata —{' '}
              <span className="underline underline-offset-2">cobros pendientes o sin pagar</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 gap-1 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
              onClick={() => {
                setTab('attention')
                setRiskBannerDismissed(true)
              }}
            >
              Ver ahora
              <ArrowRight className="h-3 w-3" />
            </Button>
            <button
              type="button"
              onClick={() => setRiskBannerDismissed(true)}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/40 cursor-pointer"
              title="Cerrar alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main card (full-width) ─────────────────────────────────── */}
      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {/* Card header: title + count + filters */}
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-3">
            {/* Title row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Cartera de Suscripciones
                </CardTitle>
                <Badge
                  variant="outline"
                  className="h-5 rounded-md bg-violet-50 px-1.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                >
                  {filtered.length} / {subscriptions.length}
                </Badge>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <CardDescription className="hidden text-xs sm:block">
                  Ordena por urgencia, filtra y gestiona sin salir del flujo.
                </CardDescription>
                {/* View mode toggle — only visible on desktop */}
                <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800 lg:flex">
                  <button
                    type="button"
                    title="Vista tabla"
                    onClick={() => setViewMode('table')}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Vista tarjetas"
                    onClick={() => setViewMode('grid')}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filters row */}
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>

            {/* Tab list */}
            <div className="overflow-x-auto border-b border-slate-100 bg-white px-1 dark:border-slate-800 dark:bg-slate-900">
              <TabsList className="h-10 gap-0 rounded-none bg-transparent p-0">
                {TABS.map(({ value, label, count, alertColor }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="relative h-10 rounded-none border-b-2 border-transparent px-3.5 text-xs font-semibold text-slate-500 transition-all data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-700 dark:text-slate-400 dark:data-[state=active]:border-violet-400 dark:data-[state=active]:text-violet-300 cursor-pointer"
                  >
                    {label}
                    {count > 0 && (
                      <span
                        className={`ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                          alertColor === 'rose'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : alertColor === 'amber'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab content */}
            {TABS.map(({ value }) => (
              <TabsContent key={value} value={value} className="m-0">
                {/* Desktop: table or grid based on viewMode */}
                {viewMode === 'table' ? (
                  <div className="hidden lg:block">
                    <SubscriptionTable
                      items={pagination.items}
                      onOpenDetail={openDetail}
                      onCopyValue={copyValue}
                    />
                  </div>
                ) : (
                  <div className="hidden gap-4 p-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                    {pagination.items.length > 0 ? (
                      pagination.items.map((sub) => (
                        <SubscriptionCard
                          key={sub.id}
                          subscription={sub}
                          onOpenDetail={openDetail}
                        />
                      ))
                    ) : (
                      <div className="col-span-3 rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
                        <p className="text-sm font-semibold text-slate-400">
                          No hay suscripciones que coincidan con los filtros.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile/tablet: always cards, 2 cols on sm */}
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">
                  {pagination.items.length > 0 ? (
                    pagination.items.map((sub) => (
                      <SubscriptionCard
                        key={sub.id}
                        subscription={sub}
                        onOpenDetail={openDetail}
                      />
                    ))
                  ) : (
                    <div className="col-span-2 rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-400">
                        No hay suscripciones que coincidan con los filtros.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Pagination */}
          <Pagination
            className="border-t border-slate-100 dark:border-slate-800 px-5 py-3.5"
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

      {/* ── Detail dialog ─────────────────────────────────────────── */}
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
