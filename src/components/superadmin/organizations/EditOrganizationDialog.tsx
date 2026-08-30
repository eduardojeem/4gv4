'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  HelpCircle,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type EditableOrganization = {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status?: string | null
  currency?: string | null
  timezone?: string | null
  business_vertical?: string | null
  operating_model?: string | null
  enabled_modules?: string[] | null
  trial_ends_at?: string | null
  current_period_ends_at?: string | null
  cancel_at_period_end?: boolean
}

type Props = {
  organization: EditableOrganization | null
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const PLAN_OPTIONS = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']
const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'trialing', label: 'En Prueba (Trial)' },
  { value: 'past_due', label: 'Vencida / Pago Pendiente' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
  { value: 'unpaid', label: 'Impaga' },
]

const CURRENCIES = [
  { value: 'PYG', label: 'Guaraní Paraguayo (PYG)' },
  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
  { value: 'ARS', label: 'Peso Argentino (ARS)' },
  { value: 'BRL', label: 'Real Brasileño (BRL)' },
]

const TIMEZONES = [
  { value: 'America/Asuncion', label: '🇵🇾 Paraguay (UTC-4)' },
  { value: 'America/Buenos_Aires', label: '🇦🇷 Argentina (UTC-3)' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 Brasil (UTC-3)' },
  { value: 'America/Montevideo', label: '🇺🇾 Uruguay (UTC-3)' },
  { value: 'America/Santiago', label: '🇨🇱 Chile (UTC-4/3)' },
  { value: 'America/Bogota', label: '🇨🇴 Colombia (UTC-5)' },
  { value: 'America/Lima', label: '🇵🇪 Perú (UTC-5)' },
  { value: 'America/Mexico_City', label: '🇲🇽 México (UTC-6)' },
  { value: 'America/New_York', label: '🇺🇸 New York (UTC-5/4)' },
]

export const VERTICAL_OPTIONS = [
  { value: 'electronics', label: 'Tecnología & Celulares', icon: '📱' },
  { value: 'clothing', label: 'Ropa & Moda', icon: '👗' },
  { value: 'general', label: 'Comercio General', icon: '🏬' },
  { value: 'food', label: 'Alimentos & Gastronomía', icon: '🍔' },
  { value: 'cosmetics', label: 'Cosmética & Belleza', icon: '💄' },
  { value: 'hardware', label: 'Ferretería & Construcción', icon: '🔨' },
  { value: 'other', label: 'Otros Rubros', icon: '🏷️' },
]

export const OPERATING_MODELS = [
  { value: 'retail', label: 'Venta Minorista' },
  { value: 'wholesale', label: 'Venta Mayorista' },
  { value: 'service', label: 'Prestación de Servicios' },
  { value: 'repair', label: 'Taller & Reparaciones' },
  { value: 'mixed', label: 'Negocio Mixto' },
]

export const AVAILABLE_MODULES = [
  { key: 'pos', label: 'Punto de Venta (POS)', desc: 'Caja rápida y ticket' },
  { key: 'inventory', label: 'Inventario / Stock', desc: 'Control de existencias' },
  { key: 'crm', label: 'Clientes / CRM', desc: 'Fidelización e historial' },
  { key: 'ecommerce', label: 'Tienda Online', desc: 'Catálogo público web' },
  { key: 'repairs', label: 'Taller & SAT', desc: 'Órdenes de servicio' },
  { key: 'orders', label: 'Pedidos', desc: 'Gestión y despachos' },
  { key: 'credits', label: 'Créditos y Cuotas', desc: 'Cobranzas y cuotas' },
  { key: 'services', label: 'Servicios & Citas', desc: 'Agenda y presupuestos' },
  { key: 'delivery', label: 'Delivery & Envíos', desc: 'Rastreo y logística' },
  { key: 'analytics', label: 'Métricas & Reportes', desc: 'Estadísticas y KPI' },
  { key: 'promotions', label: 'Promociones', desc: 'Cupones y descuentos' },
  { key: 'inventory_admin', label: 'Stock Avanzado', desc: 'Lotes y transferencias' },
  { key: 'security', label: 'Auditoría', desc: 'Trazabilidad de acciones' },
]

export function EditOrganizationDialog({ organization, open, onClose, onSuccess }: Props) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState('FREE')
  const [status, setStatus] = useState('active')
  const [currency, setCurrency] = useState('PYG')
  const [timezone, setTimezone] = useState('America/Asuncion')
  const [businessVertical, setBusinessVertical] = useState('general')
  const [operatingModel, setOperatingModel] = useState('retail')
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Confirmation Step State
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    if (organization) {
      setName(organization.name || '')
      setSlug(organization.slug || '')
      setPlan((organization.plan || 'FREE').toUpperCase())
      setStatus(organization.subscription_status || 'active')
      setCurrency(organization.currency || 'PYG')
      setTimezone(organization.timezone || 'America/Asuncion')
      setBusinessVertical(organization.business_vertical || 'general')
      setOperatingModel(organization.operating_model || 'retail')
      setEnabledModules(organization.enabled_modules || ['pos', 'inventory', 'crm', 'ecommerce'])
      setCancelAtPeriodEnd(Boolean(organization.cancel_at_period_end))
      setError(null)
      setShowConfirmation(false)
    }
  }, [organization, open])

  if (!organization) return null

  // Change detection for danger/confirmation prompts
  const isSlugChanged = slug.trim() !== organization.slug
  const isPlanChanged = plan !== (organization.plan || 'FREE').toUpperCase()
  const isStatusChanged = status !== (organization.subscription_status || 'active')
  const isDangerousStatus = status === 'suspended' || status === 'cancelled' || status === 'past_due'
  
  const hasChanges =
    name.trim() !== organization.name ||
    isSlugChanged ||
    isPlanChanged ||
    isStatusChanged ||
    currency !== (organization.currency || 'PYG') ||
    timezone !== (organization.timezone || 'America/Asuncion') ||
    businessVertical !== (organization.business_vertical || 'general') ||
    operatingModel !== (organization.operating_model || 'retail') ||
    JSON.stringify([...enabledModules].sort()) !== JSON.stringify([...(organization.enabled_modules || [])].sort()) ||
    cancelAtPeriodEnd !== Boolean(organization.cancel_at_period_end)

  function toggleModule(modKey: string) {
    setEnabledModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    )
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre de la organización es obligatorio.')
      return
    }
    if (!slug.trim()) {
      setError('El slug de subdominio es obligatorio.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      setError('El slug solo puede contener letras minúsculas, números y guiones.')
      return
    }

    // Trigger safety confirmation step
    setShowConfirmation(true)
  }

  async function executeSave() {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/superadmin/organizations/${organization?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          plan,
          status,
          currency,
          timezone,
          business_vertical: businessVertical,
          operating_model: operatingModel,
          enabled_modules: enabledModules,
          cancel_at_period_end: cancelAtPeriodEnd,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar los cambios.')
      }

      toast.success('Organización actualizada con éxito')
      router.refresh()
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al actualizar.')
      setShowConfirmation(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex max-h-[94vh] flex-col overflow-hidden p-0 sm:max-w-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl">
        
        {/* Header */}
        <div className="border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-violet-50/50 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white font-black text-sm shadow-md">
                {organization.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">
                    {showConfirmation ? 'Confirmar Modificación Crítica' : 'Editar Organización, Rubro & Módulos'}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold">
                    /{organization.slug}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  {showConfirmation
                    ? 'Revisa el impacto antes de aplicar los cambios en producción.'
                    : 'Actualiza identidad comercial, rubro, plan SaaS, módulos y estado operativo.'}
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full hidden sm:inline-flex',
                status === 'active'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
              )}
            >
              {status}
            </Badge>
          </div>
        </div>

        {/* ⚠️ STEP 2: CONFIRMATION & IMPACT VIEW */}
        {showConfirmation ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950/40">
            
            {/* Danger Hero Warning */}
            <div className="rounded-3xl border border-red-300 bg-gradient-to-br from-red-50 via-white to-rose-50 p-5 dark:border-red-900/70 dark:from-red-950/40 dark:via-slate-900 dark:to-rose-950/30 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-red-700 dark:text-red-400 font-extrabold text-sm">
                <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
                <span>¿Confirmas la aplicación de estos cambios?</span>
              </div>
              <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed font-medium">
                Estás a punto de modificar la configuración operativa de <strong className="font-black text-slate-900 dark:text-slate-100">{organization.name}</strong>. Esta acción afectará el acceso de sus usuarios, el catálogo y las URLs públicas.
              </p>
            </div>

            {/* Change Diff Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-3 text-xs shadow-2xs">
              <p className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                Resumen de Cambios a Aplicar
              </p>
              
              <ul className="space-y-2.5">
                {name.trim() !== organization.name && (
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-500 font-medium">Nombre de la Empresa:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {organization.name} <ArrowRight className="inline h-3 w-3 text-slate-400 mx-1" /> <strong className="text-violet-600 dark:text-violet-400">{name}</strong>
                    </span>
                  </li>
                )}

                {isSlugChanged && (
                  <li className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium">Subdominio Público:</span>
                      <span className="font-mono font-bold">
                        /{organization.slug} <ArrowRight className="inline h-3 w-3 text-slate-400 mx-1" /> <strong className="text-red-600 dark:text-red-400">/{slug}</strong>
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl">
                      ⚠️ <strong>Aviso Crítico:</strong> Los enlaces anteriores compartidos por la empresa (redes sociales, WhatsApp, QR) dejarán de responder y deberán reemplazarse por la nueva URL.
                    </p>
                  </li>
                )}

                {businessVertical !== (organization.business_vertical || 'general') && (
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-500 font-medium">Rubro Comercial:</span>
                    <span className="font-bold">
                      {organization.business_vertical || 'general'} → <strong className="text-cyan-600">{businessVertical}</strong>
                    </span>
                  </li>
                )}

                {isPlanChanged && (
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-500 font-medium">Plan SaaS:</span>
                    <span className="font-bold">
                      {organization.plan} <ArrowRight className="inline h-3 w-3 text-slate-400 mx-1" /> <strong className="text-violet-600 dark:text-violet-400">{plan}</strong>
                    </span>
                  </li>
                )}

                {isStatusChanged && (
                  <li className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium">Estado de Suscripción:</span>
                      <span className="font-bold">
                        {organization.subscription_status || 'active'} <ArrowRight className="inline h-3 w-3 text-slate-400 mx-1" /> <strong className={cn(isDangerousStatus ? 'text-red-600 dark:text-red-400' : 'text-emerald-600')}>{status}</strong>
                      </span>
                    </div>
                    {isDangerousStatus && (
                      <p className="text-[11px] text-red-700 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/40 p-2 rounded-xl">
                        🚨 <strong>Bloqueo Operativo:</strong> Si el estado es {status}, los usuarios del tenant no podrán procesar ventas en el POS ni gestionar catálogo.
                      </p>
                    )}
                  </li>
                )}

                <li className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 font-medium">Módulos Habilitados ({enabledModules.length}):</span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {enabledModules.map((mod) => (
                      <Badge key={mod} variant="secondary" className="text-[10px] font-bold">
                        {AVAILABLE_MODULES.find((m) => m.key === mod)?.label || mod}
                      </Badge>
                    ))}
                  </div>
                </li>
              </ul>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Confirmation Footer */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmation(false)}
                className="rounded-xl text-xs font-bold cursor-pointer w-full sm:w-auto"
              >
                Volver a Revisar
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void executeSave()}
                className="gap-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 shadow-md cursor-pointer h-10 px-5 w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aplicando Cambios...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar y Guardar en Producción
                  </>
                )}
              </Button>
            </div>

          </div>
        ) : (
          /* 🛠️ STEP 1: MAIN EDIT FORM */
          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950/40">
            
            {/* Real-time Critical Impact Alert Banners */}
            {isSlugChanged && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-2xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-extrabold block">Atención: Modificación de Subdominio</strong>
                  <p>
                    Cambiar el slug de <code>/{organization.slug}</code> a <code>/{slug}</code> cambiará la URL pública de la tienda para los clientes.
                  </p>
                </div>
              </div>
            )}

            {isDangerousStatus && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50/90 p-4 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 shadow-2xs">
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-extrabold block">Alerta de Suspensión / Estado Restrictivo</strong>
                  <p>
                    Marcar la organización como <strong>{status}</strong> restringirá las ventas y el acceso operativo para todos los miembros.
                  </p>
                </div>
              </div>
            )}

            {/* Form Fields Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-org-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nombre de la Empresa <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-10 text-xs font-bold"
                  placeholder="Nombre comercial"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-org-slug" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Subdominio / Slug de Tienda <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[10px] text-slate-400">URL pública: /{slug}/inicio</span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    /
                  </span>
                  <Input
                    id="edit-org-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className={cn(
                      'pl-7 rounded-xl h-10 text-xs font-mono font-bold',
                      isSlugChanged ? 'text-amber-600 border-amber-400 ring-1 ring-amber-400/30' : 'text-violet-600 dark:text-violet-400'
                    )}
                    placeholder="slug-de-empresa"
                    required
                  />
                </div>
              </div>

              {/* Rubro Comercial & Modelo Operativo */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-org-vertical" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rubro Comercial
                </Label>
                <Select value={businessVertical} onValueChange={setBusinessVertical}>
                  <SelectTrigger id="edit-org-vertical" className="rounded-xl h-10 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {VERTICAL_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value} className="text-xs font-bold">
                        {v.icon} {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-model" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Modelo Operativo
                </Label>
                <Select value={operatingModel} onValueChange={setOperatingModel}>
                  <SelectTrigger id="edit-org-model" className="rounded-xl h-10 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {OPERATING_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs font-bold">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-plan" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Plan Asignado
                </Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger id="edit-org-plan" className="rounded-xl h-10 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {PLAN_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs font-bold">
                        PLAN {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-status" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Estado de la Suscripción
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="edit-org-status" className="rounded-xl h-10 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {STATUS_OPTIONS.map((st) => (
                      <SelectItem key={st.value} value={st.value} className="text-xs font-bold">
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-currency" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Moneda Principal
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="edit-org-currency" className="rounded-xl h-10 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs font-bold">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-timezone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Zona Horaria
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="edit-org-timezone" className="rounded-xl h-10 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value} className="text-xs font-bold">
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Módulos Habilitados Selector Grid */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-violet-600" />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                    Módulos Funcionales Habilitados
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {enabledModules.length} activos
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Selecciona las funcionalidades disponibles en el menú y operaciones de este tenant:
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_MODULES.map((mod) => {
                  const isChecked = enabledModules.includes(mod.key)
                  return (
                    <label
                      key={mod.key}
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-all cursor-pointer select-none',
                        isChecked
                          ? 'border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20 text-slate-900 dark:text-slate-100'
                          : 'border-slate-100 dark:border-slate-800/80 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleModule(mod.key)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="font-bold">{mod.label}</p>
                        <p className="text-[10px] text-slate-400">{mod.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Quick 1-Click Status Presets (Unified with Subscriptions) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Atajos Rápidos de Estado
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setStatus('active'); toast.info('Estado marcado como Activa') }}
                  className="h-7 text-[11px] font-bold rounded-lg border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300 hover:bg-emerald-50 cursor-pointer"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Activar & Normalizar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setStatus('trialing'); toast.info('Estado marcado como Trialing') }}
                  className="h-7 text-[11px] font-bold rounded-lg border-cyan-200 text-cyan-700 dark:border-cyan-900/60 dark:text-cyan-300 hover:bg-cyan-50 cursor-pointer"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Modo Trial (Prueba)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setStatus('suspended'); toast.warning('Estado marcado como Suspendida') }}
                  className="h-7 text-[11px] font-bold rounded-lg border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-300 hover:bg-red-50 cursor-pointer"
                >
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  Suspender Acceso
                </Button>
              </div>
            </div>

            {/* Cancel at period end switch */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <div>
                <Label htmlFor="edit-org-cancel" className="text-xs font-extrabold cursor-pointer text-slate-900 dark:text-slate-100">
                  Cancelar Suscripción al Cierre
                </Label>
                <p className="text-[11px] text-slate-500 font-medium">
                  Mantiene el acceso operativo hasta la fecha de expiración del período.
                </p>
              </div>
              <Switch
                id="edit-org-cancel"
                checked={cancelAtPeriodEnd}
                onCheckedChange={setCancelAtPeriodEnd}
              />
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Form Action Buttons */}
            <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!hasChanges}
                size="sm"
                className={cn(
                  'gap-1.5 rounded-xl text-xs font-bold shadow-md cursor-pointer h-9 px-4',
                  isDangerousStatus || isSlugChanged
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600'
                )}
              >
                <Save className="h-3.5 w-3.5" />
                Revisar & Guardar Cambios
              </Button>
            </DialogFooter>

          </form>
        )}

      </DialogContent>
    </Dialog>
  )
}