'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Building2, Check, Loader2, LockKeyhole, Sparkles, Wrench } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import {
  ORGANIZATION_MODULES,
  getSuggestedModules,
  type BusinessVertical,
  type OperatingModel,
  type OrganizationModule,
} from '@/lib/organization/business-profile'

const verticalLabels: Record<BusinessVertical, string> = {
  general: 'Comercio general',
  clothing: 'Ropa y moda',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Electrónica y tecnología',
  food: 'Alimentos',
  hardware: 'Ferretería',
  other: 'Otro rubro',
}

const modelLabels: Record<OperatingModel, string> = {
  retail: 'Venta minorista',
  wholesale: 'Venta mayorista',
  service: 'Prestación de servicios',
  repair: 'Taller y reparaciones',
  mixed: 'Negocio mixto',
}

const moduleLabels: Record<OrganizationModule, string> = {
  inventory: 'Inventario',
  inventory_admin: 'Inventario avanzado',
  pos: 'Punto de venta',
  crm: 'Clientes',
  orders: 'Pedidos',
  ecommerce: 'Tienda en línea',
  repairs: 'Reparaciones',
  services: 'Servicios',
  credits: 'Créditos y cuotas',
  delivery: 'Entregas',
  analytics: 'Analítica',
  promotions: 'Promociones',
  security: 'Seguridad y auditoría',
}

export function BusinessProfileCard() {
  const router = useRouter()
  const profile = useSubscriptionStatus()
  const [vertical, setVertical] = useState(profile.businessVertical)
  const [model, setModel] = useState(profile.operatingModel)
  const [enabled, setEnabled] = useState<OrganizationModule[]>(
    profile.enabledModules ?? profile.effectiveModules,
  )
  const [saving, setSaving] = useState(false)
  const entitled = useMemo(
    () => new Set([...profile.entitledModules, ...profile.moduleTrials.map(trial => trial.module)]),
    [profile.entitledModules, profile.moduleTrials],
  )
  const trialByModule = useMemo(
    () => new Map(profile.moduleTrials.map(trial => [trial.module, trial])),
    [profile.moduleTrials],
  )
  const suggestedModules = useMemo(
    () => getSuggestedModules(vertical, model),
    [vertical, model],
  )
  const recommendedIncluded = suggestedModules.filter(module => entitled.has(module))
  const currentPlanRank = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 }[profile.planCode] ?? 0
  const higherPlanModules = ORGANIZATION_MODULES.flatMap(module => {
    if (entitled.has(module)) return []
    const plans = (profile.modulePlanAvailability?.[module] ?? []).filter(plan => {
      const rank = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 }[plan.name.toUpperCase() as 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE']
      return rank === undefined || rank > currentPlanRank
    })
    return plans.length > 0 ? [{ module, plans }] : []
  })
  const dirty = vertical !== profile.businessVertical
    || model !== profile.operatingModel
    || JSON.stringify([...enabled].sort()) !== JSON.stringify([...(profile.enabledModules ?? profile.effectiveModules)].sort())

  const applySuggestedModules = () => {
    const modulesToDisable = enabled.filter(module => !recommendedIncluded.includes(module))
    if (
      modulesToDisable.length > 0
      && !window.confirm(
        `Aplicar la recomendación desactivará ${modulesToDisable.length} ${modulesToDisable.length === 1 ? 'herramienta' : 'herramientas'}. Los datos se conservarán. ¿Querés continuar?`,
      )
    ) return
    setEnabled(recommendedIncluded)
  }

  const enableSuggestedModules = () => {
    setEnabled(current => Array.from(new Set([...current, ...recommendedIncluded])))
  }

  const enableAllEntitledModules = () => {
    setEnabled(ORGANIZATION_MODULES.filter(module => entitled.has(module)))
  }

  const toggleModule = (module: OrganizationModule, checked: boolean) => {
    setEnabled(current => checked
      ? Array.from(new Set([...current, module]))
      : current.filter(item => item !== module))
  }

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/organization-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessVertical: vertical,
          operatingModel: model,
          enabledModules: enabled,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) throw new Error(body?.error || 'No se pudo guardar el perfil.')
      toast.success('Perfil del negocio actualizado.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-primary">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">Perfil y módulos del negocio</CardTitle>
            <CardDescription className="mt-1">
              Adaptá el sistema a tu actividad. Desactivar un módulo oculta sus herramientas, pero conserva todos sus datos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section
          aria-label="Configuración actual del negocio"
          className="rounded-lg border bg-muted/30 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Rubro actual</h3>
              <p className="text-xs text-muted-foreground">Configuración guardada para esta organización.</p>
            </div>
            <Badge variant="secondary">Guardado</Badge>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Actividad principal</dt>
              <dd data-testid="current-business-vertical" className="mt-0.5 text-sm font-medium">
                {verticalLabels[profile.businessVertical]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Forma de trabajo actual</dt>
              <dd data-testid="current-operating-model" className="mt-0.5 text-sm font-medium">
                {modelLabels[profile.operatingModel]}
              </dd>
            </div>
          </dl>
          {dirty ? (
            <p role="status" className="mt-3 border-t pt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
              Tenés cambios pendientes. El rubro actual seguirá vigente hasta guardar el perfil.
            </p>
          ) : null}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-vertical">Rubro</Label>
            <Select value={vertical} onValueChange={value => setVertical(value as BusinessVertical)}>
              <SelectTrigger id="business-vertical" aria-label="Rubro" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(verticalLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="operating-model">Forma de trabajo</Label>
            <Select value={model} onValueChange={value => setModel(value as OperatingModel)}>
              <SelectTrigger id="operating-model" aria-label="Forma de trabajo" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modelLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-lg border bg-primary/5 p-4" aria-labelledby="recommended-modules-title">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 id="recommended-modules-title" className="text-sm font-semibold">
                  Recomendado para {verticalLabels[vertical]}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Basado también en “{modelLabels[model]}”. Solo se activan herramientas incluidas en tu plan.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestedModules.map(module => (
                <Badge key={module} variant={entitled.has(module) ? 'secondary' : 'outline'}>
                  {moduleLabels[module]}{entitled.has(module) ? '' : ' · requiere otro plan'}
                </Badge>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={enableSuggestedModules}>
              Activar recomendados incluidos
            </Button>
          </section>

          <section className="rounded-lg border p-4" aria-labelledby="higher-plan-modules-title">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="higher-plan-modules-title" className="text-sm font-semibold">Disponible en planes superiores</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Herramientas bloqueadas y el plan que permite habilitarlas.</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/subscriptions/change-plan">
                  Ver planes <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {higherPlanModules.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {higherPlanModules.map(({ module, plans }) => (
                  <li key={module} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                    <span className="font-medium">{moduleLabels[module]} — {plans.map(plan => plan.name).join(', ')}</span>
                    {plans.every(plan => !plan.isActive) ? <Badge variant="outline">Plan inactivo</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Tu plan ya incluye todas las herramientas disponibles en planes superiores activos.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">Herramientas visibles</h3>
              <p className="text-xs text-muted-foreground">Cada herramienta indica si depende del plan o de la configuración de la organización.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Plan actual: {profile.planName}</Badge>
              <Button type="button" variant="outline" size="sm" onClick={applySuggestedModules}>
                Aplicar recomendación
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={enableAllEntitledModules}>
                Activar todo lo incluido
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ORGANIZATION_MODULES.map(module => {
              const isEntitled = entitled.has(module)
              const checked = enabled.includes(module) && isEntitled
              const trial = trialByModule.get(module)
              const availablePlans = profile.modulePlanAvailability?.[module] ?? []
              const activePlanNames = availablePlans.filter(plan => plan.isActive).map(plan => plan.name)
              const inactivePlanNames = availablePlans.filter(plan => !plan.isActive).map(plan => plan.name)
              const availabilityText = trial
                ? `Prueba habilitada: ${trial.daysLeft} ${trial.daysLeft === 1 ? 'día restante' : 'días restantes'}`
                : isEntitled
                  ? checked
                    ? `Incluido en ${profile.planName} y habilitado`
                    : `Incluido en ${profile.planName}, pero desactivado para esta organización`
                  : activePlanNames.length > 0
                    ? `No incluido en ${profile.planName}. Disponible en ${activePlanNames.join(', ')}`
                    : inactivePlanNames.length > 0
                      ? `No incluido en ${profile.planName}. Disponible en ${inactivePlanNames.join(', ')}, pero ese plan no está activo`
                      : `No incluido en el plan ${profile.planName}; no está asignado a otro plan`
              return (
                <label
                  key={module}
                  className="flex min-h-14 items-center gap-3 rounded-lg border p-3 transition-colors has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!isEntitled}
                    onCheckedChange={value => toggleModule(module, value === true)}
                    aria-label={moduleLabels[module]}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {module === 'repairs' ? <Wrench className="h-3.5 w-3.5" /> : null}
                      {moduleLabels[module]}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {availabilityText}
                    </span>
                  </span>
                  {isEntitled
                    ? <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    : <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant="outline" className="w-fit">{enabled.length} herramientas seleccionadas</Badge>
          <Button onClick={save} disabled={!dirty || saving} className="sm:min-w-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar perfil
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
