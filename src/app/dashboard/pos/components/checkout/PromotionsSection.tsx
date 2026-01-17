/**
 * Componente para gestión de promociones en el checkout
 * Permite aplicar códigos promocionales y ver promociones disponibles
 */

'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tag, Sparkles, X, TrendingUp, Percent, Gift } from 'lucide-react'
import { CartItem } from '../../types'
import type { Promotion } from '@/types/promotion'

interface PromotionsSectionProps {
  cart: CartItem[]
  cartTotal: number
  allPromotions: Promotion[]
  onApplyPromoCode: (code: string) => void
  formatCurrency: (amount: number) => string
}

export function PromotionsSection({
  cart,
  cartTotal,
  allPromotions,
  onApplyPromoCode,
  formatCurrency
}: PromotionsSectionProps) {
  const [promoCode, setPromoCode] = useState('')

  // Obtener promociones aplicadas del carrito
  const appliedPromotions = useMemo(() => {
    const promoCodes = new Set<string>()
    cart.forEach(item => {
      if (item.promoCode) {
        promoCodes.add(item.promoCode)
      }
    })
    
    return Array.from(promoCodes).map(code => {
      const promo = allPromotions.find(p => p.code.toLowerCase() === code.toLowerCase())
      if (!promo) return null
      
      // Calcular descuento aplicado
      const itemsWithPromo = cart.filter(item => item.promoCode === code)
      const discount = itemsWithPromo.reduce((sum, item) => {
        const itemDiscount = (item.discount || 0) / 100
        return sum + (item.price * item.quantity * itemDiscount)
      }, 0)
      
      return {
        code: promo.code,
        name: promo.name,
        type: promo.type,
        value: promo.value,
        discount_amount: discount
      }
    }).filter(Boolean)
  }, [cart, allPromotions])

  // Obtener promociones disponibles (activas y aplicables)
  const availablePromotions = useMemo(() => {
    const now = new Date()
    
    return allPromotions.filter(promo => {
      // Debe estar activa
      if (!promo.is_active) return false
      
      // Verificar fechas
      if (promo.start_date && new Date(promo.start_date) > now) return false
      if (promo.end_date && new Date(promo.end_date) < now) return false
      
      // Verificar compra mínima
      if (promo.min_purchase && cartTotal < promo.min_purchase) return false
      
      // Verificar límite de uso
      if (promo.usage_limit && promo.usage_count && promo.usage_count >= promo.usage_limit) return false
      
      // No mostrar si ya está aplicada
      if (appliedPromotions.some(ap => ap?.code === promo.code)) return false
      
      return true
    }).slice(0, 3) // Mostrar máximo 3 sugerencias
  }, [allPromotions, cartTotal, appliedPromotions])

  const handleApplyCode = () => {
    if (promoCode.trim()) {
      onApplyPromoCode(promoCode.trim())
      setPromoCode('')
    }
  }

  const totalPromotionSavings = appliedPromotions.reduce((sum, promo) => {
    return sum + (promo?.discount_amount || 0)
  }, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Promociones
        </h3>
        {appliedPromotions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {appliedPromotions.length} aplicada{appliedPromotions.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Campo para ingresar código promocional */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Código Promocional</label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyCode()
              }
            }}
            placeholder="Ingrese código"
            className="uppercase"
          />
          <Button
            variant="outline"
            onClick={handleApplyCode}
            disabled={!promoCode.trim()}
          >
            Aplicar
          </Button>
        </div>
      </div>

      {/* Promociones aplicadas */}
      {appliedPromotions.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-300 mb-2">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium text-sm">Promociones Aplicadas</span>
          </div>
          
          {appliedPromotions.map((promo) => (
            promo && (
              <div key={promo.code} className="flex items-center justify-between text-sm bg-white dark:bg-green-950/30 p-2 rounded border border-green-200 dark:border-green-800">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-green-900 dark:text-green-200 truncate">
                    {promo.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-300 dark:border-green-700">
                      {promo.code}
                    </Badge>
                    <span className="text-xs text-green-700 dark:text-green-400">
                      {promo.type === 'percentage' ? `${promo.value}%` : formatCurrency(promo.value)}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-2">
                  <div className="font-bold text-green-600 dark:text-green-400">
                    -{formatCurrency(promo.discount_amount)}
                  </div>
                </div>
              </div>
            )
          ))}

          {totalPromotionSavings > 0 && (
            <div className="pt-2 border-t border-green-200 dark:border-green-800 flex justify-between items-center">
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                Ahorro Total:
              </span>
              <span className="text-base font-bold text-green-600 dark:text-green-400">
                -{formatCurrency(totalPromotionSavings)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Promociones disponibles (sugerencias) */}
      {availablePromotions.length > 0 && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 mb-2">
            <Gift className="h-4 w-4" />
            <span className="font-medium text-sm">Promociones Disponibles</span>
          </div>
          
          <div className="space-y-2">
            {availablePromotions.map((promo) => (
              <button
                key={promo.code}
                onClick={() => onApplyPromoCode(promo.code)}
                className="w-full flex items-center justify-between p-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-purple-900 dark:text-purple-200 truncate">
                    {promo.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-purple-300 dark:border-purple-700">
                      {promo.code}
                    </Badge>
                    {promo.min_purchase && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400">
                        Min: {formatCurrency(promo.min_purchase)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="text-right">
                    <div className="font-bold text-purple-600 dark:text-purple-400">
                      {promo.type === 'percentage' ? (
                        <span className="flex items-center gap-1">
                          {promo.value}
                          <Percent className="h-3 w-3" />
                        </span>
                      ) : (
                        formatCurrency(promo.value)
                      )}
                    </div>
                    <div className="text-[10px] text-purple-500 dark:text-purple-500">
                      {promo.type === 'percentage' ? 'Descuento' : 'OFF'}
                    </div>
                  </div>
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay promociones */}
      {appliedPromotions.length === 0 && availablePromotions.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No hay promociones disponibles</p>
          <p className="text-xs mt-1">Ingrese un código para aplicar una promoción</p>
        </div>
      )}
    </div>
  )
}
