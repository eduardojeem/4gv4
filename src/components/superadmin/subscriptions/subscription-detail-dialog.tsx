'use client'

import { AlertTriangle, CheckCircle2, Copy, ExternalLink, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { EditForm, SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import {
  formatDate,
  getRecommendation,
  normalizeLimitValue,
  periodLabel,
  periodProgress,
} from './utils'

type Props = {
  subscription: SuperAdminSubscription | null
  editForm: EditForm | null
  isSaving: boolean
  saveError: string | null
  onClose: () => void
  onEditFormChange: (form: EditForm) => void
  onSave: () => void
  onCopyValue: (value: string | null) => void
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="break-all text-sm text-slate-800 dark:text-slate-200">{value || 'No disponible'}</p>
    </div>
  )
}

export function SubscriptionDetailDialog({
  subscription: sub,
  editForm,
  isSaving,
  saveError,
  onClose,
  onEditFormChange,
  onSave,
  onCopyValue,
}: Props) {
  if (!sub) return null

  const progress = periodProgress(sub)

  return (
    <Dialog
      open={Boolean(sub)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{sub.organization_name}</DialogTitle>
          <DialogDescription>{getRecommendation(sub)}</DialogDescription>
        </DialogHeader>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
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

        {/* Period progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Avance del periodo</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-slate-400">{periodLabel(sub)}</p>
        </div>

        <Separator />

        {/* Info grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="Trial termina" value={formatDate(sub.trial_ends_at)} />
          <InfoRow label="Provider" value={sub.provider} />
          <InfoRow label="Owner" value={sub.owner_name || sub.owner_email || sub.owner_id} />
          <InfoRow label="Email owner" value={sub.owner_email} />
          <InfoRow label="Subscription ID" value={sub.id} />
          <InfoRow label="Provider subscription" value={sub.provider_subscription_id} />
          <InfoRow label="Provider customer" value={sub.provider_customer_id} />
          <InfoRow label="Organización ID" value={sub.organization_id} />
        </div>

        {/* Plan details */}
        {sub.plan_details && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {sub.plan_details.name}
                    {sub.plan_details.is_active === false && (
                      <span className="ml-2 text-xs font-normal text-slate-400">(inactivo)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">Detalle del plan</p>
                </div>
                <PlanBadge plan={sub.plan} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Limits */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Límites
                  </p>
                  {Object.keys(sub.plan_details.limits).length > 0 ? (
                    <div className="space-y-1.5">
                      {Object.entries(sub.plan_details.limits).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"
                        >
                          <span className="text-slate-600 dark:text-slate-400">{key}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {normalizeLimitValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Sin límites registrados.</p>
                  )}
                </div>

                {/* Modules */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Módulos
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
                    <p className="text-sm text-slate-400">Sin módulos registrados.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit form */}
        {editForm && (
          <>
            <Separator />
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Editar suscripción
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Al guardar se actualiza la suscripción y el plan de la organización.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Plan */}
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
                      {['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
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
                      {['trialing', 'active', 'past_due', 'canceled', 'unpaid'].map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Trial ends */}
                <div className="space-y-1.5">
                  <Label htmlFor="edit-trial">Fin de trial</Label>
                  <Input
                    id="edit-trial"
                    type="datetime-local"
                    value={editForm.trial_ends_at}
                    onChange={(e) => onEditFormChange({ ...editForm, trial_ends_at: e.target.value })}
                  />
                </div>

                {/* Period start */}
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

                {/* Period end */}
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

                {/* Cancel at period end */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div>
                    <Label htmlFor="edit-cancel" className="cursor-pointer">
                      Cancelar al cierre
                    </Label>
                    <p className="mt-0.5 text-xs text-slate-400">
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
              </div>

              {saveError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No se pudo guardar</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}

        {/* Footer actions */}
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onCopyValue(sub.id)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar ID
          </Button>

          <div className="flex flex-wrap gap-2">
            {sub.organization_slug && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/${sub.organization_slug}/inicio`}>
                  Tienda
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link
                href={`/superadmin/organizations?query=${encodeURIComponent(sub.organization_name)}`}
              >
                Ver organización
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={onSave}
              disabled={isSaving || !editForm}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
