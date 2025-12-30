import React from 'react';
import { formatCurrency } from '@/lib/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { GSIcon } from '@/components/ui/standardized-components'

interface ProductStatsData {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  topCategories: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  recentTrends: {
    productsAdded: number;
    productsRemoved: number;
    averagePrice: number;
    priceChange: number;
  };
}

interface ProductStatsProps {
  data: ProductStatsData;
  className?: string;
}

const ProductStats: React.FC<ProductStatsProps> = ({
  data,
  className = ''
}) => {
  const {
    totalProducts,
    totalValue,
    lowStockItems,
    outOfStockItems,
    topCategories,
    recentTrends
  } = data;

  const stockHealthPercentage = totalProducts > 0 
    ? ((totalProducts - lowStockItems - outOfStockItems) / totalProducts) * 100 
    : 100;

  

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {/* Total Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Productos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(totalProducts)}</div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              +{recentTrends.productsAdded} añadidos
            </Badge>
            {recentTrends.productsRemoved > 0 && (
              <Badge variant="secondary" className="text-xs">
                -{recentTrends.productsRemoved} eliminados
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Total Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor Total del Inventario</CardTitle>
          <GSIcon className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          <div className="flex items-center gap-1 mt-2 text-sm">
            <span className="text-muted-foreground">Precio promedio:</span>
            <span className="font-medium">{formatCurrency(recentTrends.averagePrice)}</span>
            {recentTrends.priceChange !== 0 && (
              <div className="flex items-center gap-1">
                {recentTrends.priceChange > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={`text-xs ${recentTrends.priceChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(recentTrends.priceChange).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stock Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Salud del Stock</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stockHealthPercentage.toFixed(1)}%</div>
          <Progress value={stockHealthPercentage} className="mt-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Stock saludable</span>
            <span>{formatNumber(totalProducts - lowStockItems - outOfStockItems)} productos</span>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{formatNumber(lowStockItems)}</div>
          <p className="text-xs text-muted-foreground mt-2">
            Productos que requieren reposición
          </p>
          {lowStockItems > 0 && (
            <Badge variant="outline" className="mt-2 text-yellow-600 border-yellow-600">
              Requiere atención
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Out of Stock */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatNumber(outOfStockItems)}</div>
          <p className="text-xs text-muted-foreground mt-2">
            Productos no disponibles
          </p>
          {outOfStockItems > 0 && (
            <Badge variant="destructive" className="mt-2">
              Acción urgente
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Top Categories */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Categorías Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topCategories.slice(0, 5).map((category, index) => (
              <div key={category.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{category.name}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(category.count)} ({category.percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={category.percentage} className="h-2" />
              </div>
            ))}
            
            {topCategories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay datos de categorías disponibles
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductStats;
