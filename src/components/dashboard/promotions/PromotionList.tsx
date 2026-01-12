'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    MoreVertical,
    Edit,
    Copy,
    Trash2,
    Power,
    PowerOff,
    Percent,
    Tag,
    AlertTriangle,
    ArrowUpDown
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/lib/currency'
import type { Promotion } from '@/types/promotion'
import { PromotionCard } from './PromotionCard'

interface PromotionListProps {
    promotions: Promotion[]
    loading?: boolean
    getPromotionStatus: (promotion: Promotion) => 'active' | 'scheduled' | 'expired' | 'inactive'
    isPromotionExpiringSoon: (promotion: Promotion) => boolean
    onEdit: (promotion: Promotion) => void
    onDelete: (promotion: Promotion) => void
    onDuplicate: (promotion: Promotion) => void
    onToggleStatus: (promotion: Promotion) => void
}

export function PromotionList({
    promotions,
    loading,
    getPromotionStatus,
    isPromotionExpiringSoon,
    onEdit,
    onDelete,
    onDuplicate,
    onToggleStatus
}: PromotionListProps) {
    const [selectedPromotions, setSelectedPromotions] = useState<Set<string>>(new Set())
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedPromotions)
        if (newSelection.has(id)) {
            newSelection.delete(id)
        } else {
            newSelection.add(id)
        }
        setSelectedPromotions(newSelection)
    }

    const toggleSelectAll = () => {
        if (selectedPromotions.size === promotions.length) {
            setSelectedPromotions(new Set())
        } else {
            setSelectedPromotions(new Set(promotions.map(p => p.id)))
        }
    }

    const getStatusBadge = (status: string) => {
        const config = {
            active: { label: 'Activa', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
            scheduled: { label: 'Programada', className: 'bg-blue-100 text-blue-700 border-blue-300' },
            expired: { label: 'Expirada', className: 'bg-gray-100 text-gray-700 border-gray-300' },
            inactive: { label: 'Inactiva', className: 'bg-red-100 text-red-700 border-red-300' }
        }
        const { label, className } = config[status as keyof typeof config] || config.inactive
        return <Badge variant="outline" className={className}>{label}</Badge>
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (promotions.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay promociones</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        No se encontraron promociones con los filtros aplicados.
                        Intenta ajustar los filtros o crea una nueva promoción.
                    </p>
                </CardContent>
            </Card>
        )
    }

    // Grid view for mobile
    if (viewMode === 'grid') {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {promotions.map((promotion) => (
                    <PromotionCard
                        key={promotion.id}
                        promotion={promotion}
                        status={getPromotionStatus(promotion)}
                        isExpiringSoon={isPromotionExpiringSoon(promotion)}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        onToggleStatus={onToggleStatus}
                    />
                ))}
            </div>
        )
    }

    // Table view
    return (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedPromotions.size === promotions.length && promotions.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Promoción</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Uso</TableHead>
                                <TableHead>Fechas</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {promotions.map((promotion) => {
                                const status = getPromotionStatus(promotion)
                                const expiringSoon = isPromotionExpiringSoon(promotion)

                                return (
                                    <TableRow key={promotion.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedPromotions.has(promotion.id)}
                                                onCheckedChange={() => toggleSelection(promotion.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{promotion.name}</span>
                                                    {expiringSoon && (
                                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    )}
                                                </div>
                                                <code className="text-xs text-muted-foreground">
                                                    {promotion.code}
                                                </code>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {promotion.type === 'percentage' ? (
                                                    <>
                                                        <Percent className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">Porcentaje</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Tag className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">Fijo</span>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {promotion.type === 'percentage'
                                                ? `${promotion.value}%`
                                                : formatCurrency(promotion.value)
                                            }
                                        </TableCell>
                                        <TableCell>{getStatusBadge(status)}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {promotion.usage_count || 0}
                                                {promotion.usage_limit && (
                                                    <span className="text-muted-foreground">
                                                        {' / '}{promotion.usage_limit}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                {promotion.start_date && (
                                                    <div>
                                                        <span className="text-muted-foreground">Inicio: </span>
                                                        {format(parseISO(promotion.start_date), 'dd/MM/yy')}
                                                    </div>
                                                )}
                                                {promotion.end_date && (
                                                    <div className={expiringSoon ? 'text-amber-600 font-medium' : ''}>
                                                        <span className="text-muted-foreground">Fin: </span>
                                                        {format(parseISO(promotion.end_date), 'dd/MM/yy')}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
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
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
