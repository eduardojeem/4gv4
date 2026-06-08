'use client'

import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Gauge,
  Hash,
  Landmark,
  Layers3,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
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

function DetailPanel({
  children,
  icon: Icon,
  title,
  subtitle,
}: {
  children: ReactNode
  icon: DetailIcon
  title: string
  subtitle?: string
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/45">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

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
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
      {Icon && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-800">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-medium text-slate-800 dark:text-slate-200">
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
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-base font-semibold text-slate-950 dark:text-slate-50">{value}</p>
      {helper && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{helper}</p>}
    </div>
  )
}

function formatDayCounter(days: number | null) {
  if (days === null) return 'Sin fecha'
  if (days < 0) return `${Math.abs(days)} dias vencido`
  if (days === 0) return 'Hoy'
  return `${days} dias`
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
  if (!sub) return null

  const progress = periodProgress(sub)
  const renewalDays = daysUntil(sub.current_period_ends_at)
  const trialDays = daysUntil(sub.trial_ends_at)
  const monthlyPrice = sub.plan_details ? formatMoney(sub.plan_details.price_monthly) : 'Sin precio'
  const owner = sub.owner_name || sub.owner_email || sub.owner_id

  return (
    <Dialog
      open={Boolean(sub)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DialogHeader className="border-b border-slate-200 bg-slate-50/90 px-5 py-5 text-left dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-4 pr-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <PlanBadge plan={sub.plan} />
                  <StatusBadge status={sub.status} />
                  {sub.cancel_at_period_end && (
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
                    >
                      Cancela al cierre
                    </Badge>
                  )}
                </div>
                <DialogTitle className="truncate text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {sub.organization_name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {getRecommendation(sub)}
                </DialogDescription>
              </div>

              <div className="grid min-w-[220px] grid-cols-2 gap-2">
                <SummaryTile icon={CreditCard} label="Plan" value={sub.plan.toUpperCase()} helper={monthlyPrice} />
                <SummaryTile icon={CalendarClock} label="Renueva" value={formatDayCounter(renewalDays)} helper={formatDate(sub.current_period_ends_at)} />
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 bg-slate-50/40 p-4 dark:bg-slate-950/30 sm:p-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/45">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Periodo actual</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{periodLabel(sub)}</p>
                </div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{progress}%</div>
              </div>
              <Progress value={progress} className="mt-3 h-2" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <SummaryTile icon={CalendarClock} label="Trial" value={formatDayCounter(trialDays)} helper={formatDate(sub.trial_ends_at)} />
                <SummaryTile icon={Building2} label="Miembros" value={String(sub.members_count ?? 0)} />
                <SummaryTile icon={Layers3} label="Actividad" value={`${sub.products_count ?? 0} productos`} helper={`${sub.sales_count ?? 0} ventas`} />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <DetailPanel
                  icon={Building2}
                  title="Datos de la organizacion"
                  subtitle="Identificacion, propietario y referencias del tenant."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={UserRound} label="Owner" value={owner} />
                    <InfoRow icon={Mail} label="Email owner" value={sub.owner_email} />
                    <InfoRow icon={Hash} label="Organizacion ID" value={sub.organization_id} />
                    <InfoRow
                      icon={Hash}
                      label="Subscription ID"
                      value={sub.id}
                      action={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => onCopyValue(sub.id)}
                          aria-label="Copiar ID de suscripcion"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </DetailPanel>

                <DetailPanel
                  icon={Landmark}
                  title="Proveedor de pago"
                  subtitle="Datos externos asociados al cobro."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={ShieldCheck} label="Provider" value={sub.provider} />
                    <InfoRow icon={Hash} label="Provider customer" value={sub.provider_customer_id} />
                    <InfoRow icon={Hash} label="Provider subscription" value={sub.provider_subscription_id} />
                    <InfoRow icon={CalendarClock} label="Ultima actualizacion" value={formatDate(sub.updated_at)} />
                  </div>
                </DetailPanel>

                {sub.plan_details && (
                  <DetailPanel
                    icon={CreditCard}
                    title={sub.plan_details.name}
                    subtitle={sub.plan_details.is_active === false ? 'Plan inactivo' : 'Detalle del plan contratado.'}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Limites
                        </p>
                        {Object.keys(sub.plan_details.limits).length > 0 ? (
                          <div className="space-y-1.5">
                            {Object.entries(sub.plan_details.limits).map(([key, value]) => (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/60"
                              >
                                <span className="min-w-0 truncate text-slate-600 dark:text-slate-400">{key}</span>
                                <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                                  {normalizeLimitValue(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Sin limites registrados.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Modulos
                        </p>
                        {sub.plan_details.modules.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sub.plan_details.modules.map((mod) => (
                              <Badge key={mod} variant="secondary" className="text-xs">
                                {mod}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Sin modulos registrados.</p>
                        )}
                      </div>
                    </div>
                  </DetailPanel>
                )}
              </div>

              {editForm && (
                <DetailPanel
                  icon={ShieldCheck}
                  title="Editar suscripcion"
                  subtitle="El cambio actualiza la suscripcion y el plan de la organizacion."
                >
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-plan">Plan</Label>
                        <Select
                          value={editForm.plan}
                          onValueChange={(v) => onEditFormChange({ ...editForm, plan: v })}
                        >
                          <SelectTrigger id="edit-plan">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {planOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="edit-status">Estado</Label>
                        <Select
                          value={editForm.status}
                          onValueChange={(v) => onEditFormChange({ ...editForm, status: v })}
                        >
                          <SelectTrigger id="edit-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired', 'unpaid'].map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt.replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-trial">Fin de trial</Label>
                        <Input
                          id="edit-trial"
                          type="datetime-local"
                          value={editForm.trial_ends_at}
                          onChange={(e) => onEditFormChange({ ...editForm, trial_ends_at: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-period-start">Inicio del periodo</Label>
                          <Input
                            id="edit-period-start"
                            type="datetime-local"
                            value={editForm.current_period_starts_at}
                            onChange={(e) =>
                              onEditFormChange({ ...editForm, current_period_starts_at: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-period-end">Fin del periodo</Label>
                          <Input
                            id="edit-period-end"
                            type="datetime-local"
                            value={editForm.current_period_ends_at}
                            onChange={(e) =>
                              onEditFormChange({ ...editForm, current_period_ends_at: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <div>
                        <Label htmlFor="edit-cancel" className="cursor-pointer">
                          Cancelar al cierre
                        </Label>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Mantiene activo hasta el final del periodo.
                        </p>
                      </div>
                      <Switch
                        id="edit-cancel"
                        checked={editForm.cancel_at_period_end}
                        onCheckedChange={(checked) =>
                          onEditFormChange({ ...editForm, cancel_at_period_end: checked })
                        }
                      />
                    </div>

                    {saveError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No se pudo guardar</AlertTitle>
                        <AlertDescription>{saveError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </DetailPanel>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onCopyValue(sub.id)}>
              <Copy className="h-3.5 w-3.5" />
              Copiar ID
            </Button>
            {sub.organization_slug && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/${sub.organization_slug}/inicio`}>
                  Tienda
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/superadmin/organizations?query=${encodeURIComponent(sub.organization_name)}`}>
                Ver organizacion
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <Button size="sm" className="gap-2" onClick={onSave} disabled={isSaving || !editForm}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
