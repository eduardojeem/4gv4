'use client'

import { useMemo, useState } from 'react'
import { Building2, Check, Loader2, LockKeyhole, Wrench } from 'lucide-react'
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
  const dirty = vertical !== profile.businessVertical
    || model !== profile.operatingModel
    || JSON.stringify([...enabled].sort()) !== JSON.stringify([...(profile.enabledModules ?? profile.effectiveModules)].sort())

  const applyPreset = (nextVertical: BusinessVertical, nextModel: OperatingModel) => {
    setVertical(nextVertical)
    setModel(nextModel)
    setEnabled(getSuggestedModules(nextVertical, nextModel).filter(module => entitled.has(module)))
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
            <Select value={vertical} onValueChange={value => applyPreset(value as BusinessVertical, model)}>
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
            <Select value={model} onValueChange={value => applyPreset(vertical, value as OperatingModel)}>
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

        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">Herramientas visibles</h3>
              <p className="text-xs text-muted-foreground">Cada herramienta indica si depende del plan o de la configuración de la organización.</p>
            </div>
            <Badge variant="secondary">Plan actual: {profile.planName}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ORGANIZATION_MODULES.map(module => {
              const isEntitled = entitled.has(module)
              const checked = enabled.includes(module) && isEntitled
              const trial = trialByModule.get(module)
              const availablePlans = profile.modulePlanAvailability?.[module] ?? []
              const availabilityText = trial
                ? `Prueba habilitada: ${trial.daysLeft} ${trial.daysLeft === 1 ? 'día restante' : 'días restantes'}`
                : isEntitled
                  ? checked
                    ? `Incluido en ${profile.planName} y habilitado`
                    : `Incluido en ${profile.planName}, pero desactivado para esta organización`
                  : availablePlans.length > 0
                    ? `No incluido en ${profile.planName}. Disponible en ${availablePlans.join(', ')}`
                    : `No incluido en el plan ${profile.planName}`
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
