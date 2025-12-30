import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package2, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import { Product } from '@/types/products'

interface ProductStatsProps {
    products: Product[]
}

export function ProductStats({ products }: ProductStatsProps) {
    const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length
    const outOfStockCount = products.filter(p => p.stock_quantity === 0).length
    const totalValue = products.reduce((sum, p) => sum + ((p.sale_price || 0) * p.stock_quantity), 0)

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Products */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-700">Total Productos</p>
                            <p className="text-3xl font-bold text-blue-900">{products.length}</p>
                            <p className="text-xs text-blue-600">En inventario</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg">
                            <Package2 className="h-7 w-7 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Low Stock */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-amber-50 to-amber-100/50">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-amber-700">Bajo Stock</p>
                            <p className="text-3xl font-bold text-amber-900">
                                {lowStockCount}
                            </p>
                            <p className="text-xs text-amber-600">Requieren atención</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg">
                            <AlertTriangle className="h-7 w-7 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Out of Stock */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-red-50 to-red-100/50">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-red-700">Agotados</p>
                            <p className="text-3xl font-bold text-red-900">
                                {outOfStockCount}
                            </p>
                            <p className="text-xs text-red-600">Sin existencias</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg">
                            <TrendingUp className="h-7 w-7 text-white rotate-180" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Total Value */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-green-50 to-green-100/50">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-green-700">Valor Total</p>
                            <p className="text-3xl font-bold text-green-900">
                                ${(totalValue / 1000000).toFixed(1)}M
                            </p>
                            <p className="text-xs text-green-600">En inventario</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg">
                            <DollarSign className="h-7 w-7 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
