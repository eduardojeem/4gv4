import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Product } from '@/types/products'

interface ProductQuickActionsProps {
    products: Product[]
    onFilterChange: (filtered: Product[]) => void
}

export function ProductQuickActions({ products, onFilterChange }: ProductQuickActionsProps) {
    const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length
    const outOfStockCount = products.filter(p => p.stock_quantity === 0).length
    const activeCount = products.filter(p => p.is_active).length

    return (
        <Card className="border-0 shadow-md">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Filtros rápidos:</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 hover:bg-blue-50 hover:border-blue-300"
                            onClick={() => {
                                onFilterChange(products)
                                toast.success(`Mostrando todos los productos (${products.length})`)
                            }}
                        >
                            Todos ({products.length})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => {
                                const filtered = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0)
                                onFilterChange(filtered)
                                toast.info(`${filtered.length} productos con bajo stock`)
                            }}
                        >
                            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                            Bajo Stock ({lowStockCount})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => {
                                const filtered = products.filter(p => p.stock_quantity === 0)
                                onFilterChange(filtered)
                                toast.warning(`${filtered.length} productos agotados`)
                            }}
                        >
                            Agotados ({outOfStockCount})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => {
                                const filtered = products.filter(p => p.is_active)
                                onFilterChange(filtered)
                                toast.success(`${filtered.length} productos activos`)
                            }}
                        >
                            Activos ({activeCount})
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
