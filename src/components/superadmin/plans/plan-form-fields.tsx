'use client'

import { CheckCircle2, Circle, Lock, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PLAN_FEATURES, PLAN_FEATURE_GROUP_LABEL, type PlanFeatureGroup } from '@/lib/saas/plan-feature-catalog'
import {
  PLAN_LIMIT_FIELDS,
  formatPlanLimit,
  normalizePlanLimits,
  parsePlanLimit,
  type PlanLimitKey,
} from '@/lib/saas/plan-limits'
import { PLAN_FEATURE_ICONS } from './plan-feature-icons'

/*
 * Campos compartidos por "Nuevo plan" y "Editar plan": los dos formularios
 * validan y muestran límites y funciones igual.
 */

// ─── Límites ──────────────────────────────────────────────────────────────────

/**
 * Error de un límite o null. Un campo vacío es un error: `parsePlanLimit`
 * lo toma como "sin límite" y borrar el número no puede quitar el tope.
 */
export function limitFieldError(key: PlanLimitKey, value: string): string | null {
  if (value.trim() === '') return 'Escribí un número (0 = no incluye).'
  const result = normalizePlanLimits({ [key]: value })
  return 'error' in result ? result.error.replace(/^[^:]+:\s*/, '') : null
}

/** Primer error de los límites, con el nombre del campo, o null. */
export function firstLimitError(limits: Record<PlanLimitKey, string>): string | null {
  for (const field of PLAN_LIMIT_FIELDS) {
    const error = limitFieldError(field.key, limits[field.key])
    if (error) return `${field.label}: ${error}`
  }
  return null
}

/** "300/mes" y "10.000" pasan a "300" y "10000" para que el form compare igual. */
export function canonicalLimits(limits: Record<PlanLimitKey, string>): Record<PlanLimitKey, string> {
  const result = { ...limits }
  for (const field of PLAN_LIMIT_FIELDS) {
    const value = parsePlanLimit(limits[field.key])
    if (value === null) result[field.key] = 'Ilimitado'
    else if (value !== undefined) result[field.key] = String(value)
  }
  return result
}

function LimitField({
  label,
  fieldKey,
  allowsUnlimited,
  value,
  onChange,
}: {
  label: string
  fieldKey: PlanLimitKey
  allowsUnlimited: boolean
  value: string
  onChange: (value: string) => void
}) {
  // Estado derivado del valor, sin estado propio: al abrir otro plan se ve lo
  // de ese plan y no lo que quedó del anterior.
  const empty = value.trim() === ''
  const parsed = empty ? undefined : parsePlanLimit(value)
  const unlimited = allowsUnlimited && parsed === null
  const error = limitFieldError(fieldKey, value)

  return (
    <div className="space-y-1.5 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`limit-${fieldKey}`} className="text-xs font-semibold">{label}</Label>
        {allowsUnlimited && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500">
            <Switch
              checked={unlimited}
              onCheckedChange={(checked) => onChange(checked ? 'Ilimitado' : '0')}
              aria-label={`${label} sin límite`}
            />
            Sin límite
          </label>
        )}
      </div>
      <Input
        id={`limit-${fieldKey}`}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        disabled={unlimited}
        value={unlimited || empty ? '' : parsed === undefined ? value : String(parsed)}
        placeholder={unlimited ? 'Sin límite' : '0'}
        onChange={(event) => onChange(event.target.value)}
        className={cn('h-9', error && 'border-red-300 focus-visible:ring-red-400')}
      />
      <p className={cn('text-[11px]', error ? 'text-red-600' : 'text-slate-400')}>
        {error ?? `Se muestra como: ${formatPlanLimit(fieldKey, parsed ?? null)}${parsed === 0 ? ' (no incluye)' : ''}`}
      </p>
    </div>
  )
}

export function PlanLimitFields({
  limits,
  onChange,
  className,
}: {
  limits: Record<PlanLimitKey, string>
  onChange: (limits: Record<PlanLimitKey, string>) => void
  className?: string
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      {PLAN_LIMIT_FIELDS.map((field) => (
        <LimitField
          key={field.key}
          fieldKey={field.key}
          label={field.label}
          allowsUnlimited={field.unlimited}
          value={limits[field.key]}
          onChange={(value) => onChange({ ...limits, [field.key]: value })}
        />
      ))}
    </div>
  )
}

// ─── Funciones ────────────────────────────────────────────────────────────────

const GROUP_ORDER: PlanFeatureGroup[] = ['venta', 'operacion', 'gestion', 'servicio']

/** El inventario avanzado se apoya en el básico: si uno está, el otro también. */
const REQUIRED_BY: Record<string, string> = { inventory: 'inventoryAdmin' }

export function toggleWithDependencies(features: Record<string, boolean>, key: string): Record<string, boolean> {
  const next = { ...features, [key]: !features[key] }
  for (const [required, by] of Object.entries(REQUIRED_BY)) if (next[by]) next[required] = true
  return next
}

/** Payload de features con las etiquetas del catálogo (las que lee el trigger). */
export function featurePayload(features: Record<string, boolean>) {
  return PLAN_FEATURES.map((feature) => ({ label: feature.label, value: Boolean(features[feature.key]) }))
}

export function PlanFeatureToggles({
  features,
  onToggle,
}: {
  features: Record<string, boolean>
  onToggle: (key: string) => void
}) {
  return (
    <div className="space-y-5">
      {GROUP_ORDER.map((group) => (
        <div key={group} className="space-y-2">
          <p className="pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{PLAN_FEATURE_GROUP_LABEL[group]}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_FEATURES.filter((feature) => feature.group === group).map((feature) => {
              const Icon = PLAN_FEATURE_ICONS[feature.key] ?? Package
              const enabled = Boolean(features[feature.key])
              const lockedBy = REQUIRED_BY[feature.key]
              const locked = Boolean(lockedBy && features[lockedBy])
              return (
                <button
                  key={feature.key}
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={locked}
                  onClick={() => onToggle(feature.key)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
                    enabled ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20' : 'bg-card hover:bg-muted/50',
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', enabled ? 'text-emerald-600' : 'text-slate-400')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                      {feature.label}
                      {feature.module === null && (
                        <span className="text-[10px] font-medium text-slate-400" title="Se muestra en la venta pero no habilita un módulo.">
                          informativo
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-500">{locked ? 'Lo requiere Inventario avanzado' : feature.hint}</span>
                  </span>
                  {locked
                    ? <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    : enabled
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
