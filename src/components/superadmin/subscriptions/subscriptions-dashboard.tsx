'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Download,
  RefreshCw,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { EditForm, SuperAdminSubscription, SortValue, TabValue } from './types'
import {
  csvCell,
  daysUntil,
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
import { SubscriptionSidebar } from './subscription-sidebar'

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

export function SubscriptionsDashboard({ subscriptions, planOptions: configuredPlanOptions, loadError }: Props) {
  const router = useRouter()

  // Filters
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [provider, setProvider] = useState('ALL')
  const [sort, setSort] = useState<SortValue>('attention')
  const [tab, setTab] = useState<TabValue>('all')

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
  }

  async function copyValue(value: string | null) {
    if (!value) return
    await navigator.clipboard.writeText(value)
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

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50">
              <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Billing SaaS
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Suscripciones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control operativo de planes, trials, renovaciones y cuentas en riesgo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button asChild size="sm" className="h-9 gap-2">
            <Link href="/superadmin/billing">
              Facturación
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Load error */}
      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar las suscripciones</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <SubscriptionStats stats={stats} />

      {/* Main content + sidebar */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* Table card */}
        <Card className="overflow-hidden rounded-xl border-0 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800/80">
          <CardHeader className="border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Control de suscripciones</CardTitle>
                <p className="mt-1 text-sm text-slate-400">
                  Segmenta la cartera, ordena por urgencia y edita sin salir del flujo.
                </p>
              </div>
            </div>

            <div className="mt-4">
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
              <div className="overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-4 dark:border-slate-800 dark:bg-slate-900/30">
                <TabsList className="h-11 gap-0 rounded-none bg-transparent p-0">
                  {TABS.map(({ value, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-11 rounded-none border-b-2 border-transparent px-4 text-sm font-medium text-slate-500 data-[state=active]:border-slate-900 data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:text-slate-400 dark:data-[state=active]:border-slate-100 dark:data-[state=active]:text-slate-100"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Tab content — same filtered list for all tabs (filtering is done in useMemo) */}
              {TABS.map(({ value }) => (
                <TabsContent key={value} value={value} className="m-0">
                  {/* Desktop table */}
                  <div className="hidden xl:block">
                    <SubscriptionTable
                      items={filtered}
                      onOpenDetail={openDetail}
                      onCopyValue={copyValue}
                    />
                  </div>

                  {/* Mobile/tablet cards */}
                  <div className="grid gap-3 p-4 xl:hidden">
                    {filtered.length > 0 ? (
                      filtered.map((sub) => (
                        <SubscriptionCard
                          key={sub.id}
                          subscription={sub}
                          onOpenDetail={openDetail}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
                        <p className="text-sm text-slate-400">
                          No hay suscripciones que coincidan con los filtros.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
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
