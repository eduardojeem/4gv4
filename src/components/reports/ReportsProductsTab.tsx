'use client'

import React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Download } from 'lucide-react'
import { exportProductsSectionPDF } from '@/lib/reports/section-pdf-exporter'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { BarChart } from 'recharts/es6/chart/BarChart'
import { Bar } from 'recharts/es6/cartesian/Bar'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { LineChart } from 'recharts/es6/chart/LineChart'
import { Line } from 'recharts/es6/cartesian/Line'

// Sanitiza una celda CSV: previene inyección de fórmulas y escapa comas/comillas/saltos.
// (Misma lógica que csvCell en reports/page.tsx — este export no la traía y armaba
// las filas con join(',') crudo, así que un nombre de producto con coma corría las
// columnas, y uno que empezara con =/+/-/@ podía ejecutarse como fórmula en Excel.)
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

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
  /** Solo admin/super_admin ve la ganancia. */
  canViewCost?: boolean
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
  selectedProductQtyColor,
  canViewCost = false
}: ReportsProductsTabProps) {
  const maxProductSales = Math.max(1, ...visibleProducts.map((p) => p.sales))

  return (
    <TabsContent value="products" className="space-y-4">
      {/* Barra de Filtros de Productos */}
      <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="w-32">
              <Select value={String(productTopCount)} onValueChange={(v) => setProductTopCount(Number(v))}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="Top" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Top 5</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select value={productSortBy} onValueChange={(v) => setProductSortBy(v as 'sales' | 'quantity')}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ordenar por Ventas</SelectItem>
                  <SelectItem value="quantity">Ordenar por Cantidad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-52">
              <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold">
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
          </div>

          <div className="w-64">
            <Select value={selectedProductId ?? 'none'} onValueChange={(v) => setSelectedProductId(v === 'none' ? null : v)}>
              <SelectTrigger className="h-9 text-xs font-semibold">
                <SelectValue placeholder="Ver tendencia de producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno (sin selección)</SelectItem>
                {productData.slice(0, productTopCount).filter((p) => !!p.id).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Gráfico de Barras */}
      <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Comparativa de Productos Más Vendidos
            </CardTitle>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: productSalesColor }} />
                <span>Facturación (Gs.)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: productQuantityColor }} />
                <span>Unidades</span>
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div ref={productsChartRef}>
            {visibleProducts.length === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">No hay productos que coincidan con los filtros seleccionados.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={visibleProducts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatPrice} />
                  <Tooltip
                    formatter={(value: number, n: any) => [n === 'sales' ? formatFullPrice(Number(value)) : `${value} un.`, n === 'sales' ? 'Ventas' : 'Cantidad']}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="sales" name="Ventas" fill={productSalesColor} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="quantity" name="Cantidad" fill={productQuantityColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tendencia del Producto Seleccionado */}
      {selectedProductId && selectedProductTrend.length > 0 && (
        <Card className="border border-blue-200 dark:border-blue-900/50 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-blue-700 dark:text-blue-300">
                Evolución del Producto Seleccionado
              </CardTitle>
              <Link href={`/dashboard/products/${selectedProductId}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
                  Ver Ficha Completa
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div ref={productTrendRef}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={selectedProductTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                  <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM', { locale: es })} />
                  <YAxis yAxisId="left" tickFormatter={formatPrice} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(v: number, n: any) => [n === 'sales' ? formatFullPrice(Number(v)) : `${v} un.`, n === 'sales' ? 'Ventas' : 'Unidades']}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px', color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="sales" yAxisId="left" stroke={selectedProductSalesColor} strokeWidth={2.5} dot={{ fill: selectedProductSalesColor }} />
                  <Line type="monotone" dataKey="qty" yAxisId="right" stroke={selectedProductQtyColor} strokeWidth={2} strokeDasharray="4 4" dot={{ fill: selectedProductQtyColor }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking y Tabla Detallada de Productos */}
      <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Ranking de Productos y Participación
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Haz clic en cualquier producto para analizar su tendencia individual
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 font-semibold text-xs text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100"
                onClick={() => {
                  if (visibleProducts.length === 0) {
                    toast.warning('No hay productos para exportar con los filtros actuales.')
                    return
                  }
                  exportProductsSectionPDF({
                    title: 'Reporte de Productos Más Vendidos',
                    products: visibleProducts,
                    chartRef: productsChartRef
                  })
                }}
              >
                <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                PDF de Productos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 font-semibold text-xs border-slate-200 dark:border-slate-800"
                onClick={() => {
                  if (visibleProducts.length === 0) {
                    toast.warning('No hay productos para exportar con los filtros actuales.')
                    return
                  }
                  try {
                    const BOM = '\uFEFF'
                    const nowStr = new Date().toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    const totalSalesSum = visibleProducts.reduce((acc, p) => acc + (Number(p.sales) || 0), 0)
                    const totalQtySum = visibleProducts.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
                    const totalProfitSum = visibleProducts.reduce((acc, p) => acc + (Number(p.profit) || 0), 0)
                    const totalMargin = totalSalesSum > 0 ? ((totalProfitSum / totalSalesSum) * 100).toFixed(1) : '0'

                    const metadata = [
                      `# =========================================================================`,
                      `# SISTEMA 4G - RANKING DE PRODUCTOS Y RENDIMIENTO COMERCIAL`,
                      `# Total de Artículos: ${visibleProducts.length}`,
                      `# Generado el: ${nowStr}`,
                      `# Moneda: Guaraníes (PYG / Gs.)`,
                      `# =========================================================================`,
                    ]

                    const headers = [
                      'Posición',
                      'Producto',
                      'Categoría_Comercial',
                      'Unidades_Vendidas',
                      'Precio_Promedio_Unitario_Gs',
                      'Facturación_Total_Gs',
                      'Participación_Pct',
                      ...(canViewCost ? ['Ganancia_Estimada_Gs', 'Margen_Pct'] : [])
                    ]

                    const rows = visibleProducts.map((p, i) => {
                      const s = Number(p.sales) || 0
                      const q = Number(p.quantity) || 0
                      const prof = Number(p.profit) || 0
                      const avgUnit = q > 0 ? Math.round(s / q) : s
                      const share = totalSalesSum > 0 ? ((s / totalSalesSum) * 100).toFixed(1) : ((p.share || 0).toFixed(1))
                      const m = s > 0 ? ((prof / s) * 100).toFixed(1) : '0'

                      return [
                        `#${i + 1}`,
                        p.name,
                        p.category || 'General',
                        q,
                        avgUnit,
                        s,
                        `${share}%`,
                        ...(canViewCost ? [prof, `${m}%`] : [])
                      ]
                    })

                    const summaryRow = [
                      'TOTALES',
                      'CATÁLOGO_PRODUCTOS',
                      '',
                      totalQtySum,
                      '—',
                      totalSalesSum,
                      '100%',
                      ...(canViewCost ? [totalProfitSum, `${totalMargin}%`] : [])
                    ]

                    const csv = [
                      ...metadata,
                      headers.join(','),
                      ...rows.map(r => r.map(csvCell).join(',')),
                      summaryRow.map(csvCell).join(',')
                    ].join('\n')

                    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `ranking-productos-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    window.URL.revokeObjectURL(url)
                    toast.success(`CSV de productos descargado con metadatos y totales (${rows.length} productos).`)
                  } catch (error) {
                    toast.error('No se pudo generar el CSV.', {
                      description: error instanceof Error ? error.message : undefined,
                    })
                  }
                }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="space-y-2.5">
            {visibleProducts.map((product, index) => {
              const widthPct = Math.max(4, Math.round((product.sales / maxProductSales) * 100))
              const isSelected = selectedProductId === product.id

              return (
                <div
                  key={product.name}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                      : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 hover:border-blue-300 dark:hover:border-blue-800 cursor-pointer'
                  }`}
                  onClick={() => {
                    if (product.id) setSelectedProductId(String(product.id))
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        index === 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : index === 1
                          ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          : index === 2
                          ? 'bg-amber-800/10 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                      }`}>
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="font-semibold">{product.quantity} unidades vendidas</span>
                          <span>•</span>
                          <span className="rounded-md border border-border px-1.5 py-0.2 text-[10px]">
                            {product.category || 'Sin categoría'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-base font-bold font-mono text-slate-900 dark:text-white">
                        {formatFullPrice(product.sales)}
                      </p>
                      {canViewCost && (
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Ganancia: {formatFullPrice(product.profit)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Barra de Proporción Relativa */}
                  <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}



