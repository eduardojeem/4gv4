'use client'

import { useMemo, useState, type ElementType } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  FileText,
  Globe,
  Layers,
  Loader2,
  LockKeyhole,
  Save,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'

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

const moduleIcons: Record<OrganizationModule, ElementType> = {
  inventory: Boxes,
  inventory_admin: Layers,
  pos: CreditCard,
  crm: Users,
  orders: ShoppingBag,
  ecommerce: Globe,
  repairs: Wrench,
  services: FileText,
  credits: Coins,
  delivery: Truck,
  analytics: TrendingUp,
  promotions: Tag,
  security: LockKeyhole,
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
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Perfil y módulos del negocio
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs sm:text-sm">
                Adaptá el sistema a tu actividad. Desactivar un módulo oculta sus herramientas, pero conserva todos sus datos.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-xs font-medium text-primary">
            Plan {profile.planName}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {/* Estado actual guardado */}
        <section
          aria-label="Configuración actual del negocio"
          className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-card via-muted/30 to-muted/10 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <h3 className="text-sm font-semibold text-foreground">Rubro actual</h3>
            </div>
            <Badge variant="secondary" className="text-[11px] font-normal text-muted-foreground">
              Configuración guardada para esta organización.
            </Badge>
          </div>

          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border bg-background/80 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Actividad principal</dt>
                <dd data-testid="current-business-vertical" className="truncate text-sm font-semibold text-foreground">
                  {verticalLabels[profile.businessVertical]}
                </dd>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-background/80 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Forma de trabajo actual</dt>
                <dd data-testid="current-operating-model" className="truncate text-sm font-semibold text-foreground">
                  {modelLabels[profile.operatingModel]}
                </dd>
              </div>
            </div>
          </dl>

          {dirty ? (
            <div role="status" className="mt-3 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Tenés cambios pendientes. El rubro actual seguirá vigente hasta guardar el perfil.
            </div>
          ) : null}
        </section>

        {/* Selectores de Rubro y Forma de trabajo */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-vertical" className="text-xs font-medium text-foreground">
              Rubro
            </Label>
            <Select value={vertical} onValueChange={value => setVertical(value as BusinessVertical)}>
              <SelectTrigger id="business-vertical" aria-label="Rubro" className="h-10 border-border/80 bg-background transition-colors hover:border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(verticalLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Especializa el catálogo, categorías y sugerencias.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operating-model" className="text-xs font-medium text-foreground">
              Forma de trabajo
            </Label>
            <Select value={model} onValueChange={value => setModel(value as OperatingModel)}>
              <SelectTrigger id="operating-model" aria-label="Forma de trabajo" className="h-10 border-border/80 bg-background transition-colors hover:border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modelLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Ajusta el flujo entre ventas directas, órdenes o servicios.</p>
          </div>
        </div>

        {/* Recomendaciones y Planes Superiores */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className="flex flex-col justify-between rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-sm"
            aria-labelledby="recommended-modules-title"
          >
            <div>
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="recommended-modules-title" className="text-sm font-semibold text-foreground">
                    Recomendado para {verticalLabels[vertical]}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Basado también en “{modelLabels[model]}”. Solo se activan herramientas incluidas en tu plan.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestedModules.map(module => (
                  <Badge
                    key={module}
                    variant={entitled.has(module) ? 'secondary' : 'outline'}
                    className={cn(
                      'text-[11px]',
                      entitled.has(module)
                        ? 'border-primary/30 bg-primary/15 font-medium text-primary dark:bg-primary/25'
                        : 'border-dashed text-muted-foreground'
                    )}
                  >
                    {moduleLabels[module]}{entitled.has(module) ? '' : ' · requiere otro plan'}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 w-fit border-primary/30 bg-background/80 text-xs font-medium hover:bg-primary/10"
              onClick={enableSuggestedModules}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Activar recomendados incluidos
            </Button>
          </section>

          <section
            className="flex flex-col justify-between rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm"
            aria-labelledby="higher-plan-modules-title"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <LockKeyhole className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 id="higher-plan-modules-title" className="text-sm font-semibold text-foreground">
                      Disponible en planes superiores
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Herramientas bloqueadas y el plan que permite habilitarlas.
                    </p>
                  </div>
                </div>

                <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-medium text-primary hover:text-primary">
                  <Link href="/admin/subscriptions/change-plan">
                    Ver planes <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              {higherPlanModules.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {higherPlanModules.map(({ module, plans }) => (
                    <li
                      key={module}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {moduleLabels[module]} — {plans.map(plan => plan.name).join(', ')}
                      </span>
                      {plans.every(plan => !plan.isActive) ? (
                        <Badge variant="outline" className="text-[10px]">Plan inactivo</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  Tu plan ya incluye todas las herramientas disponibles en planes superiores activos.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Matriz de Herramientas Visibles */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Herramientas visibles</h3>
                <Badge variant="secondary" className="text-[11px] font-normal">
                  Plan actual: {profile.planName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Cada herramienta indica si depende del plan o de la configuración de la organización.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={applySuggestedModules}
              >
                Aplicar recomendación
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={enableAllEntitledModules}
              >
                Activar todo lo incluido
              </Button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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

              const IconComponent = moduleIcons[module] ?? Boxes

              return (
                <label
                  key={module}
                  className={cn(
                    'group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all select-none',
                    isEntitled
                      ? checked
                        ? 'border-primary/50 bg-primary/[0.04] shadow-xs hover:border-primary'
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/30'
                      : 'cursor-not-allowed border-dashed border-border/60 bg-muted/20 opacity-75'
                  )}
                >
                  <div className="pt-0.5">
                    <Checkbox
                      checked={checked}
                      disabled={!isEntitled}
                      onCheckedChange={value => toggleModule(module, value === true)}
                      aria-label={moduleLabels[module]}
                      className={cn(
                        'transition-transform duration-150 group-hover:scale-105',
                        checked && 'border-primary data-[state=checked]:bg-primary'
                      )}
                    />
                  </div>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <IconComponent className={cn('h-4 w-4 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')} />
                      {moduleLabels[module]}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                      {availabilityText}
                    </span>
                  </span>

                  <div className="shrink-0 pt-0.5">
                    {isEntitled ? (
                      checked ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )
                    ) : (
                      <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {enabled.length} de {ORGANIZATION_MODULES.length} herramientas activadas
            </Badge>
          </div>
          <Button
            onClick={save}
            disabled={!dirty || saving}
            className="gap-2 sm:min-w-44"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Guardando perfil…' : 'Guardar perfil'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
