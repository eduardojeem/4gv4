'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { toast } from 'sonner'
import type { PromotionResult } from '@/types/promotion'

interface GlobalPromotionsContextType {
  appliedPromotions: PromotionResult[]
  addPromotion: (promotion: PromotionResult) => void
  removePromotion: (code: string) => void
  clearPromotions: () => void
  getTotalDiscount: () => number
  hasPromotion: (code: string) => boolean
}

const GlobalPromotionsContext = createContext<GlobalPromotionsContextType | undefined>(undefined)

interface ProviderProps {
  children: ReactNode
}

export function GlobalPromotionsProvider({ children }: ProviderProps) {
  const [appliedPromotions, setAppliedPromotions] = useState<PromotionResult[]>([])

  const addPromotion = useCallback((promotion: PromotionResult) => {
    setAppliedPromotions(prev => {
      const filtered = prev.filter(p => p.code !== promotion.code)
      const updated = [...filtered, promotion]
      toast.success(`Promoción ${promotion.code} aplicada`)
      return updated
    })
  }, [])

  const removePromotion = useCallback((code: string) => {
    setAppliedPromotions(prev => {
      const updated = prev.filter(p => p.code !== code)
      toast.info(`Promoción ${code} removida`)
      return updated
    })
  }, [])

  const clearPromotions = useCallback(() => {
    setAppliedPromotions([])
    toast.info('Todas las promociones removidas')
  }, [])

  const getTotalDiscount = useCallback(() => {
    return appliedPromotions
      .filter(p => p.applied)
      .reduce((total, p) => total + p.discount_amount, 0)
  }, [appliedPromotions])

  const hasPromotion = useCallback((code: string) => {
    return appliedPromotions.some(p => p.code === code && p.applied)
  }, [appliedPromotions])

  const contextValue: GlobalPromotionsContextType = {
    appliedPromotions,
    addPromotion,
    removePromotion,
    clearPromotions,
    getTotalDiscount,
    hasPromotion
  }

  return (
    <GlobalPromotionsContext.Provider value={contextValue}>
      {children}
    </GlobalPromotionsContext.Provider>
  )
}

export function useGlobalPromotions() {
  const context = useContext(GlobalPromotionsContext)
  if (context === undefined) {
    throw new Error('useGlobalPromotions must be used within a GlobalPromotionsProvider')
  }
  return context
}