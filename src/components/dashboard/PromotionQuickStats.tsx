'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Percent,
  Clock,
  Target,
  Zap
} from 'lucide-react'
import { usePromotions } from '@/hooks/use-promotions'
import { formatCurrency } from '@/lib/currency'
import { useMemo } from 'react'

export function PromotionQuickStats() {
  const { promotions, stats } = usePromotions()

  const quickStats = useMemo(() => {
    const activePromotions = promotions.filter(p => p.is_active)
    
    // Promoción más usada
    const mostUsed = activePromotions.reduce((max, promo) => 
      (promo.usage_count || 0) > (max.usage_count || 0) ? promo : max
    , activePromotions[0])

    // Promoción con mejor tasa de conversión
    const bestConversion = activePromotions
      .filter(p => p.usage_limit && p.usage_count)
      .reduce((best, promo) => {
        const currentRate = (promo.usage_count! / promo.usage_limit!) * 100
        const bestRate = best.usage_limit && best.usage_count 
          ? (best.usage_count / best.usage_limit) * 100 
          : 0
        return currentRate > bestRate ? promo : best
      }, activePromotions[0])

    // Valor promedio de descuento
    const avgDiscount = activePromotions.length > 0 
      ? activePromotions.reduce((sum, p) => sum + p.value, 0) / activePromotions.length
      : 0

    // Promociones de alto valor (>50% o >100000)
    const highValueCount = activePromotions.filter(p => 
      (p.type === 'percentage' && p.value > 50) || 
      (p.type === 'fixed' && p.value > 100000)
    ).length

    return {
      mostUsed,
      bestConversion,
      avgDiscount,
      highValueCount,
      conversionRate: bestConversion?.usage_limit && bestConversion?.usage_count 
        ? (bestConversion.usage_count / bestConversion.usage_limit) * 100 
        : 0
    }
  }, [promotions])

  if (promotions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No hay datos de promociones disponibles</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Promoción más popular */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Más Popular</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          {quickStats.mostUsed ? (
            <>
              <div className="text-lg font-bold">{quickStats.mostUsed.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {quickStats.mostUsed.code}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {quickStats.mostUsed.usage_count || 0} usos
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sin datos</div>
          )}
        </CardContent>
      </Card>

      {/* Mejor conversión */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mejor Conversión</CardTitle>
          <Target className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          {quickStats.bestConversion && quickStats.conversionRate > 0 ? (
            <>
              <div className="text-lg font-bold">{quickStats.conversionRate.toFixed(1)}%</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {quickStats.bestConversion.code}
                </Badge>
              </div>
              <Progress value={quickStats.conversionRate} className="h-1 mt-2" />
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sin datos</div>
          )}
        </CardContent>
      </Card>

      {/* Descuento promedio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Descuento Promedio</CardTitle>
          <Percent className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">
            {quickStats.avgDiscount > 0 ? (
              promotions.filter(p => p.is_active && p.type === 'percentage').length > 
              promotions.filter(p => p.is_active && p.type === 'fixed').length
                ? `${quickStats.avgDiscount.toFixed(1)}%`
                : formatCurrency(quickStats.avgDiscount)
            ) : '0'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            En promociones activas
          </p>
        </CardContent>
      </Card>

      {/* Promociones de alto valor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Alto Valor</CardTitle>
          <Zap className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">{quickStats.highValueCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Promociones premium
          </p>
          {quickStats.highValueCount > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
              <span className="text-xs text-orange-600">Descuentos &gt;50%</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}