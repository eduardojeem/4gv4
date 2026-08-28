import { Loader2, Coins, Zap, Trophy, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { LOYALTY_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { useLoyalty } from '@/hooks/use-loyalty'
import { LoyaltySettingsCard } from './LoyaltySettingsCard'
import { PointRulesCard } from './PointRulesCard'
import { RafflesManager } from './RafflesManager'
import { LoyaltyModuleNotice } from './LoyaltyModuleNotice'

export function LoyaltyRafflesPanel({ canManage }: { canManage: boolean }) {
  const {
    settings,
    rules,
    raffles,
    loading,
    moduleInstalled,
    moduleMessage,
    saveSettings,
    createRule,
    toggleRule,
    deleteRule,
    createRaffle,
    updateRaffleStatus,
    drawRaffle,
    refresh,
  } = useLoyalty()

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
        Cargando puntos y sorteos...
      </div>
    )
  }

  if (!moduleInstalled) {
    return <LoyaltyModuleNotice message={moduleMessage} />
  }

  const activeRulesCount = rules.filter((r) => r.is_active).length
  const activeRafflesCount = raffles.filter((r) => r.status === 'published').length

  return (
    <div className="flex flex-col gap-6">
      {/* Resumen Superior Rápido */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 p-4.5 dark:border-slate-800 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-cyan-950/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              Centro de Puntos y Sorteos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Premia la lealtad de tus clientes: acumulan puntos en cada compra y participan en sorteos certificados.
            </p>
          </div>
          <SectionGuideButton guide={LOYALTY_GUIDE} buttonLabel="¿Cómo funciona el flujo?" />
        </div>

        {/* 3 Tarjetas de Estado en Vivo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-amber-200/70 bg-white p-3 shadow-2xs dark:border-amber-900/30 dark:bg-slate-900 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 font-bold">
              <Coins className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tasa de Puntos</span>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {settings?.enabled
                  ? `Gs. ${Number(settings.currency_per_point).toLocaleString('es-PY')} = 1 pt`
                  : 'Desactivado'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200/70 bg-white p-3 shadow-2xs dark:border-indigo-900/30 dark:bg-slate-900 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Campañas Especiales</span>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {activeRulesCount} {activeRulesCount === 1 ? 'activa' : 'activas'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-200/70 bg-white p-3 shadow-2xs dark:border-cyan-900/30 dark:bg-slate-900 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400 font-bold">
              <Trophy className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Sorteos Abiertos</span>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {activeRafflesCount} {activeRafflesCount === 1 ? 'en juego' : 'en juego'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bloque 1: Configuración de Acumulación */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-xs font-extrabold shadow-xs">
            1
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Regla Base de Puntos por Compra
          </h3>
        </div>
        <LoyaltySettingsCard settings={settings} onSave={saveSettings} canManage={canManage} />
      </section>

      {/* Bloque 2: Multiplicadores y Campañas Temporales */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-extrabold shadow-xs">
            2
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Campañas y Multiplicadores de Puntos
          </h3>
        </div>
        <PointRulesCard
          rules={rules}
          onCreate={createRule}
          onToggle={toggleRule}
          onDelete={deleteRule}
          canManage={canManage}
        />
      </section>

      {/* Bloque 3: Sorteos y Ganadores */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white text-xs font-extrabold shadow-xs">
            3
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Sorteos, Tickets y Ganadores
          </h3>
        </div>
        <RafflesManager
          raffles={raffles}
          onCreate={createRaffle}
          onUpdateStatus={updateRaffleStatus}
          onDraw={drawRaffle}
          onRefresh={refresh}
          canManage={canManage}
        />
      </section>
    </div>
  )
}
