'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildPlanFeatureGroups, buildPlanLimitRows, publicLimitText, selectActivePlans, type SubscriptionPlan } from './saas-plan-presentation'

export type { SubscriptionPlan } from './saas-plan-presentation'

function getPrice(price: number, isCustom?: boolean) {
  if (isCustom) return 'A medida'
  if (!price || price === 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(price)
}

function getPlanTrialDays(plan: SubscriptionPlan) {
  return typeof plan.trial_days === 'number' && plan.trial_days > 0 ? plan.trial_days : 0
}

export function SaaSPlansSection({ initialPlans, headingLevel = 'h2' }: { initialPlans?: SubscriptionPlan[]; headingLevel?: 'h1' | 'h2' }) {
  const [showTable, setShowTable] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const activePlans = selectActivePlans(initialPlans)
  const limitRows = buildPlanLimitRows(activePlans)
  const featureGroups = buildPlanFeatureGroups(activePlans)
  const mobilePlan = activePlans.some(plan => plan.id === selectedPlan) ? selectedPlan : activePlans[0]?.id
  const Heading = headingLevel
  const CardHeading = headingLevel === 'h1' ? 'h2' : 'h3'
  const allFeatures = featureGroups.flatMap(group => group.rows)
  const columnClass = (id: string) => cn('p-3 text-center sm:table-cell sm:p-4', id !== mobilePlan && 'hidden')

  return <section id="planes" className="scroll-mt-24 bg-background py-10 text-foreground sm:py-14">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-primary">Planes para tu negocio</p>
        <Heading className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Elegí el plan que necesitás</Heading>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">Compará precios, capacidad y herramientas incluidas. Cada plan muestra sus límites y los días de prueba disponibles.</p>
      </header>

      {activePlans.length ? <>
        <div className={cn('mt-8 grid gap-4 sm:grid-cols-2', activePlans.length === 3 ? 'lg:grid-cols-3' : activePlans.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-2')}>
          {activePlans.map((plan, index) => {
            const trialDays = getPlanTrialDays(plan)
            const previous = activePlans[index - 1]
            const included = allFeatures.filter(row => row.values[plan.id] && row.group !== 'servicio')
            const added = previous ? included.filter(row => !row.values[previous.id]) : []
            const highlights = [...added, ...included.filter(row => !added.includes(row))].slice(0, 5)
            return <article key={plan.id} aria-label={`Plan ${plan.name}`} className={cn('flex min-w-0 flex-col rounded-xl border bg-card p-5 sm:p-6', plan.is_popular && 'border-primary ring-1 ring-primary')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardHeading className="text-xl font-semibold">{plan.name}</CardHeading>
                {plan.is_popular && <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Destacado</span>}
              </div>
              {plan.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>}
              <div className="mt-5">
                <p className="text-3xl font-bold tracking-tight tabular-nums">{getPrice(plan.price, plan.custom)}{plan.price > 0 && !plan.custom && <span className="ml-1 text-sm font-normal text-muted-foreground">/mes</span>}</p>
                {plan.price_note && <p className="mt-1 text-xs text-muted-foreground">{plan.price_note}</p>}
                {trialDays > 0 && <p className="mt-2 text-sm font-medium text-primary">{trialDays} días de prueba</p>}
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-2 border-y py-4">
                {(['users', 'products', 'branches'] as const).map((key, index) => <div key={key} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{['Usuarios', 'Productos', 'Sucursales'][index]}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold tabular-nums">{publicLimitText(key, plan.limits?.[key])}</dd>
                </div>)}
              </dl>
              <ul className="my-5 space-y-2 text-sm" aria-label={`Herramientas de ${plan.name}`}>
                {highlights.map(feature => <li key={feature.key} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{feature.label}</span></li>)}
              </ul>
              <Link href={plan.custom ? '/saas' : `/register?plan=${encodeURIComponent(plan.public_slug || plan.tier)}`} className={cn('mt-auto flex min-h-11 items-center justify-center rounded-lg px-3 py-3 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', plan.is_popular ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                {plan.custom ? 'Consultar opciones' : trialDays > 0 ? `Probar ${trialDays} días gratis` : 'Comenzar ahora'}
              </Link>
            </article>
          })}
        </div>

        <details className="mt-6 rounded-lg border p-4 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-medium">¿Necesitás ayuda para elegir un plan?</summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">Empezá por la cantidad de usuarios, productos y sucursales de tu negocio. Después compará las herramientas que necesitás; la tabla indica qué incluye cada plan. Los límites corresponden a toda la organización.</p>
        </details>
        <div className="mt-6 text-center">
          <Button type="button" variant="outline" className="min-h-11 max-w-full whitespace-normal" aria-expanded={showTable} aria-controls="saas-plan-comparison" onClick={() => setShowTable(value => !value)}>
            {showTable ? 'Ocultar comparativa detallada' : 'Ver todas las características y módulos comparados'}<ChevronDown className={cn('h-4 w-4 shrink-0', showTable && 'rotate-180')} />
          </Button>
        </div>
        {showTable && <div id="saas-plan-comparison" className="mt-5">
          <div className="mb-3 sm:hidden">
            <label htmlFor="saas-comparison-plan" className="mb-2 block text-sm font-medium">Plan para comparar</label>
            <select id="saas-comparison-plan" value={mobilePlan} onChange={event => setSelectedPlan(event.target.value)} className="min-h-11 w-full rounded-lg border bg-background px-3 text-base">
              {activePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm sm:min-w-[720px]">
              <caption className="sr-only">Comparación detallada de características por plan</caption>
              <thead className="bg-muted/50"><tr>
                <th scope="col" className="p-3 font-medium sm:p-4">Capacidad y herramientas</th>
                {activePlans.map(plan => <th key={plan.id} scope="col" className={columnClass(plan.id)}>{plan.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{getPrice(plan.price, plan.custom)}{plan.price > 0 && !plan.custom ? '/mes' : ''}</span></th>)}
              </tr></thead>
              <tbody>
                {limitRows.map(row => <tr key={row.key} className="border-t"><th scope="row" className="p-3 font-normal sm:p-4">{row.label}</th>{activePlans.map(plan => <td key={plan.id} className={columnClass(plan.id)}>{row.values[plan.id]}</td>)}</tr>)}
                {featureGroups.map(group => [
                  <tr key={group.group} className="border-t bg-muted/50"><th colSpan={activePlans.length + 1} className="p-3 text-xs font-semibold sm:p-4">{group.label}</th></tr>,
                  ...group.rows.map(feature => <tr key={feature.key} className="border-t"><th scope="row" className="p-3 font-normal sm:p-4">{feature.label}<span className="mt-1 block text-xs text-muted-foreground">{feature.hint}</span></th>{activePlans.map(plan => <td key={plan.id} className={columnClass(plan.id)}><span aria-hidden="true">{feature.values[plan.id] ? '✓' : '—'}</span><span className="sr-only">{feature.label} {feature.values[plan.id] ? 'incluido' : 'no incluido'} en {plan.name}</span></td>)}</tr>),
                ])}
              </tbody>
            </table>
          </div>
        </div>}
      </> : <div role="status" className="mt-8 rounded-xl border p-6 text-center"><h3 className="font-semibold">No hay planes disponibles en este momento</h3><p className="mt-2 text-sm text-muted-foreground">No pudimos mostrar un catálogo vigente. Volvé a consultar más adelante.</p></div>}

      <div className="mx-auto mt-10 max-w-3xl space-y-3 border-t pt-6">
        <CardHeading className="text-lg font-semibold">Antes de elegir</CardHeading>
        <details className="rounded-lg border p-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">¿Cómo funciona la prueba?</summary><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Si un plan incluye prueba, sus días aparecen en la tarjeta. Podés probar las herramientas incluidas en ese plan, no las de otros planes.</p></details>
        <details className="rounded-lg border p-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">¿Qué pasa al alcanzar un límite?</summary><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Revisá el uso de tu organización antes de elegir. Para agregar recursos por encima del cupo necesitás un plan con mayor capacidad.</p></details>
      </div>
    </div>
  </section>
}
