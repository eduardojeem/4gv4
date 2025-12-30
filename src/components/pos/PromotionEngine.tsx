'use client'

import { useState, useEffect } from 'react'
import { 
  Tag, 
  Percent, 
  X, 
  Plus, 
  Check, 
  AlertCircle,
  Loader2,
  Gift
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { Separator } from "@/components/ui/separator"
import { formatCurrency } from '@/lib/currency'
import { usePromotionEngine } from '@/hooks/use-promotion-engine'
import { usePromotions } from '@/hooks/use-promotions'
import type { CartItem, Promotion } from '@/types/promotion'
import { toast } from 'sonner'

interface PromotionEngineProps {
  cart: CartItem[]
  onPromotionsChange?: (promotions: any[]) => void
}

export function PromotionEngine({ cart, onPromotionsChange }: PromotionEngineProps) {
  const [promotionCode, setPromotionCode] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [showAvailable, setShowAvailable] = useState(false)
  
  const { promotions: allPromotions } = usePromotions()
  
  const {
    appliedPromotions,
    calculateCartSummary,
    applyPromotionByCode,
    getAvailablePromotions,
    previewPromotion,
    getPromotionInsights,
    addAppliedPromotion,
    removeAppliedPromotion,
    handlePromotionError,
    handlePromotionSuccess
  } = usePromotionEngine({
    max_promotions_per_order: 3,
    allow_stacking: true,
    auto_apply_best_promotion: false
  })

  // Get active promotions only
  const activePromotions = allPromotions.filter(p => p.is_active)
  
  // Calculate cart summary with current promotions
  const cartSummary = calculateCartSummary(
    cart, 
    activePromotions, 
    appliedPromotions.map(p => p.code)
  )

  // Get available promotions for current cart
  const availablePromotions = getAvailablePromotions(cart, activePromotions)
  
  // Get insights for current cart
  const insights = getPromotionInsights(cart, activePromotions)

  // Notify parent component of changes
  useEffect(() => {
    if (onPromotionsChange) {
      onPromotionsChange(cartSummary.applied_promotions)
    }
  }, [cartSummary.applied_promotions, onPromotionsChange])

  const handleApplyCode = async () => {
    if (!promotionCode.trim()) {
      toast.error('Ingresa un código de promoción')
      return
    }

    setIsApplying(true)
    try {
      const result = applyPromotionByCode(promotionCode.trim(), cart, activePromotions)
      
      if (result.applied) {
        addAppliedPromotion(result)
        handlePromotionSuccess(result)
        setPromotionCode('')
      } else {
        handlePromotionError(result.reason || 'Código inválido', result.code)
      }
    } catch (error) {
      handlePromotionError('Error al aplicar promoción')
    } finally {
      setIsApplying(false)
    }
  }

  const handleRemovePromotion = (code: string) => {
    removeAppliedPromotion(code)
    toast.success('Promoción removida')
  }

  const handleApplyAvailable = (promotion: Promotion) => {
    const result = applyPromotionByCode(promotion.code, cart, activePromotions)
    
    if (result.applied) {
      addAppliedPromotion(result)
      handlePromotionSuccess(result)
      setShowAvailable(false)
    } else {
      handlePromotionError(result.reason || 'No se pudo aplicar', result.code)
    }
  }

  if (cart.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Gift className="mx-auto h-8 w-8 mb-2" />
            <p>Agrega productos para ver promociones disponibles</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Applied Promotions */}
      {appliedPromotions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Promociones Aplicadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appliedPromotions.map((promo) => (
              <div key={promo.code} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {promo.code}
                  </Badge>
                  <span className="text-sm font-medium">{promo.name}</span>
                  <div className="flex items-center gap-1 text-green-600">
                    {promo.type === 'percentage' ? (
                      <Percent className="h-3 w-3" />
                    ) : (
                      <span className="text-xs">$</span>
                    )}
                    <span className="text-sm font-medium">
                      -{formatCurrency(promo.discount_amount)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePromotion(promo.code)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Apply Promotion Code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Aplicar Código de Promoción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Ingresa código de promoción"
              value={promotionCode}
              onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCode()}
              className="flex-1"
            />
            <Button 
              onClick={handleApplyCode} 
              disabled={isApplying || !promotionCode.trim()}
              size="sm"
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Promotions */}
      {availablePromotions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Promociones Disponibles ({availablePromotions.length})
              </span>
              <Dialog open={showAvailable} onOpenChange={setShowAvailable}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Ver Todas
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Promociones Disponibles</DialogTitle>
                    <DialogDescription>
                      Selecciona una promoción para aplicar a tu carrito
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {availablePromotions.map((promo) => {
                      const preview = previewPromotion(promo.code, cart, activePromotions)
                      return (
                        <div key={promo.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {promo.code}
                                </Badge>
                                <span className="font-medium text-sm">{promo.name}</span>
                              </div>
                              {promo.description && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  {promo.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>
                                  Descuento: {promo.type === 'percentage' ? `${promo.value}%` : formatCurrency(promo.value)}
                                </span>
                                {promo.min_purchase && (
                                  <span>Min: {formatCurrency(promo.min_purchase)}</span>
                                )}
                              </div>
                              {preview.valid && (
                                <div className="mt-2 text-sm font-medium text-green-600">
                                  Ahorras: {formatCurrency(preview.discount)}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleApplyAvailable(promo)}
                              disabled={!preview.valid}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Aplicar
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {availablePromotions.slice(0, 2).map((promo) => {
                const preview = previewPromotion(promo.code, cart, activePromotions)
                return (
                  <div key={promo.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {promo.code}
                      </Badge>
                      <span className="text-sm">{promo.name}</span>
                      {preview.valid && (
                        <span className="text-xs text-green-600 font-medium">
                          -{formatCurrency(preview.discount)}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyAvailable(promo)}
                      disabled={!preview.valid}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cart Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>{formatCurrency(cartSummary.subtotal)}</span>
          </div>
          
          {cartSummary.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento:</span>
              <span>-{formatCurrency(cartSummary.discount_amount)}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span>IVA (10%):</span>
            <span>{formatCurrency(cartSummary.tax_amount)}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between font-medium">
            <span>Total:</span>
            <span>{formatCurrency(cartSummary.total)}</span>
          </div>
          
          {cartSummary.discount_amount > 0 && (
            <div className="text-center text-sm text-green-600 font-medium">
              ¡Ahorras {formatCurrency(cartSummary.discount_amount)}!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.bestPromotion && !appliedPromotions.some(p => p.code === insights.bestPromotion?.code) && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ¡Promoción recomendada!
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                  Usa el código <Badge variant="secondary" className="mx-1">{insights.bestPromotion.code}</Badge> 
                  y ahorra {formatCurrency(insights.bestPromotion.discount_amount)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    const bestPromo = activePromotions.find(p => p.code === insights.bestPromotion?.code)
                    if (bestPromo) {
                      handleApplyAvailable(bestPromo)
                    }
                  }}
                >
                  Aplicar Ahora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}