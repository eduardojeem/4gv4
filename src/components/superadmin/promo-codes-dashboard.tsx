'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  BadgePercent,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Filter,
  Gift,
  History,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  TicketPercent,
  Trash2,
  TrendingUp,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export type PromoCode = {
  id: string
  code: string
  name: string
  description: string | null
  benefit_type: string
  discount_percent: number | null
  discount_amount: number | null
  target_plan: string | null
  duration_days: number | null
  duration_unit: string | null
  max_redemptions: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  redemption_count: number
}

type Organization = { id: string; name: string; slug: string; plan: string }
type Plan = { tier: string; name: string }

export const benefitLabels: Record<string, string> = {
  discount_percent: 'Descuento porcentual (%)',
  discount_fixed: 'Descuento fijo (Gs.)',
  activate_plan: 'Activación de plan',
  extend_trial: 'Extensión de prueba',
  extend_period: 'Extensión de suscripción',
}

export type Redemption = {
  id: string
  promo_code_id: string
  organization_id: string
  organization_name: string
  redeemed_at: string
}

export function codeStatus(code: PromoCode): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  tone: 'active' | 'inactive' | 'expired' | 'exhausted' | 'scheduled'
} {
  const now = Date.now()
  if (!code.is_active) return { label: 'Inactivo', variant: 'secondary', tone: 'inactive' }
  if (code.expires_at && new Date(code.expires_at).getTime() < now) {
    return { label: 'Vencido', variant: 'destructive', tone: 'expired' }
  }
  if (code.max_redemptions && code.redemption_count >= code.max_redemptions) {
    return { label: 'Agotado', variant: 'destructive', tone: 'exhausted' }
  }
  if (code.starts_at && new Date(code.starts_at).getTime() > now) {
    return { label: 'Programado', variant: 'outline', tone: 'scheduled' }
  }
  return { label: 'Vigente', variant: 'default', tone: 'active' }
}

export function benefitSummary(code: {
  benefit_type: string
  discount_percent?: number | null
  discount_amount?: number | null
  target_plan?: string | null
  duration_days?: number | null
  duration_unit?: string | null
}) {
  if (code.benefit_type === 'discount_percent') return `${code.discount_percent ?? 0}% de descuento`
  if (code.benefit_type === 'discount_fixed') {
    return `${Number(code.discount_amount ?? 0).toLocaleString('es-PY')} Gs. de descuento`
  }
  const unit = code.duration_unit === 'months' ? 'mes(es)' : 'días'
  if (code.benefit_type === 'activate_plan') {
    return `Plan ${code.target_plan ?? 'PRO'} por ${code.duration_days ?? 30} ${unit}`
  }
  if (code.benefit_type === 'extend_trial') {
    return `Prueba extendida por ${code.duration_days ?? 15} ${unit}`
  }
  return `${code.duration_days ?? 30} ${unit} adicionales`
}

function generateRandomCode(prefix = 'PROMO') {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let randomPart = ''
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix.trim().toUpperCase()}-${year}-${randomPart}`
}

export function PromoCodesDashboard() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'catalog' | 'redemptions'>('catalog')

  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired' | 'exhausted'>('all')
  const [benefitFilter, setBenefitFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'redemptions' | 'expiring' | 'alphabetical'>('recent')

  // Filtro de canjes globales
  const [redemptionSearch, setRedemptionSearch] = useState('')

  // Modales
  const [createOpen, setCreateOpen] = useState(false)
  const [editCode, setEditCode] = useState<PromoCode | null>(null)
  const [detailCode, setDetailCode] = useState<PromoCode | null>(null)
  const [applyCode, setApplyCode] = useState<PromoCode | null>(null)
  const [deleteCode, setDeleteCode] = useState<PromoCode | null>(null)

  // Estado para copiar feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Búsqueda de organización en modal de aplicación
  const [orgSearch, setOrgSearch] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')

  // Formulario de creación
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    benefitType: 'discount_percent',
    discountPercent: '',
    discountAmount: '',
    targetPlan: '',
    durationDays: '',
    durationUnit: 'days',
    maxRedemptions: '',
    expiresAt: '',
    startsAt: '',
  })

  // Formulario de edición
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    maxRedemptions: '',
    expiresAt: '',
    isActive: true,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/superadmin/promo-codes')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setCodes(data.codes ?? [])
      setRedemptions(data.redemptions ?? [])
      setOrganizations(data.organizations ?? [])
      setPlans(data.plans ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las promociones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // KPIs
  const stats = useMemo(() => {
    const active = codes.filter((c) => codeStatus(c).tone === 'active').length
    const totalRedemptions = codes.reduce((sum, c) => sum + c.redemption_count, 0)
    const uniqueBenefitedOrgs = new Set(redemptions.map((r) => r.organization_id)).size
    const expiring = codes.filter((c) => {
      if (!c.expires_at || !c.is_active) return false
      const exp = new Date(c.expires_at).getTime()
      const now = Date.now()
      return exp > now && exp < now + 7 * 86_400_000
    }).length

    return {
      active,
      totalCodes: codes.length,
      totalRedemptions,
      uniqueBenefitedOrgs,
      expiring,
    }
  }, [codes, redemptions])

  // Filtrado y ordenación
  const filteredCodes = useMemo(() => {
    let list = [...codes]

    // Búsqueda por texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          (c.target_plan && c.target_plan.toLowerCase().includes(q))
      )
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      list = list.filter((c) => {
        const s = codeStatus(c).tone
        if (statusFilter === 'active') return s === 'active'
        if (statusFilter === 'inactive') return s === 'inactive'
        if (statusFilter === 'expired') return s === 'expired'
        if (statusFilter === 'exhausted') return s === 'exhausted'
        return true
      })
    }

    // Filtro por tipo de beneficio
    if (benefitFilter !== 'all') {
      list = list.filter((c) => c.benefit_type === benefitFilter)
    }

    // Ordenamiento
    list.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'redemptions') {
        return b.redemption_count - a.redemption_count
      }
      if (sortBy === 'expiring') {
        const aExp = a.expires_at ? new Date(a.expires_at).getTime() : Infinity
        const bExp = b.expires_at ? new Date(b.expires_at).getTime() : Infinity
        return aExp - bExp
      }
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name)
      }
      return 0
    })

    return list
  }, [codes, searchQuery, statusFilter, benefitFilter, sortBy])

  // Filtrado de canjes globales
  const filteredRedemptions = useMemo(() => {
    if (!redemptionSearch.trim()) return redemptions
    const q = redemptionSearch.toLowerCase().trim()
    return redemptions.filter((r) => {
      const codeItem = codes.find((c) => c.id === r.promo_code_id)
      return (
        r.organization_name.toLowerCase().includes(q) ||
        (codeItem && codeItem.code.toLowerCase().includes(q)) ||
        (codeItem && codeItem.name.toLowerCase().includes(q))
      )
    })
  }, [redemptions, redemptionSearch, codes])

  // Organizaciones filtradas en modal de aplicación
  const filteredOrganizations = useMemo(() => {
    if (!orgSearch.trim()) return organizations
    const q = orgSearch.toLowerCase().trim()
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.slug.toLowerCase().includes(q) ||
        org.plan.toLowerCase().includes(q)
    )
  }, [organizations, orgSearch])

  // Copiar código con feedback
  const handleCopyCode = async (codeStr: string, id: string) => {
    try {
      await navigator.clipboard.writeText(codeStr)
      setCopiedId(id)
      toast.success(`Código ${codeStr} copiado al portapapeles.`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      toast.error('No se pudo copiar el código.')
    }
  }

  // Exportar catálogo a CSV
  const handleExportCSV = () => {
    if (codes.length === 0) {
      toast.info('No hay códigos para exportar.')
      return
    }

    const headers = [
      'Código',
      'Nombre',
      'Tipo de Beneficio',
      'Detalle del Beneficio',
      'Estado',
      'Canjes Realizados',
      'Límite de Canjes',
      'Expira en',
      'Fecha Creación',
    ]

    const rows = codes.map((c) => [
      c.code,
      `"${c.name.replace(/"/g, '""')}"`,
      benefitLabels[c.benefit_type] || c.benefit_type,
      `"${benefitSummary(c).replace(/"/g, '""')}"`,
      codeStatus(c).label,
      c.redemption_count,
      c.max_redemptions ?? 'Ilimitado',
      c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-PY') : 'Sin expiración',
      new Date(c.created_at).toLocaleDateString('es-PY'),
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `codigos_promocionales_4g_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Reporte CSV descargado con éxito.')
  }

  // Crear código
  async function createCode() {
    if (!form.code.trim()) return toast.error('El código es obligatorio.')
    if (!form.name.trim()) return toast.error('El nombre descriptivo es obligatorio.')

    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
          discountAmount: form.discountAmount ? Number(form.discountAmount) : null,
          targetPlan: form.targetPlan || null,
          durationDays: form.durationDays ? Number(form.durationDays) : null,
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success(`Código ${data.code.code} creado exitosamente.`)
      setCreateOpen(false)
      setForm({
        code: '',
        name: '',
        description: '',
        benefitType: 'discount_percent',
        discountPercent: '',
        discountAmount: '',
        targetPlan: '',
        durationDays: '',
        durationUnit: 'days',
        maxRedemptions: '',
        expiresAt: '',
        startsAt: '',
      })
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el código.')
    } finally {
      setSaving(false)
    }
  }

  // Abrir modal de edición
  const openEditModal = (code: PromoCode) => {
    setEditCode(code)
    setEditForm({
      name: code.name,
      description: code.description || '',
      maxRedemptions: code.max_redemptions ? String(code.max_redemptions) : '',
      expiresAt: code.expires_at ? new Date(code.expires_at).toISOString().slice(0, 16) : '',
      isActive: code.is_active,
    })
  }

  // Guardar edición
  async function handleSaveEdit() {
    if (!editCode) return
    if (!editForm.name.trim()) return toast.error('El nombre es obligatorio.')

    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/promo-codes/${editCode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          maxRedemptions: editForm.maxRedemptions ? Number(editForm.maxRedemptions) : null,
          expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
          isActive: editForm.isActive,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Promoción actualizada correctamente.')
      setEditCode(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la promoción.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle rápido de estado activo/inactivo
  async function toggleCode(code: PromoCode) {
    try {
      const response = await fetch(`/api/superadmin/promo-codes/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !code.is_active }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setCodes((current) =>
        current.map((item) => (item.id === code.id ? { ...item, is_active: data.code.is_active } : item))
      )
      toast.success(data.code.is_active ? `Código ${code.code} activado.` : `Código ${code.code} pausado.`)
    } catch (err: any) {
      toast.error(err.message || 'No se pudo cambiar el estado del código.')
    }
  }

  // Eliminar código
  async function handleDeleteCode() {
    if (!deleteCode) return
    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/promo-codes/${deleteCode.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success(`Código ${deleteCode.code} eliminado.`)
      setDeleteCode(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el código.')
    } finally {
      setSaving(false)
    }
  }

  // Aplicar promoción a organización
  async function applyPromotion() {
    if (!applyCode || !selectedOrgId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/promo-codes/${applyCode.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrgId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const targetOrg = organizations.find((o) => o.id === selectedOrgId)
      toast.success(
        data.requiresBillingAction
          ? `Descuento asignado para facturación a "${targetOrg?.name || 'Organización'}".`
          : `Promoción aplicada con éxito a "${targetOrg?.name || 'Organización'}".`
      )
      setApplyCode(null)
      setSelectedOrgId('')
      setOrgSearch('')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar la promoción.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner Ejecutivo */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-indigo-400/30 bg-indigo-500/20 text-indigo-200 font-medium backdrop-blur-sm">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                SuperAdmin SaaS · Motor de Promociones
              </Badge>
              <Badge variant="outline" className="border-white/20 text-slate-300 text-xs font-normal">
                {codes.length} {codes.length === 1 ? 'código registrado' : 'códigos registrados'}
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Gestor de Códigos Promocionales
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              Crea cupones de descuento, activaciones de planes prémium y extensiones de períodos
              para organizaciones cliente con control estricto de cupos y trazabilidad por canje.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || codes.length === 0}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 shadow-sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 shadow-sm"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>
            <Button
              onClick={() => {
                setForm({
                  code: generateRandomCode('PROMO'),
                  name: '',
                  description: '',
                  benefitType: 'discount_percent',
                  discountPercent: '20',
                  discountAmount: '',
                  targetPlan: plans[0]?.tier || 'PRO',
                  durationDays: '30',
                  durationUnit: 'days',
                  maxRedemptions: '10',
                  expiresAt: '',
                  startsAt: '',
                })
                setCreateOpen(true)
              }}
              className="bg-white font-semibold text-slate-950 hover:bg-indigo-50 shadow-md transition-all"
            >
              <Plus className="mr-2 h-4 w-4 text-indigo-600" />
              Nueva Promoción
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <CardContent className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Códigos Vigentes
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {stats.active}
                </span>
                <span className="text-xs text-muted-foreground">de {stats.totalCodes}</span>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <CardContent className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Canjes Totales
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {stats.totalRedemptions}
                </span>
                <span className="text-xs text-muted-foreground">usos</span>
              </div>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-400">
              <TicketPercent className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <CardContent className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Empresas Beneficiadas
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {stats.uniqueBenefitedOrgs}
                </span>
                <span className="text-xs text-muted-foreground">organizaciones</span>
              </div>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-600 dark:text-violet-400">
              <Building2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <CardContent className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vencen Próximamente
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    'text-2xl sm:text-3xl font-bold tracking-tight',
                    stats.expiring > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                  )}
                >
                  {stats.expiring}
                </span>
                <span className="text-xs text-muted-foreground">en 7 días</span>
              </div>
            </div>
            <div
              className={cn(
                'rounded-xl p-2.5',
                stats.expiring > 0
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              <CalendarClock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principales: Catálogo vs Historial Global */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'catalog' | 'redemptions')}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
          <TabsList className="bg-muted/70 p-1">
            <TabsTrigger value="catalog" className="gap-2 text-xs sm:text-sm font-medium">
              <TicketPercent className="h-4 w-4" />
              Catálogo de Promociones ({filteredCodes.length})
            </TabsTrigger>
            <TabsTrigger value="redemptions" className="gap-2 text-xs sm:text-sm font-medium">
              <History className="h-4 w-4" />
              Historial de Canjes ({redemptions.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: CATÁLOGO DE PROMOCIONES */}
        <TabsContent value="catalog" className="space-y-4 m-0">
          {/* Barra de Filtros y Búsqueda */}
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Buscador de texto */}
              <div className="relative flex-1 min-w-0 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, nombre o plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filtros Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro de Estado */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="active">Solo Vigentes</SelectItem>
                    <SelectItem value="inactive">Inactivos / Pausados</SelectItem>
                    <SelectItem value="expired">Vencidos</SelectItem>
                    <SelectItem value="exhausted">Agotados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro de Beneficio */}
                <Select value={benefitFilter} onValueChange={setBenefitFilter}>
                  <SelectTrigger className="h-9 w-44 text-xs">
                    <SelectValue placeholder="Tipo de beneficio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los beneficios</SelectItem>
                    <SelectItem value="discount_percent">Descuento Porcentual</SelectItem>
                    <SelectItem value="discount_fixed">Descuento Fijo</SelectItem>
                    <SelectItem value="activate_plan">Activación de Plan</SelectItem>
                    <SelectItem value="extend_trial">Extensión de Prueba</SelectItem>
                    <SelectItem value="extend_period">Extensión de Período</SelectItem>
                  </SelectContent>
                </Select>

                {/* Ordenamiento */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-9 w-40 text-xs">
                    <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Más recientes</SelectItem>
                    <SelectItem value="redemptions">Más canjeados</SelectItem>
                    <SelectItem value="expiring">Próximos a vencer</SelectItem>
                    <SelectItem value="alphabetical">Alfabético (A-Z)</SelectItem>
                  </SelectContent>
                </Select>

                {(searchQuery || statusFilter !== 'all' || benefitFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setStatusFilter('all')
                      setBenefitFilter('all')
                    }}
                    className="h-9 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Restablecer
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Listado de Códigos */}
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-xs text-muted-foreground">Cargando catálogo promocional...</p>
            </div>
          ) : filteredCodes.length === 0 ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center p-8">
                <div className="rounded-2xl bg-indigo-500/10 p-4 text-indigo-500">
                  <TicketPercent className="h-10 w-10" />
                </div>
                <h2 className="text-base font-semibold text-foreground">No se encontraron promociones</h2>
                <p className="max-w-md text-xs text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || benefitFilter !== 'all'
                    ? 'No hay resultados que coincidan con los filtros aplicados.'
                    : 'Aún no has creado códigos promocionales para la plataforma SaaS.'}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setForm({
                      code: generateRandomCode('PROMO'),
                      name: '',
                      description: '',
                      benefitType: 'discount_percent',
                      discountPercent: '20',
                      discountAmount: '',
                      targetPlan: plans[0]?.tier || 'PRO',
                      durationDays: '30',
                      durationUnit: 'days',
                      maxRedemptions: '10',
                      expiresAt: '',
                      startsAt: '',
                    })
                    setCreateOpen(true)
                  }}
                  className="mt-2"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Crear primera promoción
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredCodes.map((code) => {
                const statusMeta = codeStatus(code)
                const usageRatio = code.max_redemptions
                  ? Math.min(100, Math.round((code.redemption_count / code.max_redemptions) * 100))
                  : null

                return (
                  <Card
                    key={code.id}
                    className={cn(
                      'group rounded-2xl border transition-all duration-200 hover:shadow-md',
                      statusMeta.tone === 'active'
                        ? 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d1117]'
                        : 'border-slate-200/50 bg-slate-50/50 dark:border-white/5 dark:bg-slate-900/20 opacity-85'
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base font-bold text-foreground truncate">
                              {code.name}
                            </CardTitle>
                            <Badge variant={statusMeta.variant} className="text-[10px] font-semibold">
                              {statusMeta.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {code.description || benefitLabels[code.benefit_type]}
                          </p>
                        </div>

                        {/* Switch de activación y menú de acciones */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={code.is_active}
                            onCheckedChange={() => void toggleCode(code)}
                            aria-label={`Alternar estado de ${code.code}`}
                            title={code.is_active ? 'Desactivar código' : 'Activar código'}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem onClick={() => openEditModal(code)}>
                                <Edit3 className="mr-2 h-3.5 w-3.5" />
                                Editar detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDetailCode(code)}>
                                <Building2 className="mr-2 h-3.5 w-3.5" />
                                Ver organizaciones ({code.redemption_count})
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={statusMeta.label !== 'Vigente'}
                                onClick={() => {
                                  setApplyCode(code)
                                  setSelectedOrgId('')
                                  setOrgSearch('')
                                }}
                              >
                                <BadgePercent className="mr-2 h-3.5 w-3.5 text-indigo-600" />
                                Aplicar a organización
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteCode(code)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Eliminar código
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Código con botón de copia destacado */}
                      <div className="flex items-center justify-between rounded-xl border border-indigo-200/60 bg-indigo-50/40 px-3.5 py-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                        <span className="font-mono text-base font-bold tracking-widest text-indigo-950 dark:text-indigo-200">
                          {code.code}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleCopyCode(code.code, code.id)}
                          className="h-8 gap-1.5 px-2.5 text-xs text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                        >
                          {copiedId === code.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                ¡Copiado!
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Detalles en Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <Gift className="h-3 w-3 text-indigo-500" />
                            Beneficio otorgado
                          </p>
                          <p className="mt-1 font-semibold text-foreground truncate">
                            {benefitSummary(code)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3 text-indigo-500" />
                              Cupo de canjes
                            </p>
                            {usageRatio !== null && (
                              <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                {usageRatio}%
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-semibold text-foreground truncate">
                            {code.redemption_count} / {code.max_redemptions ?? 'Ilimitado'}
                          </p>
                          {usageRatio !== null && (
                            <Progress value={usageRatio} className="mt-1.5 h-1" />
                          )}
                        </div>

                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3 text-indigo-500" />
                            Vencimiento
                          </p>
                          <p className="mt-1 font-semibold text-foreground truncate">
                            {code.expires_at
                              ? new Date(code.expires_at).toLocaleDateString('es-PY', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                              : 'Sin vencimiento'}
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="h-3 w-3 text-indigo-500" />
                            Fecha de creación
                          </p>
                          <p className="mt-1 font-semibold text-foreground truncate">
                            {new Date(code.created_at).toLocaleDateString('es-PY', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción inferior */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailCode(code)}
                          className="flex-1 text-xs gap-1.5 h-8.5"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          Ver usos ({code.redemption_count})
                        </Button>
                        <Button
                          size="sm"
                          disabled={statusMeta.label !== 'Vigente'}
                          onClick={() => {
                            setApplyCode(code)
                            setSelectedOrgId('')
                            setOrgSearch('')
                          }}
                          className="flex-1 text-xs gap-1.5 h-8.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                          <BadgePercent className="h-3.5 w-3.5" />
                          Aplicar a Empresa
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: HISTORIAL GLOBAL DE CANJES */}
        <TabsContent value="redemptions" className="space-y-4 m-0">
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 min-w-0 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por organización o código canjeado..."
                  value={redemptionSearch}
                  onChange={(e) => setRedemptionSearch(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredRedemptions.length} {filteredRedemptions.length === 1 ? 'canje registrado' : 'canjes registrados'}
              </span>
            </div>
          </Card>

          {filteredRedemptions.length === 0 ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex min-h-56 flex-col items-center justify-center gap-2 text-center p-8">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">No hay canjes registrados</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {redemptionSearch
                    ? 'No se encontraron canjes que coincidan con la búsqueda.'
                    : 'Aún ninguna organización ha canjeado códigos de promoción.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-3.5">Organización</th>
                      <th className="p-3.5">Código Aplicado</th>
                      <th className="p-3.5">Beneficio Otorgado</th>
                      <th className="p-3.5">Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredRedemptions.map((r) => {
                      const promo = codes.find((c) => c.id === r.promo_code_id)
                      const targetOrg = organizations.find((o) => o.id === r.organization_id)

                      return (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3.5 font-medium">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600 dark:text-indigo-400">
                                <Building2 className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className="font-bold text-foreground">{r.organization_name}</p>
                                {targetOrg && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Plan actual: <strong className="uppercase">{targetOrg.plan}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {promo?.code || 'CÓDIGO'}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-foreground">
                            {promo ? benefitSummary(promo) : 'Beneficio registrado'}
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {new Date(r.redeemed_at).toLocaleString('es-PY', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL: NUEVA PROMOCIÓN */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                <TicketPercent className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Nueva Promoción SaaS</DialogTitle>
                <DialogDescription>
                  Configura un cupón o beneficio exclusivo con control de canjes.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {/* Código con botón generador */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Código Promocional</Label>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, code: generateRandomCode('PROMO') }))}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <Wand2 className="h-3 w-3" />
                  Generar al azar
                </button>
              </div>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PROMO-2026-X7"
                className="font-mono uppercase font-bold tracking-wider"
              />
            </div>

            {/* Nombre descriptivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre de Campaña / Promoción</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Descuento Lanzamiento Verano"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Descripción o Justificación Interna</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Propósito del beneficio, a quién se otorga o condiciones..."
                rows={2}
                className="text-xs"
              />
            </div>

            {/* Tipo de Beneficio */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Tipo de Beneficio</Label>
              <Select
                value={form.benefitType}
                onValueChange={(val) => setForm({ ...form, benefitType: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(benefitLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campos condicionales por beneficio */}
            {form.benefitType === 'discount_percent' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Porcentaje de Descuento (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                    placeholder="Ej. 25"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                </div>
              </div>
            )}

            {form.benefitType === 'discount_fixed' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Monto de Descuento (Gs.)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                  placeholder="Ej. 150000"
                />
              </div>
            )}

            {form.benefitType === 'activate_plan' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Plan a Activar</Label>
                <Select
                  value={form.targetPlan}
                  onValueChange={(val) => setForm({ ...form, targetPlan: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.tier} value={p.tier}>
                        {p.name} ({p.tier.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {['activate_plan', 'extend_trial', 'extend_period'].includes(form.benefitType) && (
              <div className="space-y-2 sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <Label className="text-xs font-semibold">Duración del Beneficio</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    className="flex-1"
                    placeholder={form.durationUnit === 'months' ? 'Cantidad de meses' : 'Cantidad de días'}
                    value={form.durationDays}
                    onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                  />
                  <Select
                    value={form.durationUnit}
                    onValueChange={(val) => setForm({ ...form, durationUnit: val })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Días</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Chips rápidos de duración */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { l: '1 mes', v: '1', u: 'months' },
                    { l: '3 meses', v: '3', u: 'months' },
                    { l: '6 meses', v: '6', u: 'months' },
                    { l: '1 año', v: '12', u: 'months' },
                    { l: '15 días', v: '15', u: 'days' },
                    { l: '30 días', v: '30', u: 'days' },
                  ].map((p) => (
                    <Button
                      key={p.l}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setForm({ ...form, durationDays: p.v, durationUnit: p.u })}
                    >
                      {p.l}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Máximo de redenciones */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Máximo de Canjes Totales</Label>
              <Input
                type="number"
                min="1"
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                placeholder="Vacío = Ilimitado"
              />
            </div>

            {/* Fecha de expiración */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fecha de Expiración</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>

            {/* Vista Previa en Vivo */}
            <div className="sm:col-span-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Vista Previa del Cupón
              </p>
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-mono text-base font-bold text-indigo-950 dark:text-indigo-200">
                    {form.code || 'SIN-CÓDIGO'}
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {form.name || 'Nombre de la promoción'}
                  </p>
                </div>
                <div className="text-xs text-indigo-800 dark:text-indigo-300 font-semibold sm:text-right">
                  {benefitSummary({
                    benefit_type: form.benefitType,
                    discount_percent: Number(form.discountPercent),
                    discount_amount: Number(form.discountAmount),
                    target_plan: form.targetPlan,
                    duration_days: Number(form.durationDays),
                    duration_unit: form.durationUnit,
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void createCode()}
              disabled={saving || !form.code || !form.name}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR PROMOCIÓN */}
      <Dialog open={Boolean(editCode)} onOpenChange={(open) => !open && setEditCode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-indigo-600" />
              Editar {editCode?.code}
            </DialogTitle>
            <DialogDescription>
              Modifica los detalles, cupos y vigencia de esta promoción. El tipo de beneficio no puede alterarse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre Descriptivo</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descripción o Justificación</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Máximo de Canjes</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.maxRedemptions}
                  onChange={(e) => setEditForm({ ...editForm, maxRedemptions: e.target.value })}
                  placeholder="Vacío = Ilimitado"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fecha de Expiración</Label>
                <Input
                  type="datetime-local"
                  value={editForm.expiresAt}
                  onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3 bg-muted/20">
              <div>
                <Label className="text-xs font-semibold cursor-pointer" htmlFor="edit-is-active">
                  Promoción Activa
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Desactívala para pausar temporalmente su aplicación sin borrarla.
                </p>
              </div>
              <Switch
                id="edit-is-active"
                checked={editForm.isActive}
                onCheckedChange={(c) => setEditForm({ ...editForm, isActive: c })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCode(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSaveEdit()}
              disabled={saving || !editForm.name}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: APLICAR PROMOCIÓN A ORGANIZACIÓN (CON BUSCADOR) */}
      <Dialog open={Boolean(applyCode)} onOpenChange={(open) => !open && setApplyCode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                <BadgePercent className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Aplicar {applyCode?.code}</DialogTitle>
                <DialogDescription>
                  {applyCode && benefitSummary(applyCode)}. Esta acción afectará la suscripción de la
                  organización seleccionada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Selecciona la Organización Destino</Label>

            {/* Buscador de Organizaciones */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa por nombre o plan..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>

            {/* Lista seleccionable con scroll */}
            <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 p-1.5 bg-muted/20">
              {filteredOrganizations.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No hay empresas que coincidan con la búsqueda.
                </p>
              ) : (
                filteredOrganizations.map((org) => {
                  const isSelected = selectedOrgId === org.id
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => setSelectedOrgId(org.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors',
                        isSelected
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'hover:bg-muted/80 text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{org.name}</span>
                      </div>
                      <Badge
                        variant={isSelected ? 'secondary' : 'outline'}
                        className="text-[10px] uppercase font-bold shrink-0 ml-2"
                      >
                        {org.plan}
                      </Badge>
                    </button>
                  )
                })
              )}
            </div>

            {selectedOrgId && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Empresa seleccionada:{' '}
                  <strong>{organizations.find((o) => o.id === selectedOrgId)?.name}</strong>
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyCode(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void applyPromotion()}
              disabled={saving || !selectedOrgId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
              Confirmar aplicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: VER USOS DE UN CÓDIGO */}
      <Dialog open={Boolean(detailCode)} onOpenChange={(open) => !open && setDetailCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Canjes de {detailCode?.code}
            </DialogTitle>
            <DialogDescription>
              Empresas que han redimido esta promoción y momento exacto del beneficio.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {(() => {
              const rows = redemptions.filter((r) => r.promo_code_id === detailCode?.id)
              if (rows.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <Info className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium text-foreground">Aún no hay canjes registrados</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ninguna organización ha activado este código hasta el momento.
                    </p>
                  </div>
                )
              }
              return rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span className="font-semibold text-foreground">{r.organization_name}</span>
                  </div>
                  <span className="text-muted-foreground font-medium">
                    {new Date(r.redeemed_at).toLocaleString('es-PY', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailCode(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ELIMINAR PROMOCIÓN */}
      <Dialog open={Boolean(deleteCode)} onOpenChange={(open) => !open && setDeleteCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>¿Eliminar código {deleteCode?.code}?</DialogTitle>
            </div>
            <DialogDescription>
              {deleteCode && deleteCode.redemption_count > 0 ? (
                <span>
                  Este código cuenta con <strong>{deleteCode.redemption_count} canje(s)</strong> registrados. Por
                  integridad de auditoría histórica, <strong>no puede ser eliminado físicamente</strong>. En su
                  lugar, puedes desactivarlo para que ninguna otra empresa pueda usarlo.
                </span>
              ) : (
                <span>
                  Esta acción es irreversible. El código promocional será eliminado por completo del catálogo.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteCode(null)} disabled={saving}>
              Cancelar
            </Button>
            {deleteCode && deleteCode.redemption_count > 0 ? (
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => {
                  if (deleteCode) {
                    void toggleCode({ ...deleteCode, is_active: true })
                    setDeleteCode(null)
                  }
                }}
              >
                Pausar / Desactivar código
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => void handleDeleteCode()}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar eliminación
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
