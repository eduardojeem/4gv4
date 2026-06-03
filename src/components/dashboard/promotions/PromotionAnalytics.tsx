'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { Promotion } from '@/types/promotion'

interface PromotionAnalyticsProps {
  topPerformers: Promotion[]
  unused: Promotion[]
  getUsagePerDay: (promotion: Promotion) => number
  getQuotaPercent: (promotion: Promotion) => number | null
}

export function PromotionAnalytics({
  topPerformers,
  unused,
  getUsagePerDay,
  getQuotaPercent,
}: PromotionAnalyticsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <CardTitle className="text-base">Analytics</CardTitle>
            <span className="text-xs text-slate-400">
              {topPerformers.length} top · {unused.length} sin uso
            </span>
          </div>
          {isExpanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Top performers */}
          {topPerformers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Más usadas</h3>
                <span className="text-xs text-slate-400">por cantidad de aplicaciones</span>
              </div>
              <div className="space-y-3">
                {topPerformers.map((promo, index) => {
                  const usagePerDay = getUsagePerDay(promo)
                  const quotaPercent = getQuotaPercent(promo)
                  return (
                    <div key={promo.id} className="space-y-2 rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="flex h-6 w-6 shrink-0 items-center justify-center p-0 text-xs font-bold"
                          >
                            {index + 1}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{promo.name}</p>
                            <p className="text-xs text-muted-foreground">
                              <strong className="text-slate-900 dark:text-slate-100">{promo.usage_count ?? 0}</strong> usos
                              {usagePerDay > 0 && (
                                <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                                  · {usagePerDay}/día
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {quotaPercent !== null && (
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                              {quotaPercent}%
                            </p>
                            <p className="text-[10px] text-slate-400">cuota usada</p>
                          </div>
                        )}
                      </div>
                      {quotaPercent !== null && (
                        <Progress value={quotaPercent} className="h-1.5" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sin uso */}
          {unused.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-semibold">Sin uso</h3>
                <span className="text-xs text-slate-400">activas pero sin aplicaciones</span>
              </div>
              <div className="space-y-2">
                {unused.slice(0, 5).map((promo) => (
                  <div
                    key={promo.id}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{promo.name}</p>
                      <code className="text-[11px] text-muted-foreground">{promo.code}</code>
                    </div>
                    <Badge variant="outline" className="border-red-300 text-red-600 dark:border-red-900/60 dark:text-red-400">
                      0 usos
                    </Badge>
                  </div>
                ))}
                {unused.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Y {unused.length - 5} más sin uso...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {topPerformers.length === 0 && unused.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <BarChart3 className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p className="text-sm">No hay datos suficientes para mostrar analytics</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
