
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfMonth, endOfMonth, subMonths, format, parseISO, startOfDay, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

export interface SalesData {
  name: string
  ventas: number
  ingresos: number
}

export interface CategoryData {
  name: string
  value: number
  color: string
}

export interface ProductPerformance {
  id: string
  name: string
  sales: number
  revenue: number
}

export interface AnalyticsMetrics {
  totalRevenue: number
  totalSales: number
  averageTicket: number
  revenueChange: number // percentage
  salesChange: number // percentage
}

export function useAnalytics(timeRange: '7d' | '30d' | '90d' | '1y' = '30d') {
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([])
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    revenueChange: 0,
    salesChange: 0
  })

  const supabase = createClient()

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      // Determinar rango de fechas
      const now = new Date()
      let startDate = subDays(now, 30)
      
      if (timeRange === '7d') startDate = subDays(now, 7)
      if (timeRange === '90d') startDate = subDays(now, 90)
      if (timeRange === '1y') startDate = subDays(now, 365)

      // 1. Fetch Sales with Items and Products
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          total_amount,
          sale_items (
            id,
            quantity,
            unit_price,
            subtotal,
            product_id
          )
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (salesError) {
        console.error('Supabase sales fetch error:', salesError)
        throw salesError
      }

      // 2. Fetch Products separately (lightweight)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, category_id')
      
      if (productsError) {
        console.error('Supabase products fetch error:', productsError)
      }

      // 3. Fetch Categories separately
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
      
      if (categoriesError) {
        console.error('Supabase categories fetch error:', categoriesError)
      }

      // Create Lookups
      const categoryLookup = new Map<string, string>()
      categoriesData?.forEach(cat => {
        categoryLookup.set(cat.id, cat.name)
      })

      const productLookup = new Map<string, { name: string, categoryId: string | null }>()
      productsData?.forEach(prod => {
        productLookup.set(prod.id, { 
          name: prod.name, 
          categoryId: prod.category_id 
        })
      })

      // Process Sales Data for Chart
      const salesMap = new Map<string, { ventas: number, ingresos: number }>()
      const categoryMap = new Map<string, number>()
      const productMap = new Map<string, { name: string, sales: number, revenue: number }>()
      
      salesData?.forEach(sale => {
        // Sales Chart Data
        const date = parseISO(sale.created_at)
        let key = format(date, 'dd MMM', { locale: es })
        if (timeRange === '1y') key = format(date, 'MMM yyyy', { locale: es })
        
        const current = salesMap.get(key) || { ventas: 0, ingresos: 0 }
        salesMap.set(key, {
          ventas: current.ventas + 1,
          ingresos: current.ingresos + (sale.total_amount || 0)
        })

        // Process Items
        sale.sale_items?.forEach((item: any) => {
          if (item.product_id) {
            // Resolve Product Info
            const productInfo = productLookup.get(item.product_id)
            const prodName = productInfo?.name || 'Desconocido'
            
            // Resolve Category Info
            const catId = productInfo?.categoryId
            const catName = catId ? categoryLookup.get(catId) || 'Sin Categoría' : 'Sin Categoría'
            
            // Calculate item total using subtotal or fallback
            const itemTotal = item.subtotal || (item.quantity * item.unit_price) || 0

            // Update Category Stats
            const currentCatVal = categoryMap.get(catName) || 0
            categoryMap.set(catName, currentCatVal + itemTotal)

            // Update Product Stats
            const currentProd = productMap.get(item.product_id) || { name: prodName, sales: 0, revenue: 0 }
            
            productMap.set(item.product_id, {
              name: prodName,
              sales: currentProd.sales + (item.quantity || 0),
              revenue: currentProd.revenue + itemTotal
            })
          }
        })
      })

      const chartData: SalesData[] = Array.from(salesMap.entries()).map(([name, data]) => ({
        name,
        ventas: data.ventas,
        ingresos: data.ingresos
      }))

      setSalesData(chartData)

      // Process Metrics
      const totalRevenue = salesData?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0
      const totalSales = salesData?.length || 0
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0

      setMetrics({
        totalRevenue,
        totalSales,
        averageTicket,
        revenueChange: 0, // Placeholder
        salesChange: 0 // Placeholder
      })

      const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']
      const processedCategories = Array.from(categoryMap.entries())
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => b.value - a.value)

      setCategoryData(processedCategories)

      const processedProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10) // Top 10

      setTopProducts(processedProducts)

    } catch (err) {
      console.error('Error fetching analytics:', err)
      // Log full details for debugging
      console.error('Error details:', JSON.stringify(err, null, 2))
    } finally {
      setLoading(false)
    }
  }, [timeRange, supabase])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    loading,
    salesData,
    categoryData,
    topProducts,
    metrics,
    refreshAnalytics: fetchAnalytics
  }
}
