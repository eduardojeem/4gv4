'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
    MoreVertical,
    Edit,
    Copy,
    Trash2,
    Power,
    PowerOff,
    Percent,
    Tag,
    Calendar as CalendarIcon,
    TrendingUp,
    AlertTriangle
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/lib/currency'
import type { Promotion } from '@/types/promotion'

interface PromotionCardProps {
    promotion: Promotion
    status: 'active' | 'scheduled' | 'expired' | 'inactive'
    isExpiringSoon: boolean
    onEdit: (promotion: Promotion) => void
    onDelete: (promotion: Promotion) => void
    onDuplicate: (promotion: Promotion) => void
    onToggleStatus: (promotion: Promotion) => void
}

export function PromotionCard({
    promotion,
    status,
    isExpiringSoon,
    onEdit,
    onDelete,
    onDuplicate,
    onToggleStatus
}: PromotionCardProps) {
    const statusConfig = {
        active: {
            label: 'Activa',
            className: 'bg-emerald-100 text-emerald-700 border-emerald-300'
        },
        scheduled: {
            label: 'Programada',
            className: 'bg-blue-100 text-blue-700 border-blue-300'
        },
        expired: {
            label: 'Expirada',
            className: 'bg-gray-100 text-gray-700 border-gray-300'
        },
        inactive: {
            label: 'Inactiva',
            className: 'bg-red-100 text-red-700 border-red-300'
        }
    }

    const usagePercent = promotion.usage_limit
        ? ((promotion.usage_count || 0) / promotion.usage_limit) * 100
        : 0

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{promotion.name}</h3>
                            {isExpiringSoon && (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                                {promotion.code}
                            </code>
                            <Badge variant="outline" className={statusConfig[status].className}>
                                {statusConfig[status].label}
                            </Badge>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(promotion)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicate(promotion)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleStatus(promotion)}>
                                {promotion.is_active ? (
                                    <>
                                        <PowerOff className="h-4 w-4 mr-2" />
                                        Desactivar
                                    </>
                                ) : (
                                    <>
                                        <Power className="h-4 w-4 mr-2" />
                                        Activar
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => onDelete(promotion)}
                                className="text-red-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Description */}
                {promotion.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {promotion.description}
                    </p>
                )}

                {/* Discount Value */}
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    {promotion.type === 'percentage' ? (
                        <Percent className="h-5 w-5 text-primary" />
                    ) : (
                        <Tag className="h-5 w-5 text-primary" />
                    )}
                    <div>
                        <div className="text-2xl font-bold">
                            {promotion.type === 'percentage'
                                ? `${promotion.value}%`
                                : formatCurrency(promotion.value)
                            }
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {promotion.type === 'percentage' ? 'Descuento' : 'Monto fijo'}
                        </div>
                    </div>
                </div>

                {/* Dates */}
                <div className="space-y-2">
                    {promotion.start_date && (
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Inicio:</span>
                            <span className="font-medium">
                                {format(parseISO(promotion.start_date), "d 'de' MMM yyyy", { locale: es })}
                            </span>
                        </div>
                    )}
                    {promotion.end_date && (
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Fin:</span>
                            <span className={`font-medium ${isExpiringSoon ? 'text-amber-600' : ''}`}>
                                {format(parseISO(promotion.end_date), "d 'de' MMM yyyy", { locale: es })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Usage */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Uso:</span>
                        </div>
                        <span className="font-medium">
                            {promotion.usage_count || 0}
                            {promotion.usage_limit && ` / ${promotion.usage_limit}`}
                        </span>
                    </div>
                    {promotion.usage_limit && (
                        <Progress value={usagePercent} className="h-2" />
                    )}
                </div>

                {/* Additional info */}
                {promotion.min_purchase && (
                    <div className="text-xs text-muted-foreground">
                        Compra mínima: {formatCurrency(promotion.min_purchase)}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
