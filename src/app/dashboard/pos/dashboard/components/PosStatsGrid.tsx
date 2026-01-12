import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    TrendingUp,
    ShoppingCart,
    Package,
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { PosStats } from "../hooks/usePosStats"

interface PosStatsGridProps {
    stats: PosStats
}

export function PosStatsGrid({ stats }: PosStatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                    <GSIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                        En el periodo seleccionado
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                    <p className="text-xs text-muted-foreground">
                        Tickets generados
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${stats.averageTicket.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                        Promedio por venta
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Producto Top</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.topProduct.sales}</div>
                    <p className="text-xs text-muted-foreground truncate" title={stats.topProduct.name}>{stats.topProduct.name}</p>
                </CardContent>
            </Card>
        </div>
    )
}
