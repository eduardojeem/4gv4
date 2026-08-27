'use client'

import { Loader2 } from 'lucide-react'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { LOYALTY_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { useLoyalty } from '@/hooks/use-loyalty'
import { LoyaltySettingsCard } from './LoyaltySettingsCard'
import { PointRulesCard } from './PointRulesCard'
import { RafflesManager } from './RafflesManager'
import { LoyaltyModuleNotice } from './LoyaltyModuleNotice'

/**
 * Panel de administración de puntos y sorteos.
 *
 * El orden sigue el de la operación: primero se define cuánto vale una compra,
 * después las campañas que dan puntos extra, y al final los sorteos donde esos
 * puntos se gastan.
 */
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
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando puntos y sorteos...
      </div>
    )
  }

  if (!moduleInstalled) {
    return <LoyaltyModuleNotice message={moduleMessage} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Los clientes acumulan puntos al comprar y los canjean por números de sorteo. El saldo lo lleva la base:
          ni el mostrador ni el navegador pueden modificarlo a mano, solo registrar ajustes con motivo.
        </p>
        <SectionGuideButton guide={LOYALTY_GUIDE} buttonLabel="¿Cómo funciona?" />
      </div>

      <LoyaltySettingsCard settings={settings} onSave={saveSettings} canManage={canManage} />

      <PointRulesCard
        rules={rules}
        onCreate={createRule}
        onToggle={toggleRule}
        onDelete={deleteRule}
        canManage={canManage}
      />

      <RafflesManager
        raffles={raffles}
        onCreate={createRaffle}
        onUpdateStatus={updateRaffleStatus}
        onDraw={drawRaffle}
        onRefresh={refresh}
        canManage={canManage}
      />
    </div>
  )
}
