'use client'

import React from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { BarChart } from 'recharts/es6/chart/BarChart'
import { Bar } from 'recharts/es6/cartesian/Bar'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { LineChart } from 'recharts/es6/chart/LineChart'
import { Line } from 'recharts/es6/cartesian/Line'

type ProductData = {
  id?: string
  name: string
  sales: number
  quantity: number
  profit: number
  category?: string
  share?: number
}

type CategoryData = {
  name: string
  sales: number
  quantity: number
  color: string
}

type ProductTrendPoint = {
  date: string
  sales: number
  qty: number
}

interface ReportsProductsTabProps {
  productTopCount: number
  setProductTopCount: (value: number) => void
  productSortBy: 'sales' | 'quantity'
  setProductSortBy: (value: 'sales' | 'quantity') => void
  productCategoryFilter: string
  setProductCategoryFilter: (value: string) => void
  categoryData: CategoryData[]
  selectedProductId: string | null
  setSelectedProductId: (value: string | null) => void
  productData: ProductData[]
  visibleProducts: ProductData[]
  productsChartRef: React.RefObject<HTMLDivElement | null>
  productSalesColor: string
  productQuantityColor: string
  formatPrice: (value: number) => string
  formatFullPrice: (value: number) => string
  selectedProductTrend: ProductTrendPoint[]
  productTrendRef: React.RefObject<HTMLDivElement | null>
  selectedProductSalesColor: string
  selectedProductQtyColor: string
}

export function ReportsProductsTab({
  productTopCount,
  setProductTopCount,
  productSortBy,
  setProductSortBy,
  productCategoryFilter,
  setProductCategoryFilter,
  categoryData,
  selectedProductId,
  setSelectedProductId,
  productData,
  visibleProducts,
  productsChartRef,
  productSalesColor,
  productQuantityColor,
  formatPrice,
  formatFullPrice,
  selectedProductTrend,
  productTrendRef,
  selectedProductSalesColor,
  selectedProductQtyColor
}: ReportsProductsTabProps) {
  return (
    <TabsContent value="products" className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-40">
          <Select value={String(productTopCount)} onValueChange={(v) => setProductTopCount(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Top" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={productSortBy} onValueChange={(v) => setProductSortBy(v as 'sales' | 'quantity')}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Ordenar por Ventas</SelectItem>
              <SelectItem value="quantity">Ordenar por Cantidad</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categoryData.map((c) => (
                <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Select value={selectedProductId ?? 'none'} onValueChange={(v) => setSelectedProductId(v === 'none' ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Producto para tendencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {productData.slice(0, productTopCount).filter((p) => !!p.id).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos Más Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={productsChartRef}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={visibleProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatPrice} />
                <Tooltip
                  formatter={(value: number, n: any) => [n === 'sales' ? formatFullPrice(Number(value)) : String(value), n === 'sales' ? 'Ventas' : 'Cantidad']}
                  contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                  itemStyle={{ color: '#1e293b' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="sales" name="Ventas" fill={productSalesColor} />
                <Bar dataKey="quantity" name="Cantidad" fill={productQuantityColor} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {selectedProductId && selectedProductTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendencia del Producto Seleccionado</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={productTrendRef}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={selectedProductTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM', { locale: es })} />
                  <YAxis yAxisId="left" tickFormatter={formatPrice} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(v: number, n: any) => [n === 'sales' ? formatFullPrice(Number(v)) : String(v), n === 'sales' ? 'Ventas' : 'Unidades']}
                    contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                    itemStyle={{ color: '#1e293b' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Line type="monotone" dataKey="sales" yAxisId="left" stroke={selectedProductSalesColor} strokeWidth={2} dot={{ fill: selectedProductSalesColor }} />
                  <Line type="monotone" dataKey="qty" yAxisId="right" stroke={selectedProductQtyColor} strokeWidth={2} dot={{ fill: selectedProductQtyColor }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-end mt-3">
              <Link href={selectedProductId ? `/dashboard/products/${selectedProductId}` : '/dashboard/products'}>
                <Button variant="outline">Ver detalle del producto</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ranking de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {visibleProducts.map((product, index) => (
              <div
                key={product.name}
                className={`flex items-center justify-between p-3 border rounded ${product.id ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                onClick={() => {
                  if (product.id) setSelectedProductId(String(product.id))
                }}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.quantity} unidades • {product.category}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatFullPrice(product.sales)}</p>
                  <p className="text-xs text-green-600 font-medium">G: {formatFullPrice(product.profit)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => {
              const BOM = '\uFEFF'
              const headers = ['Rank', 'Producto', 'Categoría', 'Ventas', 'Ganancia', 'Cantidad', 'Participación %']
              const rows = visibleProducts.map((p, i) => [String(i + 1), p.name, p.category || '', String(p.sales), String(p.profit), String(p.quantity), ((p.share || 0).toFixed(1))])
              const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
              const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `top-productos-${new Date().toISOString().slice(0, 10)}.csv`
              a.click(); window.URL.revokeObjectURL(url)
            }}>Exportar Top (CSV)</Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}



