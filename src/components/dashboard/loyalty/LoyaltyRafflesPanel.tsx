'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Coins, Users, Trophy, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLoyalty } from '@/hooks/use-loyalty'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { LoyaltySettingsCard } from './LoyaltySettingsCard'
import { PointRulesCard } from './PointRulesCard'
import { RafflesManager } from './RafflesManager'
import { LoyaltyModuleNotice } from './LoyaltyModuleNotice'
import { LoyaltyProgramCustomers } from './LoyaltyProgramCustomers'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { LOYALTY_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { formatCurrency } from '@/lib/currency'

type Section = 'puntos' | 'clientes' | 'sorteos'

export function LoyaltyRafflesPanel({ canManage }: { canManage: boolean }) {
  const { scope } = useTenantScope()
  return <ScopedLoyaltyPanel key={scope} canManage={canManage} />
}

function ScopedLoyaltyPanel({ canManage }: { canManage: boolean }) {
  const program = useLoyalty()
  const params = useSearchParams()
  const section = params.get('section')
  const [selected, setSelected] = useState<Section | null>(null)
  const tab =
    selected ??
    (section === 'sorteos'
      ? 'sorteos'
      : section === 'clientes' || section === 'resumen'
        ? 'clientes'
        : 'puntos')
  const selectTab = (next: Section) => {
    setSelected(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'puntos')
    url.searchParams.set('section', next)
    window.history.replaceState({}, '', url.toString())
  }
  if (program.loading)
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando fidelización…
      </div>
    )
  if (program.loadError)
    return (
      <div role="alert" className="space-y-3 rounded-2xl border p-6">
        <p>{program.loadError}</p>
        <Button onClick={() => void program.refresh()}>Reintentar</Button>
      </div>
    )
  if (!program.moduleInstalled) return <LoyaltyModuleNotice message={program.moduleMessage} />
  const { settings, rules, raffles } = program
  const mode = settings?.earning_mode ?? 'amount'
  const redemption = Number(settings?.redemption_value) || 0
  const minimum = Number(settings?.min_redemption_points) || 1
  const steps = [
    {
      title: 'El cliente suma',
      text:
        mode === 'visits'
          ? (settings?.points_per_visit ?? 1) + ' puntos por turno atendido y cobrado.'
          : mode === 'both'
            ? 'Puntos por lo pagado y por cada turno atendido y cobrado.'
            : (settings?.points_per_unit ?? 1) +
              ' puntos cada ' +
              formatCurrency(Number(settings?.currency_per_point) || 10000) +
              ' pagados.',
    },
    {
      title: 'Ve su progreso',
      text: 'Consultá su saldo e historial. Los puntos y los turnos se muestran por separado.',
    },
    {
      title: 'Usa su beneficio',
      text:
        redemption > 0
          ? minimum +
            ' puntos equivalen a ' +
            formatCurrency(minimum * redemption) +
            ' de saldo a favor.'
          : 'Definí el valor de los puntos para ofrecer canje por saldo a favor.',
    },
  ]
  const tabs = [
    { id: 'puntos' as const, label: 'Programa', icon: Coins },
    { id: 'clientes' as const, label: 'Clientes y resultados', icon: Users },
    { id: 'sorteos' as const, label: 'Sorteos', icon: Trophy },
  ]
  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
              Clientes que vuelven
            </p>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Fidelización y beneficios
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Premiá a tus clientes con reglas claras. Configurá cómo suman puntos y qué saldo a
              favor pueden obtener para su próxima compra o servicio.
            </p>
          </div>
          <span
            className={
              settings?.enabled
                ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground'
            }
          >
            {settings?.enabled ? 'Programa activo' : 'Programa pausado'}
          </span>
        </div>
        <ol className="grid border-t bg-muted/20 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 p-4 sm:p-5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </header>
      <div className="flex justify-end">
        <SectionGuideButton guide={LOYALTY_GUIDE} buttonLabel="Cómo funciona" />
      </div>
      <nav
        aria-label="Secciones de fidelización"
        className="grid grid-cols-3 gap-1 rounded-xl border bg-muted/40 p-1"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            variant={tab === id ? 'default' : 'ghost'}
            className="h-auto min-h-11 min-w-0 gap-1.5 whitespace-normal px-2 py-2 text-xs sm:text-sm"
            onClick={() => selectTab(id)}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Button>
        ))}
      </nav>
      <div hidden={tab !== 'puntos'} className="space-y-5">
        <LoyaltySettingsCard
          settings={settings}
          onSave={program.saveSettings}
          canManage={canManage}
          serviceVisitsReady={program.serviceVisitsReady}
        />
        <details className="rounded-2xl border bg-card">
          <summary className="cursor-pointer p-5 text-sm font-semibold">
            Bonificaciones y campañas opcionales{' '}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rules.filter((rule) => rule.is_active).length} habilitadas
            </span>
          </summary>
          <div className="space-y-3 border-t p-3 sm:p-5">
            <p className="text-sm text-muted-foreground">
              Se aplica una sola bonificación: la más conveniente. En modo por monto, las reglas
              anteriores de frecuencia cuentan acreditaciones, no turnos. En modo por turnos cuentan
              turnos pagados; las campañas por monto solo aplican cuando ese modo está habilitado.
              Las devoluciones no reinician los hitos ya utilizados.
            </p>
            <PointRulesCard
              earningMode={mode}
            rules={rules}
              onCreate={program.createRule}
              onToggle={program.toggleRule}
              onDelete={program.deleteRule}
              canManage={canManage}
            />
          </div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
          <p className="text-sm">
            Revisá el progreso real de tus clientes antes de ajustar el beneficio.
          </p>
          <Button variant="outline" onClick={() => selectTab('clientes')}>
            Ver clientes
            <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      {tab === 'clientes' && <LoyaltyProgramCustomers settings={settings} />}
      {tab === 'sorteos' && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Sorteos opcionales</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Son independientes del canje por saldo a favor. Definí premios, fechas y condiciones
              antes de publicarlos.
            </p>
          </div>
          <RafflesManager
            raffles={raffles}
            onCreate={program.createRaffle}
            onUpdateStatus={program.updateRaffleStatus}
            onDraw={program.drawRaffle}
            onRefresh={program.refresh}
            canManage={canManage}
          />
        </section>
      )}
    </div>
  )
}
