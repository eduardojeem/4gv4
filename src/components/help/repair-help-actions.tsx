'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type RepairHelpActionId =
  | 'open-new-repair'
  | 'select-repair'
  | 'open-repair-detail'
  | 'open-repair-payment'
  | 'open-repair-delivery'
  | 'open-cash-register'

export type RepairHelpActionResult =
  | { status: 'completed' }
  | { status: 'unavailable'; message: string }

export type RepairHelpActionExecutor = (
  actionId: RepairHelpActionId,
) => Promise<RepairHelpActionResult> | RepairHelpActionResult

const RepairHelpActionsContext = createContext<RepairHelpActionExecutor | undefined>(undefined)

export function RepairHelpActionsProvider({
  execute,
  children,
}: {
  execute?: RepairHelpActionExecutor
  children: ReactNode
}) {
  return (
    <RepairHelpActionsContext.Provider value={execute}>
      {children}
    </RepairHelpActionsContext.Provider>
  )
}

export function useRepairHelpActions() {
  return useContext(RepairHelpActionsContext)
}
