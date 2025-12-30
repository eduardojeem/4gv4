'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Download,
    FileText,
    Filter,
    RefreshCw,
    AlertCircle,
    Clock
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface CreditQuickActionsProps {
    onRefresh: () => void
    onExportCSV: () => void
    onFilterOverdue?: () => void
    onFilterDueToday?: () => void
    loading?: boolean
    overdueCount?: number
    dueTodayCount?: number
}

export function CreditQuickActions({
    onRefresh,
    onExportCSV,
    onFilterOverdue,
    onFilterDueToday,
    loading = false,
    overdueCount = 0,
    dueTodayCount = 0
}: CreditQuickActionsProps) {
    return (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Quick Filter Chips */}
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                            Acciones rápidas:
                        </span>

                        {onFilterOverdue && overdueCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
                                onClick={onFilterOverdue}
                            >
                                <AlertCircle className="h-4 w-4 mr-1 text-red-600" />
                                Vencidas
                                <Badge variant="secondary" className="ml-2 bg-red-600 text-white">
                                    {overdueCount}
                                </Badge>
                            </Button>
                        )}

                        {onFilterDueToday && dueTodayCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                onClick={onFilterDueToday}
                            >
                                <Clock className="h-4 w-4 mr-1 text-orange-600" />
                                Vencen hoy
                                <Badge variant="secondary" className="ml-2 bg-orange-600 text-white">
                                    {dueTodayCount}
                                </Badge>
                            </Button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={onRefresh}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={onExportCSV}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Exportar
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
