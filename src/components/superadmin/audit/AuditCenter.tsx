'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, Loader2, ScrollText, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Notice, PageHeader } from '@/components/superadmin/ui/page-header'
import { auditActionLabel } from '@/lib/superadmin/audit-labels'
import { getAuditDetailAction } from '@/app/superadmin/audit-logs/actions'
import type { AuditEntry, AuditFilters, AuditPage, AuditSeverity, AuditSource } from '@/lib/superadmin/audit-feed'

const SOURCES: Array<{ value: AuditSource; label: string; hint: string }> = [
  { value: 'platform', label: 'Plataforma', hint: 'Inicios de sesión, cambios de SuperAdmin y de configuración de tiendas' },
  { value: 'tenants', label: 'Tiendas', hint: 'Acciones registradas dentro de cada tienda' },
  { value: 'finance', label: 'Finanzas', hint: 'Altas y cambios en caja, comisiones, nómina y obligaciones' },
  { value: 'settings', label: 'Configuración', hint: 'Cambios campo por campo de la configuración' },
]

const PERIODS: Array<[AuditFilters['period'], string]> = [['24h', '24 horas'], ['7d', '7 días'], ['30d', '30 días'], ['90d', '90 días'], ['365d', '1 año']]

const SEVERITY_META: Record<AuditSeverity, { label: string; badge: string }> = {
  info: { label: 'Info', badge: 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' },
  low: { label: 'Baja', badge: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Media', badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
  high: { label: 'Alta', badge: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300' },
  critical: { label: 'Crítica', badge: 'border-red-300 bg-red-600 text-white dark:border-red-800' },
}

const ALL = 'all'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'short', timeStyle: 'medium' })
}

function toParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.source !== 'platform') params.set('source', filters.source)
  if (filters.period !== '7d') params.set('period', filters.period)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.organizationId) params.set('org', filters.organizationId)
  if (filters.query) params.set('q', filters.query)
  if (filters.includeNoise) params.set('noise', '1')
  if (filters.page) params.set('page', String(filters.page))
  return params
}

export function AuditCenter({
  filters,
  page,
  organizations,
}: {
  filters: AuditFilters
  page: AuditPage
  organizations: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigating, startNavigation] = useTransition()
  const [query, setQuery] = useState(filters.query)
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loadingDetail, startDetail] = useTransition()

  const supports = {
    severity: filters.source === 'platform' || filters.source === 'settings',
    organization: filters.source !== 'settings',
    noise: filters.source === 'platform',
  }
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize))

  const apply = (patch: Partial<AuditFilters>) => {
    const next = { ...filters, page: 0, ...patch }
    startNavigation(() => router.push(`${pathname}?${toParams(next).toString()}`))
  }

  const openEntry = (entry: AuditEntry) => {
    setSelected(entry)
    setDetail(null)
    setDetailError(null)
    startDetail(async () => {
      const result = await getAuditDetailAction(entry.source, entry.id)
      if ('error' in result) setDetailError(result.error)
      else setDetail(result.data)
    })
  }

  const exportHref = `/api/superadmin/audit-logs/export?${toParams({ ...filters, page: 0 }).toString()}`
  const activeFilters = [filters.severity, filters.organizationId, filters.query, filters.includeNoise].filter(Boolean).length

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ScrollText}
        title="Auditoría"
        description="Quién hizo qué y cuándo en toda la plataforma. Elegí la fuente, filtrá y abrí cualquier registro para ver los datos antes y después del cambio."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}><Download className="h-4 w-4" /> Exportar CSV</a>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Fuente de auditoría">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={filters.source === s.value}
            onClick={() => apply({ source: s.value, severity: null, includeNoise: false, organizationId: s.value === 'settings' ? null : filters.organizationId })}
            className={cn(
              'rounded-xl border p-3 text-left transition-colors',
              filters.source === s.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
            )}
          >
            <span className="block text-sm font-semibold">{s.label}</span>
            <span className="block text-xs text-slate-500">{s.hint}</span>
          </button>
        ))}
      </div>

      <Card className="rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-end">
          <form
            className="relative min-w-0 flex-1"
            onSubmit={(e) => { e.preventDefault(); apply({ query: query.trim() }) }}
          >
            <Label htmlFor="audit-search" className="sr-only">Buscar</Label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input id="audit-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Acción, recurso o email del usuario (Enter)" className="pl-8" />
          </form>
          <Select value={filters.period} onValueChange={(v) => apply({ period: v as AuditFilters['period'] })}>
            <SelectTrigger className="lg:w-36" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          {supports.severity && (
            <Select value={filters.severity ?? ALL} onValueChange={(v) => apply({ severity: v === ALL ? null : (v as AuditSeverity) })}>
              <SelectTrigger className="lg:w-36" aria-label="Severidad"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toda severidad</SelectItem>
                {(Object.keys(SEVERITY_META) as AuditSeverity[]).map((s) => <SelectItem key={s} value={s}>{SEVERITY_META[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {supports.organization && (
            <Select value={filters.organizationId ?? ALL} onValueChange={(v) => apply({ organizationId: v === ALL ? null : v })}>
              <SelectTrigger className="lg:w-52" aria-label="Tienda"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las tiendas</SelectItem>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {supports.noise && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Switch checked={filters.includeNoise} onCheckedChange={(v) => apply({ includeNoise: v })} />
              Incluir accesos automáticos a la API
            </label>
          )}
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(''); apply({ severity: null, organizationId: null, query: '', includeNoise: false }) }}>
              <X className="h-4 w-4" /> Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {page.error && <Notice tone="error">No se pudo cargar la auditoría: {page.error}</Notice>}

      <Card className={cn('rounded-xl transition-opacity', navigating && 'opacity-60')}>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
            <span>{page.total.toLocaleString('es-PY')} registros</span>
            {navigating && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          {page.entries.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">No hay registros para estos filtros en el período elegido.</p>
          ) : (
            <ul className="divide-y dark:divide-slate-800">
              {page.entries.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => openEntry(e)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4 dark:hover:bg-slate-800/40">
                    <span className="w-40 shrink-0 font-mono text-xs text-slate-500">{formatDate(e.createdAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{auditActionLabel(e.action)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {e.actorEmail ?? (e.actorId ? 'Usuario eliminado' : 'Sistema')}
                        {e.organizationName ? ` · ${e.organizationName}` : ''}
                        {e.target ? ` · ${e.target}` : ''}
                      </span>
                    </span>
                    {e.severity && (
                      <Badge variant="outline" className={cn('w-fit rounded-full', SEVERITY_META[e.severity].badge)}>{SEVERITY_META[e.severity].label}</Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t px-4 py-2 dark:border-slate-800">
            <Button variant="ghost" size="sm" disabled={filters.page === 0 || navigating} onClick={() => apply({ page: filters.page - 1 })}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span className="text-xs text-slate-500">Página {filters.page + 1} de {pages}</span>
            <Button variant="ghost" size="sm" disabled={filters.page + 1 >= pages || navigating} onClick={() => apply({ page: filters.page + 1 })}>
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{auditActionLabel(selected.action)}</SheetTitle>
                <SheetDescription>{formatDate(selected.createdAt)} · {SOURCES.find((s) => s.value === selected.source)?.label}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Usuario</dt><dd className="break-words font-medium">{selected.actorEmail ?? selected.actorId ?? 'Sistema'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Tienda</dt><dd className="font-medium">{selected.organizationName ?? '—'}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-slate-500">Objetivo</dt><dd className="break-all font-mono text-xs">{selected.target ?? '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Acción técnica</dt><dd className="break-all font-mono text-xs">{selected.action}</dd></div>
                  <div><dt className="text-xs text-slate-500">IP</dt><dd className="font-mono text-xs">{selected.ipAddress ?? '—'}</dd></div>
                </dl>
                {loadingDetail ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando detalle…</p>
                ) : detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : detail && (
                  Object.entries(detail).filter(([, v]) => v !== null && v !== '' && !(typeof v === 'object' && Object.keys(v as object).length === 0)).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{key}</p>
                      <pre className="max-h-64 overflow-auto rounded-lg border bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
