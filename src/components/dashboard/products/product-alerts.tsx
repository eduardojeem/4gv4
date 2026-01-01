import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Product } from '@/types/products'
import { ProductAlert } from '@/types/product-unified'

interface ProductAlertsProps {
    alerts: ProductAlert[]
    products: Product[]
    onFilterChange: (filtered: Product[]) => void
}

export function ProductAlerts({ alerts, products, onFilterChange }: ProductAlertsProps) {
    if (!alerts || alerts.length === 0) return null

    return (
        <Card className="border-0 shadow-md bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50">
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <AlertTriangle className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-amber-900 text-lg">
                                {alerts.length} {alerts.length === 1 ? 'Alerta' : 'Alertas'} de Inventario
                            </h3>
                            <p className="text-sm text-amber-700 mt-1">
                                {alerts.filter(a => a.alert_type === 'out_of_stock').length} productos agotados • {' '}
                                {alerts.filter(a => a.alert_type === 'low_stock').length} con bajo stock
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {alerts.slice(0, 3).map((alert, idx) => (
                                    <Badge key={idx} variant="outline" className="bg-white/50 border-amber-300 text-amber-800">
                                        {alert.message}
                                    </Badge>
                                ))}
                                {alerts.length > 3 && (
                                    <Badge variant="outline" className="bg-white/50 border-amber-300 text-amber-800">
                                        +{alerts.length - 3} más
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        size="default"
                        variant="outline"
                        className="border-amber-300 hover:bg-amber-100 bg-white shadow-sm"
                        onClick={() => {
                            const alertProductIds = alerts.map(a => a.product_id)
                            const alertProducts = products.filter(p => alertProductIds.includes(p.id))
                            onFilterChange(alertProducts)
                            toast.info(`Mostrando ${alertProducts.length} productos con alertas`)
                        }}
                    >
                        Ver Productos
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
