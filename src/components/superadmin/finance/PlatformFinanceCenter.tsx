'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Crown,
  Download,
  Filter,
  Globe,
  Handshake,
  Info,
  Layers,
  Loader2,
  MousePointerClick,
  Package,
  Pencil,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  TicketPercent,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Notice } from '@/components/superadmin/ui/page-header'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_RECURRENCES,
  RECURRENCE_LABEL,
  expenseToPyg,
  monthlyRecurringPyg,
  type ExpenseCategory,
  type ExpenseCurrency,
  type ExpenseRecurrence,
  type FinanceSummary,
  type PlatformExpense,
} from '@/lib/superadmin/platform-finance'
import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from '@/app/superadmin/finanzas/actions'
import {
  PLAN_FEATURES,
  PLAN_FEATURE_GROUP_LABEL,
  type PlanFeatureDefinition,
  type PlanFeatureGroup,
} from '@/lib/saas/plan-feature-catalog'
import { PLAN_FEATURE_ICONS } from '@/components/superadmin/plans/plan-feature-icons'
import {
  DEFAULT_PLATFORM_PLANS,
  type PlatformPlanMetric,
} from '@/lib/superadmin/platform-expenses'

const gs = (value: number) => formatCurrency(Math.round(value), { currency: 'PYG' })

type FormState = {
  id: string | null
  provider: string
  category: ExpenseCategory
  description: string
  amount: string
  currency: ExpenseCurrency
  fxRatePyg: string
  recurrence: ExpenseRecurrence
  startsOn: string
  endsOn: string
  isActive: boolean
}

function expenseStatus(expense: PlatformExpense, today: string) {
  if (!expense.isActive) return { label: 'Pausado', tone: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  if (expense.startsOn > today) return { label: 'Programado', tone: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300' }
  if (expense.endsOn && expense.endsOn < today) return { label: 'Finalizado', tone: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' }
  return { label: 'Vigente', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' }
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p
          className={cn(
            'mt-1.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50',
            tone === 'good' && 'text-emerald-700 dark:text-emerald-300',
            tone === 'bad' && 'text-red-700 dark:text-red-300',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; label: string; monthly: number; sharePercent: number }> }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Costo mensual recurrente</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin gastos recurrentes vigentes.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="relative overflow-hidden rounded-md">
                <div className="absolute inset-y-0 left-0 rounded-md bg-primary/10" style={{ width: `${Math.max(row.sharePercent, 2)}%` }} aria-hidden />
                <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {gs(row.monthly)} <span className="ml-1 text-xs font-normal text-slate-500">{row.sharePercent}%</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Package,
  basic: CreditCard,
  pro: Star,
  enterprise: Crown,
}

const tierAccent: Record<string, string> = {
  free: 'from-slate-400 to-slate-500',
  basic: 'from-blue-400 to-blue-600',
  pro: 'from-violet-500 to-purple-700',
  enterprise: 'from-amber-400 to-orange-500',
}

const tierBadge: Record<string, string> = {
  free: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  basic: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  pro: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  enterprise: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
}

const groupBadge: Record<PlanFeatureGroup, string> = {
  venta: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
  operacion: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
  gestion: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300',
  servicio: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
}

const FEATURE_INFRASTRUCTURE: Record<string, { service: string; hint: string }> = {
  pos: { service: 'Supabase Postgres', hint: 'Transacciones atómicas, caja y tickets' },
  ecommerce: { service: 'Vercel Edge & CDN', hint: 'Catálogo público SSR/ISR y assets' },
  orders: { service: 'Supabase Realtime & Resend', hint: 'Websockets de pedidos y notificaciones' },
  delivery: { service: 'Postgres & Mapas', hint: 'Geocodificación y cálculo de tarifas de envío' },
  promotions: { service: 'Postgres DB', hint: 'Reglas de precios dinámicos y cupones' },
  credits: { service: 'Postgres Ledger', hint: 'Libro de cuentas corrientes y control de cuotas' },
  inventory: { service: 'Supabase Storage & DB', hint: 'Imágenes CDN y control de existencias' },
  inventoryAdmin: { service: 'Postgres Triggers', hint: 'Kardex multisede y auditoría de stock' },
  repairs: { service: 'Postgres DB', hint: 'Taller, órdenes SAT y trazabilidad' },
  services: { service: 'Postgres DB & Cron', hint: 'Agenda horaria y reservas online multirrubro' },
  crm: { service: 'Postgres Trigram Indexes', hint: 'Fichas y búsqueda rápida de clientes' },
  analytics: { service: 'Postgres Cómputo Analítico', hint: 'Agregaciones de ventas, márgenes y KPIs' },
  webAnalytics: { service: 'Telemetría Edge', hint: 'Tracking anónimo de visitas y embudos' },
  security: { service: 'Supabase Audit Logs & RLS', hint: 'Seguridad multi-tenant y auditoría' },
  finances: { service: 'Postgres Ledger', hint: 'Asientos contables y rentabilidad del comercio' },
  reports: { service: 'Node.js Serverless Stream', hint: 'Exportación CSV/Excel y PDFs' },
  users: { service: 'Supabase Auth & JWT', hint: 'Roles, permisos y control de acceso' },
  branches: { service: 'Postgres Multi-tenant', hint: 'Sucursales con inventario y caja propia' },
  support: { service: 'SLA Prioritario', hint: 'Atención preferente y canal dedicado' },
}

export function PlatformFinanceCenter({
  expenses,
  summary,
  today,
  unavailableReason,
  plans = [],
}: {
  expenses: PlatformExpense[]
  summary: FinanceSummary
  today: string
  unavailableReason: string | null
  plans?: PlatformPlanMetric[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState | null>(null)
  const [toDelete, setToDelete] = useState<PlatformExpense | null>(null)

  // Tabs y Filtro de plan activo para análisis
  const [activeTab, setActiveTab] = useState<'gastos' | 'planes' | 'herramientas'>('gastos')
  const [selectedPlanTier, setSelectedPlanTier] = useState<string>('all')

  // Filtros del catálogo de herramientas
  const [toolSearch, setToolSearch] = useState('')
  const [toolGroupFilter, setToolGroupFilter] = useState<PlanFeatureGroup | 'all'>('all')
  const [toolInclusionFilter, setToolInclusionFilter] = useState<'all' | 'included' | 'excluded'>('all')

  const activePlansList = useMemo(() => (plans && plans.length > 0 ? plans : DEFAULT_PLATFORM_PLANS), [plans])

  const selectedPlan = useMemo(
    () => activePlansList.find((p) => p.tier.toLowerCase() === selectedPlanTier.toLowerCase()) ?? null,
    [activePlansList, selectedPlanTier],
  )

  // El último tipo de cambio cargado sirve de sugerencia para el próximo gasto en dólares.
  const lastUsdRate = useMemo(() => expenses.find((e) => e.currency === 'USD')?.fxRatePyg, [expenses])

  const emptyForm = (): FormState => ({
    id: null,
    provider: '',
    category: 'infraestructura',
    description: '',
    amount: '',
    currency: 'USD',
    fxRatePyg: lastUsdRate ? String(lastUsdRate) : '',
    recurrence: 'monthly',
    startsOn: today,
    endsOn: '',
    isActive: true,
  })

  const editForm = (expense: PlatformExpense): FormState => ({
    id: expense.id,
    provider: expense.provider,
    category: expense.category,
    description: expense.description ?? '',
    amount: String(expense.amount),
    currency: expense.currency,
    fxRatePyg: String(expense.fxRatePyg),
    recurrence: expense.recurrence,
    startsOn: expense.startsOn,
    endsOn: expense.endsOn ?? '',
    isActive: expense.isActive,
  })

  const save = () => {
    if (!form) return
    const payload = {
      provider: form.provider,
      category: form.category,
      description: form.description.trim() || null,
      amount: Number(form.amount),
      currency: form.currency,
      fxRatePyg: form.currency === 'PYG' ? 1 : Number(form.fxRatePyg),
      recurrence: form.recurrence,
      startsOn: form.startsOn,
      endsOn: form.endsOn || null,
      isActive: form.isActive,
    }
    if (form.amount.trim() === '' || !Number.isFinite(payload.amount)) {
      toast.error('Indicá el monto')
      return
    }
    if (form.currency === 'USD' && !(payload.fxRatePyg > 0)) {
      toast.error('Indicá el tipo de cambio (guaraníes por dólar)')
      return
    }
    startTransition(async () => {
      const result = form.id ? await updateExpenseAction(form.id, payload) : await createExpenseAction(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(form.id ? 'Gasto actualizado' : 'Gasto registrado')
      setForm(null)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!toDelete) return
    const id = toDelete.id
    startTransition(async () => {
      const result = await deleteExpenseAction(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Gasto eliminado')
      setToDelete(null)
      router.refresh()
    })
  }

  const previewPyg = form && form.amount ? Number(form.amount) * (form.currency === 'PYG' ? 1 : Number(form.fxRatePyg) || 0) : 0

  // Filtrado de herramientas
  const filteredTools = useMemo(() => {
    return PLAN_FEATURES.filter((tool) => {
      if (toolGroupFilter !== 'all' && tool.group !== toolGroupFilter) return false

      if (selectedPlan && toolInclusionFilter !== 'all') {
        const isIncluded = selectedPlan.includedFeatureKeys.includes(tool.key)
        if (toolInclusionFilter === 'included' && !isIncluded) return false
        if (toolInclusionFilter === 'excluded' && isIncluded) return false
      }

      if (toolSearch.trim()) {
        const query = toolSearch.toLowerCase().trim()
        const label = tool.label.toLowerCase()
        const hint = tool.hint.toLowerCase()
        const module = (tool.module ?? '').toLowerCase()
        const infra = (FEATURE_INFRASTRUCTURE[tool.key]?.service ?? '').toLowerCase()
        if (!label.includes(query) && !hint.includes(query) && !module.includes(query) && !infra.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [toolSearch, toolGroupFilter, toolInclusionFilter, selectedPlan])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Gastos"
        description={
          <>
            Lo que cuesta operar la plataforma, en guaraníes; los gastos en dólares usan el tipo de cambio guardado en cada uno.
            El resultado y el margen frente al MRR están en{' '}
            <Link href="/superadmin/billing" className="font-medium text-primary hover:underline">Resumen</Link>.
          </>
        }
        actions={
          <Button onClick={() => setForm(emptyForm())} disabled={Boolean(unavailableReason)}>
            <Plus className="h-4 w-4" /> Registrar gasto
          </Button>
        }
      />

      {unavailableReason && <Notice tone="warning">{unavailableReason}</Notice>}

      {/* Selector de Plan Activo para Inspección */}
      <Card className="rounded-xl border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inspección de Plan</p>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPlan ? `Analizando: ${selectedPlan.name}` : 'Todos los planes de suscripción'}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Select value={selectedPlanTier} onValueChange={(val) => setSelectedPlanTier(val)}>
                <SelectTrigger className="w-[260px] bg-white text-xs dark:bg-slate-950" aria-label="Seleccionar plan">
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes (Panorama general)</SelectItem>
                  {activePlansList.map((p) => (
                    <SelectItem key={p.id} value={p.tier}>
                      {p.name} ({p.price > 0 ? gs(p.price) + '/mes' : 'Gratis'}) · {p.activeCount} activas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPlanTier !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400"
                  onClick={() => {
                    setSelectedPlanTier('all')
                    setToolInclusionFilter('all')
                  }}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Ver todos
                </Button>
              )}
            </div>
          </div>

          {/* Tarjeta de Resumen del Plan Seleccionado */}
          {selectedPlan && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-background/95 p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-500">Plan</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{selectedPlan.name}</span>
                    <Badge variant="outline" className={cn('text-[10px] uppercase font-semibold', tierBadge[selectedPlan.tier] ?? '')}>
                      {selectedPlan.tier}
                    </Badge>
                  </div>
                  {selectedPlan.isPopular && (
                    <Badge variant="secondary" className="mt-1 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      ★ Popular
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-xs text-slate-500">Precio mensual</p>
                  <p className="mt-1 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {selectedPlan.price > 0 ? gs(selectedPlan.price) : 'Gratis'}
                  </p>
                  <p className="text-[11px] text-slate-500">por tienda / mes</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Tiendas activas</p>
                  <p className="mt-1 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {selectedPlan.activeCount} <span className="text-xs font-normal text-slate-500">de {selectedPlan.subscribersCount}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">tiendas suscritas</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Ingreso estimado</p>
                  <p className="mt-1 font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {gs(selectedPlan.monthlyRevenue)}
                  </p>
                  <p className="text-[11px] text-slate-500">generado por este plan</p>
                </div>

                <div className="col-span-2 sm:col-span-4 lg:col-span-1">
                  <p className="text-xs text-slate-500">Herramientas activas</p>
                  <p className="mt-1 font-bold tabular-nums text-primary">
                    {selectedPlan.includedFeaturesCount} <span className="text-xs font-normal text-slate-500">/ {PLAN_FEATURES.length}</span>
                  </p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-primary underline hover:text-primary/80"
                    onClick={() => {
                      setActiveTab('herramientas')
                      setToolInclusionFilter('included')
                    }}
                  >
                    Ver herramientas incluidas &rarr;
                  </Button>
                </div>
              </div>

              {/* Métricas de Amortización Unit Economics */}
              {summary.recurringMonthlyCost > 0 && selectedPlan.price > 0 && (
                <div className="mt-3.5 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Cobertura operativa unitaria:
                      </span>{' '}
                      Se requieren{' '}
                      <span className="font-bold text-primary">
                        {Math.ceil(summary.recurringMonthlyCost / selectedPlan.price)} tiendas
                      </span>{' '}
                      en el plan <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPlan.name}</span> para amortizar el 100% del costo recurrente de la plataforma ({gs(summary.recurringMonthlyCost)}).
                    </div>
                    <div>
                      {selectedPlan.activeCount >= Math.ceil(summary.recurringMonthlyCost / selectedPlan.price) ? (
                        <Badge className="bg-emerald-600 text-white">✓ 100% Amortizado por este plan</Badge>
                      ) : (
                        <span className="font-medium text-slate-500">
                          Aporta el{' '}
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {Math.round((selectedPlan.monthlyRevenue / summary.recurringMonthlyCost) * 100)}%
                          </span>{' '}
                          de la cobertura actual
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navegación por Pestañas */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="gastos" className="text-xs sm:text-sm">
            Gastos y Rentabilidad
          </TabsTrigger>
          <TabsTrigger value="planes" className="text-xs sm:text-sm">
            Planes y Cobertura ({activePlansList.length})
          </TabsTrigger>
          <TabsTrigger value="herramientas" className="text-xs sm:text-sm">
            Herramientas ({PLAN_FEATURES.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: GASTOS Y RENTABILIDAD ─────────────────────────────────────────── */}
        <TabsContent value="gastos" className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Costo mensual" value={gs(summary.recurringMonthlyCost)} hint="Recurrente; los anuales divididos en 12" />
            <Kpi
              label="Gastos únicos del mes"
              value={gs(summary.oneTimeThisMonth)}
              hint="Solo pesan en el mes en que ocurren"
            />
            <Kpi
              label="Costo por tienda paga"
              value={summary.costPerPayingOrg === null ? '—' : gs(summary.costPerPayingOrg)}
              hint={summary.revenuePerPayingOrg === null ? 'Sin tiendas pagas' : `Ingreso promedio ${gs(summary.revenuePerPayingOrg)}`}
            />
            <Kpi
              label="Punto de equilibrio"
              value={summary.breakEvenOrgs === null ? '—' : `${summary.breakEvenOrgs} tiendas`}
              hint={
                summary.breakEvenOrgs === null
                  ? 'Hace falta al menos una tienda paga'
                  : summary.payingOrgs >= summary.breakEvenOrgs
                    ? `Cubierto: tenés ${summary.payingOrgs}`
                    : `Faltan ${summary.breakEvenOrgs - summary.payingOrgs} tiendas pagas`
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown
              title="Por categoría"
              rows={summary.byCategory.map((row) => ({ key: row.category, label: EXPENSE_CATEGORY_LABEL[row.category], monthly: row.monthly, sharePercent: row.sharePercent }))}
            />
            <Breakdown
              title="Por proveedor"
              rows={summary.byProvider.map((row) => ({ key: row.provider, label: row.provider, monthly: row.monthly, sharePercent: row.sharePercent }))}
            />
          </div>

          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4" /> Gastos registrados
              </CardTitle>
              <CardDescription>{expenses.length} en total. Pausá un gasto en vez de borrarlo si querés conservar el historial.</CardDescription>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                  Todavía no hay gastos. Empezá por los fijos: hosting (Vercel), base de datos (Supabase), dominio y email.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-semibold">Proveedor</th>
                        <th className="py-2 pr-3 font-semibold">Frecuencia</th>
                        <th className="py-2 pr-3 text-right font-semibold">Monto</th>
                        <th className="py-2 pr-3 text-right font-semibold">Por mes</th>
                        <th className="py-2 pr-3 font-semibold">Estado</th>
                        <th className="py-2 text-right font-semibold"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense) => {
                        const status = expenseStatus(expense, today)
                        const monthly = monthlyRecurringPyg(expense, today)
                        return (
                          <tr key={expense.id} className="border-b last:border-0 dark:border-slate-800">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{expense.provider}</div>
                              <div className="text-xs text-slate-500">
                                {EXPENSE_CATEGORY_LABEL[expense.category]}
                                {expense.description ? ` · ${expense.description}` : ''}
                              </div>
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{RECURRENCE_LABEL[expense.recurrence]}</td>
                            <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                              {formatCurrency(expense.amount, { currency: expense.currency })}
                              {expense.currency !== 'PYG' && (
                                <div className="text-xs text-slate-500">{gs(expenseToPyg(expense))}</div>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{monthly > 0 ? gs(monthly) : '—'}</td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className={cn('font-medium', status.tone)}>{status.label}</Badge>
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              <Button variant="ghost" size="icon" aria-label={`Editar ${expense.provider}`} onClick={() => setForm(editForm(expense))}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label={`Eliminar ${expense.provider}`} onClick={() => setToDelete(expense)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: PLANES Y COBERTURA FINANCIERA ──────────────────────────────────── */}
        <TabsContent value="planes" className="space-y-6 pt-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Planes Comerciales y Cobertura Operativa
              </h3>
              <p className="text-xs text-slate-500">
                Compará el volumen de suscriptores, ingresos generados y amortización de infraestructura por cada plan.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {activePlansList.map((plan) => {
              const TierIcon = tierIcons[plan.tier.toLowerCase()] ?? Package
              const accentGradient = tierAccent[plan.tier.toLowerCase()] ?? 'from-slate-400 to-slate-500'
              const isSelected = selectedPlanTier.toLowerCase() === plan.tier.toLowerCase()
              const coveragePercent =
                summary.recurringMonthlyCost > 0 ? Math.round((plan.monthlyRevenue / summary.recurringMonthlyCost) * 100) : 0
              const breakEvenStores =
                plan.price > 0 && summary.recurringMonthlyCost > 0
                  ? Math.ceil(summary.recurringMonthlyCost / plan.price)
                  : null

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    'relative flex flex-col overflow-hidden rounded-xl border transition-all',
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
                  )}
                >
                  <div className={cn('h-1.5 w-full bg-gradient-to-r', accentGradient)} />
                  <CardHeader className="pb-3 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <TierIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{plan.name}</CardTitle>
                          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                            {plan.tier}
                          </span>
                        </div>
                      </div>
                      {plan.isPopular && (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px]">
                          Popular
                        </Badge>
                      )}
                    </div>
                    {plan.description && (
                      <CardDescription className="line-clamp-2 text-xs pt-1">
                        {plan.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-between space-y-4 pb-4">
                    <div className="space-y-3">
                      <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900/60">
                        <p className="text-[11px] text-slate-500">Precio mensual</p>
                        <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {plan.price > 0 ? gs(plan.price) : 'Gratis'}
                        </p>
                        <p className="text-[10px] text-slate-400">por tienda / mes</p>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Tiendas activas:</span>
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {plan.activeCount} <span className="font-normal text-slate-400">({plan.subscribersCount} tot.)</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Ingreso del plan:</span>
                          <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                            {gs(plan.monthlyRevenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Herramientas:</span>
                          <span className="font-semibold text-primary">
                            {plan.includedFeaturesCount} de {PLAN_FEATURES.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Cobertura de costos:</span>
                          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                            {coveragePercent}%
                          </span>
                        </div>
                        {breakEvenStores && (
                          <div className="flex items-center justify-between border-t border-dashed pt-1.5 text-[11px] text-slate-500">
                            <span>Equilibrio individual:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {breakEvenStores} tiendas
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      {isSelected ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs font-semibold"
                          onClick={() => {
                            setActiveTab('herramientas')
                          }}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5 text-primary" /> Inspeccionando (Ver herramientas)
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            setSelectedPlanTier(plan.tier)
                            toast.success(`Plan ${plan.name} seleccionado para inspección`)
                          }}
                        >
                          Seleccionar plan
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── TAB 3: CATÁLOGO DE HERRAMIENTAS Y MÓDULOS ─────────────────────────────── */}
        <TabsContent value="herramientas" className="space-y-6 pt-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Herramientas del Sistema y Módulos Técnicos
              </h3>
              <p className="text-xs text-slate-500">
                Catálogo unificado ({PLAN_FEATURES.length} herramientas): funcionalidad, grupo, descripción operativa e infraestructura asociada.
              </p>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar herramienta..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>

              {selectedPlan && (
                <Select
                  value={toolInclusionFilter}
                  onValueChange={(val) => setToolInclusionFilter(val as any)}
                >
                  <SelectTrigger className="h-9 w-44 text-xs">
                    <SelectValue placeholder="Inclusión en plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas ({PLAN_FEATURES.length})</SelectItem>
                    <SelectItem value="included">Solo en {selectedPlan.name}</SelectItem>
                    <SelectItem value="excluded">Bloqueadas en {selectedPlan.name}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Filtros por Grupo */}
          <div className="flex flex-wrap gap-1.5 border-b pb-3">
            <Button
              variant={toolGroupFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setToolGroupFilter('all')}
            >
              Todas las áreas ({PLAN_FEATURES.length})
            </Button>
            {(['venta', 'operacion', 'gestion', 'servicio'] as PlanFeatureGroup[]).map((group) => {
              const count = PLAN_FEATURES.filter((f) => f.group === group).length
              return (
                <Button
                  key={group}
                  variant={toolGroupFilter === group ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setToolGroupFilter(group)}
                >
                  {PLAN_FEATURE_GROUP_LABEL[group]} ({count})
                </Button>
              )
            })}
          </div>

          {/* Grid de Herramientas */}
          {filteredTools.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
              No se encontraron herramientas con los filtros actuales.
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTools.map((tool) => {
                const IconComponent = PLAN_FEATURE_ICONS[tool.key] ?? Info
                const infra = FEATURE_INFRASTRUCTURE[tool.key]
                const isIncludedInSelected = selectedPlan ? selectedPlan.includedFeatureKeys.includes(tool.key) : null

                // Planes que incluyen esta herramienta
                const includingPlans = activePlansList.filter((p) => p.includedFeatureKeys.includes(tool.key))

                return (
                  <Card
                    key={tool.key}
                    className={cn(
                      'flex flex-col justify-between rounded-xl border p-4 transition-all',
                      selectedPlan && isIncludedInSelected
                        ? 'border-emerald-200/90 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                        : selectedPlan && !isIncludedInSelected
                          ? 'opacity-70 border-slate-200 bg-slate-50/30 dark:border-slate-800'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800',
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {tool.label}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">
                              key: {tool.key}
                            </span>
                          </div>
                        </div>

                        <Badge variant="outline" className={cn('text-[10px] uppercase font-semibold shrink-0', groupBadge[tool.group])}>
                          {tool.group}
                        </Badge>
                      </div>

                      <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {tool.hint}
                      </p>

                      {/* Información técnica y de Infraestructura */}
                      <div className="mt-3 space-y-1.5 rounded-md bg-slate-50 p-2 text-[11px] dark:bg-slate-900/60">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Módulo de control:</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {tool.module ? tool.module : 'Límites / Servicio'}
                          </span>
                        </div>
                        {infra && (
                          <div className="flex items-center justify-between text-slate-500">
                            <span>Infraestructura:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[170px]" title={`${infra.service}: ${infra.hint}`}>
                              {infra.service}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Disponibilidad en Planes */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      {selectedPlan ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">En {selectedPlan.name}:</span>
                          {isIncludedInSelected ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] border-emerald-200">
                              <Check className="mr-1 h-3 w-3" /> Incluido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 bg-slate-50 text-[10px]">
                              <X className="mr-1 h-3 w-3" /> Bloqueado
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Disponible en:</span>
                          <div className="flex items-center gap-1">
                            {includingPlans.map((p) => (
                              <span
                                key={p.id}
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                                  tierBadge[p.tier] ?? 'bg-slate-100 text-slate-700',
                                )}
                                title={`Incluido en plan ${p.name}`}
                              >
                                {p.name.slice(0, 3)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet para Registrar / Editar Gasto */}
      <Sheet open={form !== null} onOpenChange={(open) => !open && !pending && setForm(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {form && (
            <>
              <SheetHeader>
                <SheetTitle>{form.id ? 'Editar gasto' : 'Registrar gasto'}</SheetTitle>
                <SheetDescription>Un gasto anual se reparte en 12 meses; uno único pesa solo en el mes en que ocurrió.</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-provider">Proveedor</Label>
                  <Input id="expense-provider" value={form.provider} maxLength={80} placeholder="Vercel, Supabase, dominio..." onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Categoría</Label>
                    <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value as ExpenseCategory })}>
                      <SelectTrigger aria-label="Categoría"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>{EXPENSE_CATEGORY_LABEL[category]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frecuencia</Label>
                    <Select value={form.recurrence} onValueChange={(value) => setForm({ ...form, recurrence: value as ExpenseRecurrence })}>
                      <SelectTrigger aria-label="Frecuencia"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_RECURRENCES.map((recurrence) => (
                          <SelectItem key={recurrence} value={recurrence}>{RECURRENCE_LABEL[recurrence]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-amount">Monto</Label>
                    <Input id="expense-amount" type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Moneda</Label>
                    <Select value={form.currency} onValueChange={(value) => setForm({ ...form, currency: value as ExpenseCurrency })}>
                      <SelectTrigger aria-label="Moneda"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="PYG">Gs.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.currency === 'USD' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-fx">Tipo de cambio (Gs. por dólar)</Label>
                    <Input id="expense-fx" type="number" inputMode="decimal" min={0} step="1" value={form.fxRatePyg} onChange={(e) => setForm({ ...form, fxRatePyg: e.target.value })} />
                  </div>
                )}

                {previewPyg > 0 && (
                  <p className="text-xs text-slate-500">
                    Equivale a {gs(previewPyg)}
                    {form.recurrence === 'yearly' ? ` por año (${gs(previewPyg / 12)} por mes)` : form.recurrence === 'monthly' ? ' por mes' : ''}.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-start">{form.recurrence === 'one_time' ? 'Fecha' : 'Desde'}</Label>
                    <Input id="expense-start" type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
                  </div>
                  {form.recurrence !== 'one_time' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="expense-end">Hasta (opcional)</Label>
                      <Input id="expense-end" type="date" min={form.startsOn} value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-description">Nota (opcional)</Label>
                  <Textarea id="expense-description" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="expense-active" className="cursor-pointer">
                    <span className="block text-sm font-medium">Activo</span>
                    <span className="block text-xs font-normal text-slate-500">Un gasto pausado no suma al costo.</span>
                  </Label>
                  <Switch id="expense-active" checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                </div>
              </div>

              <SheetFooter className="px-4 pb-4">
                <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>Cancelar</Button>
                <Button onClick={save} disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !pending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `Se borra "${toDelete.provider}" y deja de contar en los cálculos. Si solo dejó de aplicar, mejor pausalo o poné una fecha de fin.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
