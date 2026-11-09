'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, LayoutTemplate, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import {
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATE_GROUPS,
  type StorefrontStyle,
  type StorefrontStylePreference,
} from '@/lib/website/storefront-style'
import {
  STOREFRONT_TEMPLATE_TIER,
  TEMPLATE_TIER_LABEL,
  defaultTemplatesForPlan,
} from '@/lib/website/template-plan-access'
import type { PlanCode } from '@/lib/saas/plan-features'
import type { TemplateUsage } from '@/lib/website/template-usage'
import { cn } from '@/lib/utils'

interface PlanEntry {
  code: PlanCode
  name: string
  isActive: boolean
  customized: boolean
  templates: StorefrontStylePreference[]
}

const labelOf = (style: StorefrontStylePreference) =>
  STOREFRONT_STYLE_OPTIONS.find((option) => option.value === style)?.label ?? style

/**
 * Matriz plantilla × plan. Cada columna es un plan técnico; se guarda por plan.
 * Una tienda conserva la plantilla que ya usa aunque se la saquen a su plan:
 * solo deja de poder elegirla de nuevo si cambia a otra.
 */
export function StorefrontTemplatePlansManager() {
  const [usage, setUsage] = useState<TemplateUsage | null>(null)
  const [usageError, setUsageError] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/superadmin/storefront-templates/usage', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('usage unavailable')
        return response.json()
      })
      .then(body => { if (!cancelled) setUsage(body.usage) })
      .catch(() => { if (!cancelled) setUsageError(true) })
    return () => { cancelled = true }
  }, [])
  const [plans, setPlans] = useState<PlanEntry[] | null>(null)
  const [draft, setDraft] = useState<Record<string, StorefrontStylePreference[]>>({})
  const [saving, setSaving] = useState<PlanCode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/superadmin/storefront-templates')
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || 'No se pudieron leer los planes.')
        return body.plans as PlanEntry[]
      })
      .then((loaded) => {
        if (cancelled) return
        setPlans(loaded)
        setDraft(Object.fromEntries(loaded.map((plan) => [plan.code, plan.templates])))
      })
      .catch((reason: Error) => !cancelled && setError(reason.message))
    return () => { cancelled = true }
  }, [])

  const dirty = useMemo(() => {
    const set = new Set<PlanCode>()
    for (const plan of plans ?? []) {
      const current = draft[plan.code] ?? []
      if (current.length !== plan.templates.length || current.some((style) => !plan.templates.includes(style))) set.add(plan.code)
    }
    return set
  }, [plans, draft])

  const toggle = (code: PlanCode, style: StorefrontStylePreference) => {
    setDraft((current) => {
      const list = current[code] ?? []
      const next = list.includes(style) ? list.filter((item) => item !== style) : [...list, style]
      return { ...current, [code]: next }
    })
  }

  const save = async (code: PlanCode) => {
    const templates = draft[code] ?? []
    if (templates.length === 0) {
      toast.error('El plan necesita al menos una plantilla.')
      return
    }
    setSaving(code)
    try {
      const response = await fetch('/api/superadmin/storefront-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: code, templates }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo guardar.')
      const loaded = body.plans as PlanEntry[]
      setPlans(loaded)
      setDraft((current) => ({ ...current, [code]: loaded.find((plan) => plan.code === code)?.templates ?? templates }))
      toast.success('Plantillas del plan guardadas.')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo guardar.')
    } finally {
      setSaving(null)
    }
  }

  if (error) {
    return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
  }
  if (!plans) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Cargando planes…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutTemplate aria-hidden="true" className="h-6 w-6 text-primary" />
          Plantillas por plan
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Elegí qué plantillas de tienda puede usar cada plan. Las tiendas ven las demás con candado y el plan desde el que
          están. Quien ya usa una plantilla la conserva aunque se la saques al plan; solo no puede volver a elegirla si cambia a otra.
          «Automático» se habilita solo si la plantilla que elige para el rubro también está en el plan.
        </p>
      </header>

      <section aria-label="Uso de plantillas" className="rounded-xl border bg-muted/20 p-4 text-sm">
        <h2 className="font-semibold">Uso por empresa</h2>
        <p className="mt-1 text-muted-foreground">La columna Empresas cuenta la plantilla seleccionada por cada organización, incluyendo cuentas inactivas. Automático se cuenta aparte; no se suma a la plantilla que resuelve por rubro.</p>
        {usageError ? <p role="alert" className="mt-2 text-destructive">No se pudo consultar el uso. Recargá la página para reintentar.</p> : usage ? (
          <p className="mt-2 font-medium">{usage.total} empresas en total · {usage.unconfigured} sin plantilla seleccionada{usage.unknown > 0 ? ' · ' + usage.unknown + ' con configuración no reconocida' : ''}</p>
        ) : <p role="status" className="mt-2 text-muted-foreground">Consultando empresas…</p>}
      </section>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Plantillas habilitadas por plan</caption>
          <thead className="bg-muted/40">
            <tr>
              <th scope="col" className="p-3 text-left font-semibold">Plantilla</th>
              <th scope="col" className="p-3 text-center font-semibold">Empresas</th>
              {plans.map((plan) => (
                <th key={plan.code} scope="col" className="p-3 text-center font-semibold">
                  <span className="block">{plan.name}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {plan.code}{!plan.isActive && ' · inactivo'}{!plan.customized && ' · por defecto'}
                  </span>
                  <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                    {(draft[plan.code] ?? []).length} plantillas
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {STOREFRONT_TEMPLATE_GROUPS.map((group) => (
            <tbody key={group.id} className="border-t">
              <tr className="bg-muted/20">
                <th colSpan={plans.length + 2} scope="colgroup" className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </th>
              </tr>
              {group.templateKeys.map((style) => (
                <tr key={style} className="border-t border-border/50">
                  <th scope="row" className="p-3 text-left font-normal">
                    <span className="flex items-center gap-3">
                      {style !== 'auto' && (
                        <StorefrontTemplateThumbnail style={style as StorefrontStyle} className="hidden h-10 w-14 shrink-0 rounded border sm:flex" />
                      )}
                      <span>
                        <span className="block font-medium">{labelOf(style)}</span>
                        <span className={cn(
                          'text-[11px]',
                          STOREFRONT_TEMPLATE_TIER[style] === 'premium' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                        )}>
                          {TEMPLATE_TIER_LABEL[STOREFRONT_TEMPLATE_TIER[style]]}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="p-3 text-center"><span className="inline-flex min-w-10 justify-center rounded-full bg-primary/10 px-3 py-1 font-semibold tabular-nums text-primary" aria-label={labelOf(style) + ': ' + (usage ? usage.counts[style] + ' empresas' : 'sin datos')}>{usage ? usage.counts[style] : '—'}</span></td>
                  {plans.map((plan) => (
                    <td key={plan.code} className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                        checked={(draft[plan.code] ?? []).includes(style)}
                        onChange={() => toggle(plan.code, style)}
                        aria-label={`${labelOf(style)} en el plan ${plan.name}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot className="border-t bg-muted/20">
            <tr>
              <td colSpan={2} className="p-3 text-xs text-muted-foreground">Los cambios se guardan por plan.</td>
              {plans.map((plan) => (
                <td key={plan.code} className="space-y-1.5 p-3 text-center">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={!dirty.has(plan.code) || saving !== null}
                    onClick={() => save(plan.code)}
                  >
                    {saving === plan.code ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Save aria-hidden="true" className="h-3.5 w-3.5" />}
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => setDraft((current) => ({ ...current, [plan.code]: defaultTemplatesForPlan(plan.code) }))}
                  >
                    <RotateCcw aria-hidden="true" className="h-3 w-3" />
                    Por defecto
                  </Button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
