'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Eye,
  Globe,
  Laptop,
  Layers,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Phone,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tablet,
  Timer,
  Users,
  X,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DEFAULT_SITE_ANALYTICS_RANGE_DAYS,
  SITE_ANALYTICS_RANGE_DAYS,
  type SiteAnalyticsRangeDays,
  type SiteAnalyticsSite,
  type SiteAnalyticsSummary,
} from '@/lib/site-analytics/shared'

type Variant = 'organization' | 'platform'

type ApiPayload = {
  success: boolean
  error?: string
  data?: {
    summary: SiteAnalyticsSummary
    organization?: { name: string; slug: string } | null
  }
}

const RANGE_LABELS: Record<SiteAnalyticsRangeDays, string> = {
  1: 'Hoy',
  7: '7 días',
  30: '30 días',
  90: '90 días',
}

const SITE_LABELS: Record<SiteAnalyticsSite, string> = {
  storefront: 'Tiendas',
  marketplace: 'Marketplace',
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  inicio: 'Inicio',
  productos: 'Catálogo',
  producto: 'Producto',
  ofertas: 'Ofertas',
  servicios: 'Servicios',
  carrito: 'Carrito',
  track: 'Seguimiento de pedido',
  'mis-reparaciones': 'Mis reparaciones',
  cliente: 'Acceso de clientes',
  perfil: 'Perfil de cliente',
  marketplace: 'Marketplace · inicio',
  empresa: 'Perfil en marketplace',
  empresas: 'Marketplace · empresas',
  categorias: 'Marketplace · categorías',
  buscar: 'Marketplace · búsqueda',
}

const DEVICE_META = {
  mobile: { label: 'Celular', icon: Smartphone },
  tablet: { label: 'Tablet', icon: Tablet },
  desktop: { label: 'Computadora', icon: Laptop },
} as const

const numberFormat = new Intl.NumberFormat('es-PY')

function formatNumber(value: number) {
  return numberFormat.format(Math.round(value || 0))
}

function percentChange(current: number, previous: number) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

function countryName(code: string) {
  if (code === '??') return 'Desconocido'
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function formatDayLabel(isoDate: string) {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  trend?: number | null
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              {trend != null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    trend > 0 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                    trend < 0 && 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
                    trend === 0 && 'bg-muted text-muted-foreground'
                  )}
                >
                  {trend > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend < 0 ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                  {trend > 0 ? '+' : ''}
                  {trend}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BarList({
  items,
  emptyText,
}: {
  items: Array<{ key: string; label: React.ReactNode; value: number; suffix?: string }>
  emptyText: string
}) {
  const max = Math.max(...items.map((item) => item.value), 0)
  if (items.length === 0 || max === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="relative overflow-hidden rounded-md">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-primary/10"
            style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatNumber(item.value)}
              {item.suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{item.suffix}</span>}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------

export function SiteAnalyticsDashboard({ endpoint, variant }: { endpoint: string; variant: Variant }) {
  const [days, setDays] = useState<SiteAnalyticsRangeDays>(DEFAULT_SITE_ANALYTICS_RANGE_DAYS)
  const [site, setSite] = useState<SiteAnalyticsSite | null>(null)
  const [organizationFilter, setOrganizationFilter] = useState<{ id: string; name: string } | null>(null)
  const [payload, setPayload] = useState<ApiPayload['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams({ days: String(days) })
    if (variant === 'platform') {
      if (site) params.set('site', site)
      if (organizationFilter) params.set('organizationId', organizationFilter.id)
    }
    return `${endpoint}?${params}`
  }, [endpoint, variant, days, site, organizationFilter])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(url, { cache: 'no-store', signal })
      const json = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || 'No se pudieron cargar las visitas')
      }
      setPayload(json.data)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => void load(controller.signal))
    return () => controller.abort()
  }, [load])

  const summary = payload?.summary
  const totals = summary?.totals
  const hasData = (totals?.page_views ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Período">
            {SITE_ANALYTICS_RANGE_DAYS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                aria-pressed={days === option}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  days === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {RANGE_LABELS[option]}
              </button>
            ))}
          </div>

          {variant === 'platform' && (
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Sitio">
              {([null, 'storefront', 'marketplace'] as const).map((option) => (
                <button
                  key={option ?? 'all'}
                  type="button"
                  onClick={() => setSite(option)}
                  aria-pressed={site === option}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    site === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option ? SITE_LABELS[option] : 'Todo'}
                </button>
              ))}
            </div>
          )}

          {organizationFilter && (
            <Badge variant="secondary" className="gap-1 pr-1">
              <Building2 className="h-3 w-3" />
              {organizationFilter.name}
              <button
                type="button"
                onClick={() => setOrganizationFilter(null)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background"
                aria-label="Quitar filtro de organización"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {summary && (
            <Badge variant="outline" className="gap-1.5 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {formatNumber(summary.active_now)} en línea ahora
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">Actualizar</span>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!summary && loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando visitas...
        </div>
      )}

      {summary && totals && (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
          {!hasData && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                {variant === 'organization'
                  ? 'Todavía no hay visitas registradas en este período. Las visitas a tu tienda online aparecerán aquí automáticamente.'
                  : 'Todavía no hay visitas registradas en este período.'}
                {payload?.organization?.slug && (
                  <span className="mt-1 block">
                    Tu sitio: <span className="font-mono">/{payload.organization.slug}/inicio</span>
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Visitas"
              value={formatNumber(totals.page_views)}
              hint="Páginas vistas"
              icon={Eye}
              trend={percentChange(totals.page_views, summary.previous.page_views)}
            />
            <KpiCard
              label="Visitantes"
              value={formatNumber(totals.visitors)}
              hint="Visitantes únicos"
              icon={Users}
              trend={percentChange(totals.visitors, summary.previous.visitors)}
            />
            <KpiCard label="Sesiones" value={formatNumber(totals.sessions)} hint="Visitas de 30 min" icon={Activity} />
            <KpiCard
              label="Páginas/sesión"
              value={Number(totals.pages_per_session).toLocaleString('es-PY', { maximumFractionDigits: 2 })}
              hint="Profundidad de navegación"
              icon={Layers}
            />
            <KpiCard
              label="Rebote"
              value={`${Number(totals.bounce_rate).toLocaleString('es-PY', { maximumFractionDigits: 1 })}%`}
              hint="Sesiones de una sola página"
              icon={Timer}
            />
            <KpiCard
              label="Contactos"
              value={formatNumber(summary.interactions.whatsapp_click + summary.interactions.phone_click)}
              hint="WhatsApp + llamadas"
              icon={MessageCircle}
            />
          </div>

          {/* Evolución diaria */}
          <SectionCard
            title="Evolución de visitas"
            description={`Del ${formatDayLabel(summary.range.from)} al ${formatDayLabel(summary.range.to)} · la variación compara con el período anterior`}
            icon={Activity}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="siteViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="siteVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fontSize: 11 }} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(value) => formatDayLabel(String(value))}
                    formatter={(value) => formatNumber(Number(value))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="page_views" name="Visitas" stroke="#3b82f6" fill="url(#siteViews)" strokeWidth={2} />
                  <Area type="monotone" dataKey="visitors" name="Visitantes" stroke="#10b981" fill="url(#siteVisitors)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Interacciones + embudo */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Interacciones" description="Acciones de los visitantes en el sitio" icon={MousePointerClick}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'whatsapp_click', label: 'Clics a WhatsApp', icon: MessageCircle },
                  { key: 'phone_click', label: 'Clics para llamar', icon: Phone },
                  { key: 'add_to_cart', label: 'Agregados al carrito', icon: ShoppingCart },
                  { key: 'order_placed', label: 'Pedidos enviados', icon: ShoppingBag },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {formatNumber(summary.interactions[key as keyof SiteAnalyticsSummary['interactions']])}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Embudo de conversión" description="Sesiones que avanzaron en cada paso" icon={ShoppingBag}>
              <ul className="space-y-3">
                {[
                  { label: 'Sesiones', value: summary.funnel.sessions },
                  { label: 'Vieron un producto', value: summary.funnel.viewed_product },
                  { label: 'Agregaron al carrito', value: summary.funnel.added_to_cart },
                  { label: 'Contactaron o pidieron', value: summary.funnel.contacted_or_ordered },
                ].map((step) => {
                  const pct = share(step.value, summary.funnel.sessions)
                  return (
                    <li key={step.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{step.label}</span>
                        <span className="tabular-nums">
                          <span className="font-semibold">{formatNumber(step.value)}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          </div>

          {/* Páginas y productos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Páginas más vistas" icon={Eye}>
              <BarList
                emptyText="Sin visitas en este período"
                items={summary.top_pages.map((page) => ({
                  key: page.path,
                  value: page.page_views,
                  label: (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {PAGE_TYPE_LABELS[page.page_type ?? ''] ?? page.page_type ?? 'Página'}
                        {page.product_name && <span className="font-normal text-muted-foreground"> · {page.product_name}</span>}
                      </span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">{page.path}</span>
                    </span>
                  ),
                }))}
              />
            </SectionCard>

            <SectionCard title="Productos más vistos" icon={ShoppingCart}>
              <BarList
                emptyText="Sin productos vistos en este período"
                items={summary.top_products.map((product) => ({
                  key: product.product_id,
                  value: product.views,
                  suffix: product.add_to_cart ? `· ${formatNumber(product.add_to_cart)} al carrito` : undefined,
                  label: <span className="font-medium">{product.name ?? 'Producto eliminado'}</span>,
                }))}
              />
            </SectionCard>
          </div>

          {/* Origen del tráfico */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Fuentes de tráfico" description="Por sesión" icon={Globe}>
              <BarList
                emptyText="Sin datos"
                items={summary.sources.map((source) => ({
                  key: source.source,
                  value: source.sessions,
                  label: source.source === 'directo' ? 'Directo / sin referencia' : source.source,
                }))}
              />
            </SectionCard>

            <SectionCard title="Dispositivos" description="Por sesión" icon={Smartphone}>
              <BarList
                emptyText="Sin datos"
                items={summary.devices.map((device) => {
                  const meta = DEVICE_META[device.device] ?? DEVICE_META.desktop
                  const Icon = meta.icon
                  return {
                    key: device.device,
                    value: device.sessions,
                    suffix: `${share(device.sessions, totals.sessions)}%`,
                    label: (
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {meta.label}
                      </span>
                    ),
                  }
                })}
              />
            </SectionCard>

            <SectionCard title="Países" description="Visitantes únicos" icon={Globe}>
              <BarList
                emptyText="Sin datos"
                items={summary.countries.map((country) => ({
                  key: country.country,
                  value: country.visitors,
                  label: countryName(country.country),
                }))}
              />
            </SectionCard>
          </div>

          {/* Desglose por sitio */}
          <SectionCard
            title={variant === 'organization' ? 'Tienda online vs. marketplace' : 'Tiendas vs. marketplace'}
            description={
              variant === 'organization'
                ? 'Visitas a tu tienda y a tu perfil dentro del marketplace'
                : 'Distribución de visitas entre las tiendas de las organizaciones y el marketplace'
            }
            icon={Layers}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(['storefront', 'marketplace'] as const).map((key) => {
                const row = summary.by_site.find((item) => item.site === key)
                const views = row?.page_views ?? 0
                return (
                  <div key={key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {key === 'storefront' ? (variant === 'organization' ? 'Tienda online' : 'Tiendas') : 'Marketplace'}
                      </span>
                      <span className="text-xs text-muted-foreground">{share(views, totals.page_views)}%</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(views)}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(row?.visitors ?? 0)} visitantes</p>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Organizaciones (superadmin) */}
          {variant === 'platform' && !organizationFilter && (
            <SectionCard
              title="Visitas por organización"
              description="Hacé clic en una organización para ver solo sus datos"
              icon={Building2}
            >
              {summary.top_organizations.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin visitas atribuidas a organizaciones</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Organización</th>
                        <th className="py-2 pr-3 text-right font-semibold">Visitas</th>
                        <th className="py-2 pr-3 text-right font-semibold">Visitantes</th>
                        <th className="py-2 text-right font-semibold">En marketplace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_organizations.map((org) => (
                        <tr
                          key={org.organization_id}
                          className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                          onClick={() => setOrganizationFilter({ id: org.organization_id, name: org.name })}
                        >
                          <td className="py-2 pr-3">
                            <div className="font-medium">{org.name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">/{org.slug}</div>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(org.page_views)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(org.visitors)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(org.marketplace_views)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}
