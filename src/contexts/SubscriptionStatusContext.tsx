'use client'

import { createContext, useContext } from 'react'

export type SubscriptionStatusData = {
  status: string | null
  isBlocked: boolean
  isTrialing: boolean
  trialDaysLeft: number | null
  periodDaysLeft: number | null
}

const SubscriptionStatusContext = createContext<SubscriptionStatusData>({
  status: null,
  isBlocked: false,
  isTrialing: false,
  trialDaysLeft: null,
  periodDaysLeft: null,
})

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
