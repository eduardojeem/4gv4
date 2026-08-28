'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Gauge,
  Globe,
  Hash,
  Landmark,
  Layers3,
  Mail,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
import type { EditForm, SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import {
  daysUntil,
  formatDate,
  formatMoney,
  getRecommendation,
  normalizeLimitValue,
  periodLabel,
  periodProgress,
} from './utils'
import { cn } from '@/lib/utils'

type Props = {
  subscription: SuperAdminSubscription | null
  editForm: EditForm | null
  isSaving: boolean
  planOptions: string[]
  saveError: string | null
  onClose: () => void
  onEditFormChange: (form: EditForm) => void
  onSave: () => void
  onCopyValue: (value: string | null) => void
}

type DetailIcon = ComponentType<{ className?: string }>

function InfoRow({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon?: DetailIcon
  label: string
  value: string | null
  action?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      {Icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-2xs dark:bg-slate-950 dark:text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 break-words text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
          {value || 'No disponible'}
        </p>
      </div>
      {action}
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: DetailIcon
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 truncate text-sm sm:text-base font-black text-slate-950 dark:text-slate-50">{value}</p>
      {helper && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">{helper}</p>}
    </div>
  )
}

function formatDayCounter(days: number | null) {
  if (days === null) return 'Sin fecha'
  if (days < 0) return `${Math.abs(days)}d vencido`
  if (days === 0) return 'Hoy'
  return `${days} días`
}

export function SubscriptionDetailDialog({
  subscription: sub,
  editForm,
  isSaving,
  planOptions,
  saveError,
  onClose,
  onEditFormChange,
  onSave,
  onCopyValue,
}: Props) {
  const [activeTab, setActiveTab] = useState<'edit' | 'details'>('edit')

  if (!sub) return null

  const progress = periodProgress(sub)
  const renewalDays = daysUntil(sub.current_period_ends_at)
  const trialDays = daysUntil(sub.trial_ends_at)
  const monthlyPrice = sub.plan_details ? formatMoney(sub.plan_details.price_monthly, sub.plan_details.currency || 'PYG') : 'Gratuito'
  const owner = sub.owner_name || sub.owner_email || sub.owner_id

  // Quick preset helper functions
  const addDaysToPeriod = (daysToAdd: number) => {
    if (!editForm) return
    const base = editForm.current_period_ends_at ? new Date(editForm.current_period_ends_at) : new Date()
    base.setDate(base.getDate() + daysToAdd)
    const localStr = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    onEditFormChange({
      ...editForm,
      current_period_ends_at: localStr,
      status: 'active',
      cancel_at_period_end: false,
    })
    toast.success(`Período extendido por ${daysToAdd} días`)
  }

  const addDaysToTrial = (daysToAdd: number) => {
    if (!editForm) return
    const base = editForm.trial_ends_at ? new Date(editForm.trial_ends_at) : new Date()
    base.setDate(base.getDate() + daysToAdd)
    const localStr = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    onEditFormChange({
      ...editForm,
      trial_ends_at: localStr,
      status: 'trialing',
    })
    toast.success(`Trial extendido por ${daysToAdd} días`)
  }

  const activateAndRenew = () => {
    if (!editForm) return
    const now = new Date()
    const future = new Date()
    future.setDate(now.getDate() + 30)

    const nowStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    const futureStr = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

    onEditFormChange({
      ...editForm,
      status: 'active',
      current_period_starts_at: nowStr,
      current_period_ends_at: futureStr,
      cancel_at_period_end: false,
    })
    toast.success('Suscripción activada y renovada por 30 días')
  }

  return (
    <Dialog
      open={Boolean(sub)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-4xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl">

        {/* Header with Hero Banner */}
        <div className="border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-violet-50/50 p-6 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white text-lg font-black shadow-md ring-2 ring-white dark:ring-slate-800">
                {sub.organization_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <PlanBadge plan={sub.plan} />
                  <StatusBadge status={sub.status} />
                  {sub.cancel_at_period_end && (
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 font-bold text-[10px]">
                      Cancela al cierre
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                  {sub.organization_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  {getRecommendation(sub)} · {monthlyPrice}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <EnterSupportButton organizationId={sub.organization_id} organizationName={sub.organization_name} />
              {sub.organization_slug && (
                <Button asChild variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1 border-slate-200 dark:border-slate-800 cursor-pointer">
                  <a href={`/${sub.organization_slug}/inicio`} target="_blank" rel="noreferrer">
                    <Globe className="h-3.5 w-3.5 text-cyan-600" />
                    Tienda
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 p-1 w-fit">
            <button
              onClick={() => setActiveTab('edit')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                activeTab === 'edit'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              )}
            >
              <Wrench className="h-3.5 w-3.5 text-violet-500" />
              Editor de Suscripción
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                activeTab === 'details'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              )}
            >
              <Building2 className="h-3.5 w-3.5 text-cyan-500" />
              Ficha del Tenant & Límites
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/40">

          {/* Quick Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile icon={CreditCard} label="Plan Actual" value={sub.plan.toUpperCase()} helper={monthlyPrice} />
            <SummaryTile icon={CalendarClock} label="Vencimiento" value={formatDayCounter(renewalDays)} helper={formatDate(sub.current_period_ends_at)} />
            <SummaryTile icon={Building2} label="Personal" value={`${sub.members_count ?? 0} miembros`} helper="En la tienda" />
            <SummaryTile icon={Layers3} label="Catálogo" value={`${sub.products_count ?? 0} productos`} helper={`${sub.sales_count ?? 0} ventas`} />
          </div>

          {activeTab === 'edit' && editForm && (
            <div className="space-y-6">

              {/* ⚡ Acciones Rápidas (1-Click Presets) */}
              <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 dark:border-violet-900/60 dark:bg-violet-950/20 p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-violet-900 dark:text-violet-300">
                    Acciones Rápidas de Superadmin (1 Clic)
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addDaysToPeriod(30)}
                    className="h-7 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-violet-300 dark:border-violet-800 hover:bg-violet-100 cursor-pointer"
                  >
                    <Plus className="h-3 w-3 text-emerald-500 mr-1" />
                    +30 Días al Período
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addDaysToTrial(14)}
                    className="h-7 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-violet-300 dark:border-violet-800 hover:bg-violet-100 cursor-pointer"
                  >
                    <Clock className="h-3 w-3 text-cyan-500 mr-1" />
                    +14 Días de Trial
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={activateAndRenew}
                    className="h-7 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-violet-300 dark:border-violet-800 hover:bg-violet-100 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 mr-1" />
                    Activar & Renovar 1 Mes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEditFormChange({ ...editForm, status: 'past_due' })}
                    className="h-7 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                  >
                    <AlertTriangle className="h-3 w-3 text-amber-500 mr-1" />
                    Marcar Vencido (Past Due)
                  </Button>
                </div>
              </div>

              {/* Form Fields Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-plan" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Plan Asignado
                    </Label>
                    <Select
                      value={editForm.plan}
                      onValueChange={(v) => onEditFormChange({ ...editForm, plan: v })}
                    >
                      <SelectTrigger id="edit-plan" className="rounded-xl h-10 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {planOptions.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs font-bold">
                            PLAN {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-status" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Estado de Suscripción
                    </Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) => onEditFormChange({ ...editForm, status: v })}
                    >
                      <SelectTrigger id="edit-status" className="rounded-xl h-10 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired', 'unpaid'].map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs font-bold uppercase">
                            {opt.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-period-start" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Inicio del Período
                    </Label>
                    <Input
                      id="edit-period-start"
                      type="datetime-local"
                      value={editForm.current_period_starts_at}
                      onChange={(e) => onEditFormChange({ ...editForm, current_period_starts_at: e.target.value })}
                      className="rounded-xl h-10 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-period-end" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Fin del Período (Renovación)
                    </Label>
                    <Input
                      id="edit-period-end"
                      type="datetime-local"
                      value={editForm.current_period_ends_at}
                      onChange={(e) => onEditFormChange({ ...editForm, current_period_ends_at: e.target.value })}
                      className="rounded-xl h-10 text-xs font-mono font-bold text-emerald-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trial" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Fin de Período de Prueba
                    </Label>
                    <Input
                      id="edit-trial"
                      type="datetime-local"
                      value={editForm.trial_ends_at}
                      onChange={(e) => onEditFormChange({ ...editForm, trial_ends_at: e.target.value })}
                      className="rounded-xl h-10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-cancel" className="text-xs font-extrabold cursor-pointer text-slate-900 dark:text-slate-100">
                      Cancelar al cierre del período
                    </Label>
                    <p className="text-xs text-slate-500 font-medium">
                      Mantiene el acceso operativo al tenant hasta la fecha de expiración configurada.
                    </p>
                  </div>
                  <Switch
                    id="edit-cancel"
                    checked={editForm.cancel_at_period_end}
                    onCheckedChange={(checked) => onEditFormChange({ ...editForm, cancel_at_period_end: checked })}
                  />
                </div>

                {saveError && (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No se pudo guardar la suscripción</AlertTitle>
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">

              {/* Tenant Details */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Identificadores & Propietario
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow icon={UserRound} label="Owner de la Empresa" value={owner} />
                  <InfoRow icon={Mail} label="Email Registrado" value={sub.owner_email} />
                  <InfoRow icon={Hash} label="ID de Organización (UUID)" value={sub.organization_id} />
                  <InfoRow
                    icon={Hash}
                    label="ID de Suscripción"
                    value={sub.id}
                    action={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 cursor-pointer"
                        onClick={() => onCopyValue(sub.id)}
                        aria-label="Copiar ID de suscripción"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    }
                  />
                </div>
              </div>

              {/* Provider Details */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Pasarela & Proveedor de Pagos
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow icon={ShieldCheck} label="Proveedor Asignado" value={sub.provider.toUpperCase()} />
                  <InfoRow icon={Hash} label="Provider Customer ID" value={sub.provider_customer_id} />
                  <InfoRow icon={Hash} label="Provider Subscription ID" value={sub.provider_subscription_id} />
                  <InfoRow icon={CalendarClock} label="Última Actualización" value={formatDate(sub.updated_at)} />
                </div>
              </div>

              {/* Plan Limits */}
              {sub.plan_details && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Límites y Módulos del Plan ({sub.plan_details.name})
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Límites Cuantitativos</p>
                      {Object.keys(sub.plan_details.limits).length > 0 ? (
                        <div className="space-y-1.5">
                          {Object.entries(sub.plan_details.limits).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-950/60"
                            >
                              <span className="truncate font-medium text-slate-600 dark:text-slate-400">{key}</span>
                              <span className="shrink-0 font-bold text-slate-900 dark:text-slate-100">
                                {normalizeLimitValue(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Sin límites registrados.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Módulos Habilitados</p>
                      {sub.plan_details.modules.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {sub.plan_details.modules.map((mod) => (
                            <Badge key={mod} variant="secondary" className="rounded-lg text-xs font-bold px-2 py-0.5">
                              {mod}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Sin módulos registrados.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <DialogFooter className="shrink-0 border-t border-slate-200/90 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer" onClick={() => onCopyValue(sub.id)}>
              <Copy className="h-3.5 w-3.5" />
              Copiar ID
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer">
              <Link href={`/superadmin/organizations?q=${encodeURIComponent(sub.organization_slug || sub.organization_name)}`}>
                <Building2 className="h-3.5 w-3.5 text-violet-600" />
                Ver Empresa
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 rounded-xl text-xs font-bold cursor-pointer">
              Cerrar
            </Button>
            <Button size="sm" className="h-8 gap-1.5 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 shadow-md cursor-pointer" onClick={onSave} disabled={isSaving || !editForm}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
