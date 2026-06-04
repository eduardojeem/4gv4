'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    AlertTriangle,
    TrendingDown,
    CheckCircle2,
    XCircle
} from 'lucide-react'
import type { Promotion, PromotionFilters } from '@/types/promotion'

type AlertFilter = Exclude<PromotionFilters['alert'], 'all'>

interface PromotionAlertsProps {
    expiringSoon: Promotion[]
    unused: Promotion[]
    expiredActive: Promotion[]
    onCleanupExpired?: () => void
    onEdit?: (promotion: Promotion) => void
    /** Aplica un filtro de estado en el listado para ver todas las de esa categoría */
    onViewAll?: (alert: AlertFilter) => void
}

function ViewAllLink({ count, onClick }: { count: number; onClick?: () => void }) {
    if (count <= 3) return null
    if (!onClick) {
        return (
            <p className="pt-2 text-center text-xs text-muted-foreground">
                Y {count - 3} más...
            </p>
        )
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full pt-2 text-center text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
            Ver las {count - 3} restantes →
        </button>
    )
}

export function PromotionAlerts({
    expiringSoon,
    unused,
    expiredActive,
    onCleanupExpired,
    onEdit,
    onViewAll,
}: PromotionAlertsProps) {
    const hasAlerts = expiringSoon.length > 0 || unused.length > 0 || expiredActive.length > 0

    if (!hasAlerts) {
        return (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900 p-2 rounded-full">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                                Todo en orden
                            </h3>
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                No hay alertas pendientes para tus promociones
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-3">
            {/* Expired but still active */}
            {expiredActive.length > 0 && (
                <Card className="border-red-300 bg-red-50/50 dark:bg-red-950/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <XCircle className="h-5 w-5 text-red-600" />
                                <CardTitle className="text-base text-red-900 dark:text-red-100">
                                    Promociones expiradas activas
                                </CardTitle>
                                <Badge variant="destructive">{expiredActive.length}</Badge>
                            </div>
                            {onCleanupExpired && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onCleanupExpired}
                                    className="border-red-300 text-red-700 hover:bg-red-100"
                                >
                                    Desactivar todas
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                            Estas promociones ya expiraron pero siguen activas. Deberías desactivarlas.
                        </p>
                        <div className="space-y-2">
                            {expiredActive.slice(0, 3).map((promo) => (
                                <div
                                    key={promo.id}
                                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-red-200"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{promo.name}</p>
                                        <p className="text-xs text-muted-foreground">{promo.code}</p>
                                    </div>
                                    {onEdit && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onEdit(promo)}
                                        >
                                            Ver
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <ViewAllLink count={expiredActive.length} onClick={onViewAll ? () => onViewAll('expired_active') : undefined} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Expiring soon */}
            {expiringSoon.length > 0 && (
                <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            <CardTitle className="text-base text-amber-900 dark:text-amber-100">
                                Por expirar pronto
                            </CardTitle>
                            <Badge variant="outline" className="border-amber-300 text-amber-700">
                                {expiringSoon.length}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                            Estas promociones expirarán en los próximos 7 días.
                        </p>
                        <div className="space-y-2">
                            {expiringSoon.slice(0, 3).map((promo) => (
                                <div
                                    key={promo.id}
                                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-amber-200"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{promo.name}</p>
                                        <p className="text-xs text-muted-foreground">{promo.code}</p>
                                    </div>
                                    {onEdit && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onEdit(promo)}
                                        >
                                            Editar
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <ViewAllLink count={expiringSoon.length} onClick={onViewAll ? () => onViewAll('expiring_soon') : undefined} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Unused promotions */}
            {unused.length > 0 && (
                <Card className="border-blue-300 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                                Sin uso
                            </CardTitle>
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                                {unused.length}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                            Estas promociones están activas pero no han sido utilizadas.
                        </p>
                        <div className="space-y-2">
                            {unused.slice(0, 3).map((promo) => (
                                <div
                                    key={promo.id}
                                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-blue-200"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{promo.name}</p>
                                        <p className="text-xs text-muted-foreground">{promo.code}</p>
                                    </div>
                                    {onEdit && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onEdit(promo)}
                                        >
                                            Revisar
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <ViewAllLink count={unused.length} onClick={onViewAll ? () => onViewAll('unused') : undefined} />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
