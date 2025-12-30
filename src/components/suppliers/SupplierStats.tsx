'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Star, Clock, ShoppingCart } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { SupplierStats as Stats } from '@/hooks/use-suppliers'

interface SupplierStatsProps {
    stats: Stats
    loading?: boolean
    onStatClick?: (filter: 'all' | 'active' | 'inactive' | 'pending') => void
}

export function SupplierStats({ stats, loading, onStatClick }: SupplierStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Suppliers */}
            <Card
                className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => onStatClick?.('active')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Proveedores Activos</CardTitle>
                    <CheckCircle className="h-5 w-5 opacity-80" />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-16 bg-white/20" />
                            <Skeleton className="h-4 w-24 bg-white/20" />
                        </div>
                    ) : (
                        <>
                            <div className="text-3xl font-bold">{stats.active_suppliers}</div>
                            <p className="text-xs opacity-80 mt-1">
                                {stats.total_suppliers > 0
                                    ? `${((stats.active_suppliers / stats.total_suppliers) * 100).toFixed(1)}% del total`
                                    : '0% del total'}
                            </p>
                            <div className="mt-2">
                                <Progress
                                    value={stats.total_suppliers > 0 ? (stats.active_suppliers / stats.total_suppliers) * 100 : 0}
                                    className="h-2 bg-white/20"
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Average Rating */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Calificación Promedio</CardTitle>
                    <Star className="h-5 w-5 opacity-80 fill-current" />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-16 bg-white/20" />
                            <Skeleton className="h-4 w-32 bg-white/20" />
                        </div>
                    ) : (
                        <>
                            <div className="text-3xl font-bold">{stats.avg_rating.toFixed(1)}</div>
                            <div className="flex items-center gap-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`h-3 w-3 ${i < Math.round(stats.avg_rating) ? 'fill-current' : 'opacity-30'}`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs opacity-80 mt-1">
                                Basado en {stats.total_suppliers} evaluaciones
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Total Orders */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Total Pedidos</CardTitle>
                    <ShoppingCart className="h-5 w-5 opacity-80" />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-20 bg-white/20" />
                            <Skeleton className="h-4 w-24 bg-white/20" />
                        </div>
                    ) : (
                        <>
                            <div className="text-3xl font-bold">{stats.total_orders.toLocaleString()}</div>
                            <p className="text-xs opacity-80 mt-1">
                                Pedidos procesados
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Total Amount */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Monto Total</CardTitle>
                    <Clock className="h-5 w-5 opacity-80" />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-24 bg-white/20" />
                            <Skeleton className="h-4 w-28 bg-white/20" />
                        </div>
                    ) : (
                        <>
                            <div className="text-3xl font-bold">{formatCurrency(stats.total_amount)}</div>
                            <p className="text-xs opacity-80 mt-1">
                                Valor total comprado
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
