import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PosStats } from "../hooks/usePosStats"

interface TopProductsCardProps {
    products: PosStats['topProducts']
}

export function TopProductsCard({ products }: TopProductsCardProps) {
    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Top Productos</CardTitle>
                <CardDescription>Más vendidos en el periodo</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {products.map((product, index) => (
                        <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                    {index + 1}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{product.name}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium">{product.sales} u.</p>
                                <p className="text-xs text-muted-foreground">${product.revenue.toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                            No hay datos disponibles.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
