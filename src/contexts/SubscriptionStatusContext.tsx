'use client'

import { createContext, useContext } from 'react'
import { repairPhotoLimit, canExportReports, type PlanCode, type ModuleTrial } from '@/lib/saas/plan-features'
import type { BusinessVertical, OperatingModel, OrganizationModule } from '@/lib/organization/business-profile'

export type { PlanCode, ModuleTrial }
export { repairPhotoLimit, canExportReports }

export type SubscriptionStatusData = {
  status: string | null
  isBlocked: boolean
  isTrialing: boolean
  trialDaysLeft: number | null
  periodDaysLeft: number | null
  /** Código del plan activo de la organización. */
  planCode: PlanCode
  /** Nombre comercial del plan (para mostrar en avisos). */
  planName: string
  /** Módulos habilitados por el plan (fuente: tabla `plans.modules`). */
  modules: string[]
  /** Nombres de los planes activos que incluyen cada módulo. */
  modulePlanAvailability?: Partial<Record<OrganizationModule, string[]>>
  /** Módulos incluidos por el plan, antes de preferencias de la organización. */
  entitledModules: string[]
  /** Selección de la organización. null conserva todos los módulos contratados. */
  enabledModules: OrganizationModule[] | null
  /** Módulos realmente utilizables: derecho comercial + selección de la organización. */
  effectiveModules: OrganizationModule[]
  businessVertical: BusinessVertical
  operatingModel: OperatingModel
  /** true si la org quedó en FREE por impago (baja de cortesía) → mostrar aviso de reactivación. */
  downgradedFromExpiry: boolean
  /** Trials de módulos activos (no vencidos), con días restantes. */
  moduleTrials: ModuleTrial[]
  /** Módulos que la org ya probó alguna vez (activos o vencidos) → no se puede volver a probar. */
  trialedModules: string[]
  /** Nombre de la organización activa (para branding del layout). */
  organizationName: string | null
  /** Logo de la organización activa (si tiene). */
  organizationLogoUrl: string | null
}

const DEFAULTS: SubscriptionStatusData = {
  status: null,
  isBlocked: false,
  isTrialing: false,
  trialDaysLeft: null,
  periodDaysLeft: null,
  planCode: 'FREE',
  planName: 'Free',
  modules: [],
  entitledModules: [],
  enabledModules: null,
  effectiveModules: [],
  businessVertical: 'general',
  operatingModel: 'retail',
  downgradedFromExpiry: false,
  moduleTrials: [],
  trialedModules: [],
  organizationName: null,
  organizationLogoUrl: null,
}

const SubscriptionStatusContext = createContext<SubscriptionStatusData>(DEFAULTS)

export function SubscriptionStatusProvider({
  value,
  children,
}: {
  value: SubscriptionStatusData
  children: React.ReactNode
}) {
  return (
    <SubscriptionStatusContext.Provider value={value}>
      {children}
    </SubscriptionStatusContext.Provider>
  )
}

export function useSubscriptionStatus() {
  return useContext(SubscriptionStatusContext)
}

/** Hook de conveniencia: ¿el plan actual incluye este módulo? */
export function usePlanModule(module: string): boolean {
  const { modules } = useSubscriptionStatus()
  return modules.includes(module)
}

export function useEffectiveModule(module: OrganizationModule): boolean {
  const { effectiveModules } = useSubscriptionStatus()
  return effectiveModules.includes(module)
}
