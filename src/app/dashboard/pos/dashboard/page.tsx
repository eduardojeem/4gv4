"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { Legend } from 'recharts/es6/component/Legend';
import { 
  TrendingUp, 
  ShoppingCart, 
  Package,
  Calendar,
  CreditCard,
  Clock,
  ArrowLeft,
  Loader2
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { format, subDays, startOfDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

// Tipos
interface Sale {
  id: string
  created_at: string
  total: number
  payment_method: string
  customer?: { name: string } | null
  items_count?: number
   
  sale_items?: any[]
}

type DateFilter = 'today' | 'week' | 'month'

export default function POSDashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [topProducts, setTopProducts] = useState<{name: string, sales: number, revenue: number}[]>([])

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Calcular rango de fechas
        const now = new Date()
        let startDate: Date
        
        switch (dateFilter) {
          case 'today':
            startDate = startOfDay(now)
            break
          case 'week':
            startDate = subDays(startOfDay(now), 7)
            break
          case 'month':
            startDate = subDays(startOfDay(now), 30)
            break
          default:
            startDate = startOfDay(now)
        }

        // Fetch sales
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select(`
            id,
            created_at,
            total:total_amount,
            payment_method,
            customer:customers(name),
            sale_items(quantity)
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })

        if (salesError) throw salesError

        // Process sales data
         
        const processedSales = (salesData || []).map((sale: any) => ({
          ...sale,
           
          items_count: sale.sale_items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0,
          customer_name: sale.customer?.name || 'Cliente Casual'
        }))

        setSales(processedSales)

        // Fetch top products (sale_items joined with products)
        // We fetch sale_items for the sales in the period
        const saleIds = processedSales.map(s => s.id)
        
        if (saleIds.length > 0) {
           const { data: topItemsData, error: topItemsError } = await supabase
            .from('sale_items')
            .select(`
              quantity,
              total:subtotal,
              product:products(name)
            `)
            .in('sale_id', saleIds)

            if (!topItemsError && topItemsData) {
              const productMap = new Map<string, {name: string, sales: number, revenue: number}>()
              
               
              topItemsData.forEach((item: any) => {
                const name = item.product?.name || 'Producto eliminado'
                const existing = productMap.get(name) || { name, sales: 0, revenue: 0 }
                existing.sales += item.quantity
                existing.revenue += item.total
                productMap.set(name, existing)
              })

              const sortedProducts = Array.from(productMap.values())
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 5)
              
              setTopProducts(sortedProducts)
            }
        } else {
            setTopProducts([])
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', JSON.stringify(error, null, 2))
        // Fallback logging for Error objects which don't stringify well
        if (error instanceof Error) {
            console.error(error.message, error.stack)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFilter, supabase])

  // Calcular KPIs
  const kpis = useMemo(() => {
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
    const totalTransactions = sales.length
    const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0
    const topProduct = topProducts[0] || { name: "N/A", sales: 0 }
    
    return {
      totalSales,
      totalTransactions,
      averageTicket,
      topProduct
    }
  }, [sales, topProducts])

  // Datos para gráfico de ventas por día
  const dailySalesData = useMemo(() => {
    const daysMap = new Map<string, { date: string, fullDate: string, sales: number, transactions: number }>()
    
    // Initialize days depending on filter
    const daysCount = dateFilter === 'month' ? 30 : 7
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = subDays(new Date(), i)
        const key = format(d, 'dd/MM')
        daysMap.set(key, {
            date: key,
            fullDate: format(d, 'EEEE dd/MM/yyyy', { locale: es }),
            sales: 0,
            transactions: 0
        })
    }

    sales.forEach(sale => {
        const d = parseISO(sale.created_at)
        const key = format(d, 'dd/MM')
        if (daysMap.has(key)) {
            const entry = daysMap.get(key)!
            entry.sales += sale.total
            entry.transactions += 1
        }
    })

    return Array.from(daysMap.values())
  }, [sales, dateFilter])

  // Datos para gráfico de métodos de pago
  const paymentMethodsData = useMemo(() => {
    const methodsMap = new Map<string, number>()
    
    sales.forEach(sale => {
        const method = sale.payment_method || 'Otros'
        // Normalize names
        let name = method
        if (method === 'cash' || method === 'efectivo') name = 'Efectivo'
        else if (method === 'card' || method === 'tarjeta' || method === 'credit') name = 'Tarjeta'
        else if (method === 'transfer' || method === 'transferencia') name = 'Transferencia'
        else name = method.charAt(0).toUpperCase() + method.slice(1)
        
        methodsMap.set(name, (methodsMap.get(name) || 0) + 1)
    })

    const colors: Record<string, string> = {
        'Efectivo': '#10b981',
        'Tarjeta': '#3b82f6',
        'Transferencia': '#f59e0b',
        'Otros': '#6b7280'
    }

    return Array.from(methodsMap.entries()).map(([name, value]) => ({
        name,
        value,
        color: colors[name] || '#6b7280'
    }))
  }, [sales])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando datos del dashboard...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pos">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al POS
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard POS</h2>
            <p className="text-muted-foreground">
              Resumen de ventas y métricas principales
            </p>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <GSIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.totalSales.toFixed(2)}</div>
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
            <div className="text-2xl font-bold">{kpis.totalTransactions}</div>
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
            <div className="text-2xl font-bold">${kpis.averageTicket.toFixed(2)}</div>
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
            <div className="text-2xl font-bold">{kpis.topProduct.sales}</div>
            <p className="text-xs text-muted-foreground truncate" title={kpis.topProduct.name}>{kpis.topProduct.name}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos y Ventas Recientes */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Gráfico de Ventas por Día */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventas por Día</CardTitle>
            <CardDescription>Tendencia del periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [`$${value}`, 'Ventas']}
                  labelFormatter={(label) => {
                    const item = dailySalesData.find(d => d.date === label)
                    return item ? item.fullDate : label
                  }}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Métodos de Pago */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <CardDescription>Distribución por transacciones</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentMethodsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}`, 'Transacciones']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ventas Recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas Recientes</CardTitle>
          <CardDescription>Últimas transacciones del periodo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sales.slice(0, 10).map((sale: any) => (
              <div key={sale.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-xs md:text-sm">{sale.id.substring(0, 8)}...</span>
                    <span className="text-xs text-muted-foreground">{sale.customer_name}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Badge variant="outline" className="flex items-center space-x-1">
                    <CreditCard className="h-3 w-3" />
                    <span className="capitalize">{sale.payment_method}</span>
                  </Badge>
                  
                  <div className="text-right">
                    <div className="font-medium">${sale.total.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-end">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(parseISO(sale.created_at), 'HH:mm', { locale: es })}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground hidden md:block">
                    {sale.items_count} items
                  </div>
                </div>
              </div>
            ))}
            {sales.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No hay ventas registradas en este periodo.
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}