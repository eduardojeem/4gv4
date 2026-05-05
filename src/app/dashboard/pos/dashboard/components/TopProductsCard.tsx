import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PosStats } from "../hooks/usePosStats"
import { formatCurrency } from '@/lib/currency'
import { TrendingUp, Package } from 'lucide-react'

interface TopProductsCardProps {
  products: PosStats['topProducts']
}

export function TopProductsCard({ products }: TopProductsCardProps) {
  return (
    <Card className="col-span-3 border-border/60 shadow-sm overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center">
          <TrendingUp className="mr-2 h-4 w-4 text-amber-600" />
          Top Productos
          <span className="ml-auto text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
            Más vendidos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-card">
            <div className="p-3 bg-muted/50 rounded-full mb-3">
              <Package className="h-6 w-6 opacity-40" />
            </div>
            <p className="font-medium text-sm">No hay datos disponibles</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 p-2 space-y-1">
            {products.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 border border-amber-100 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400 font-bold text-xs shadow-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-foreground line-clamp-1" title={product.name}>
                      {product.name}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold tabular-nums text-foreground">{product.sales} <span className="text-[10px] uppercase text-muted-foreground font-semibold">u.</span></p>
                  <p className="text-[10px] font-medium text-muted-foreground tabular-nums bg-muted/40 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                    {formatCurrency(product.revenue || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
