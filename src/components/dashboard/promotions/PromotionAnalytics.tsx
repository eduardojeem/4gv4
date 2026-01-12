'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    TrendingUp,
    TrendingDown,
    BarChart3,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import type { Promotion } from '@/types/promotion'

interface PromotionAnalyticsProps {
    topPerformers: Promotion[]
    unused: Promotion[]
    calculateEffectiveness: (promotion: Promotion) => number
}

export function PromotionAnalytics({
    topPerformers,
    unused,
    calculateEffectiveness
}: PromotionAnalyticsProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <Card>
            <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <CardTitle className="text-base">Analytics</CardTitle>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-6">
                    {/* Top Performers */}
                    {topPerformers.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                <h3 className="font-semibold text-sm">Mejores Promociones</h3>
                            </div>
                            <div className="space-y-3">
                                {topPerformers.map((promo, index) => {
                                    const effectiveness = calculateEffectiveness(promo)
                                    return (
                                        <div key={promo.id} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center p-0">
                                                        {index + 1}
                                                    </Badge>
                                                    <div>
                                                        <p className="font-medium text-sm">{promo.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {promo.usage_count || 0} usos
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-emerald-600">
                                                        {effectiveness}% efectivo
                                                    </p>
                                                </div>
                                            </div>
                                            <Progress value={effectiveness} className="h-2" />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Underperformers */}
                    {unused.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                <h3 className="font-semibold text-sm">Sin Rendimiento</h3>
                            </div>
                            <div className="space-y-2">
                                {unused.slice(0, 5).map((promo) => (
                                    <div
                                        key={promo.id}
                                        className="flex items-center justify-between p-2 bg-muted rounded"
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{promo.name}</p>
                                            <p className="text-xs text-muted-foreground">{promo.code}</p>
                                        </div>
                                        <Badge variant="outline" className="text-red-600 border-red-300">
                                            0 usos
                                        </Badge>
                                    </div>
                                ))}
                                {unused.length > 5 && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        Y {unused.length - 5} más sin usar...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {topPerformers.length === 0 && unused.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay suficientes datos para mostrar analytics</p>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    )
}
