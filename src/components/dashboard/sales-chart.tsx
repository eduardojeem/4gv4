'use client'

import { useState, useEffect } from 'react'
import { LineChart } from 'recharts/es6/chart/LineChart'
import { Line } from 'recharts/es6/cartesian/Line'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { createClient } from '@/lib/supabase/client'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { formatCurrency } from '@/lib/currency'

interface SalesData {
  name: string
  ventas: number
}

type SaleRow = {
  total_amount: number | string | null
  created_at: string
}

interface CustomSalesTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomSalesTooltip({ active, payload, label }: CustomSalesTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur px-3 py-2 text-popover-foreground shadow-md text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
          <span className="text-muted-foreground">Ventas:</span>
          <span className="font-bold tabular-nums text-foreground">
            {formatCurrency(payload[0].value)}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export function SalesChart() {
  const [data, setData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedBranchId } = useBranch()

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const supabase = createClient()
        // Obtener ventas de los últimos 7 días
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)

        let query = supabase
          .from('sales')
          .select('total_amount, created_at')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true })

        query = withBranchFilter(query, selectedBranchId)
        const { data: sales, error } = await query

        if (error) throw error

        // Agrupar ventas por día
        const salesByDay: { [key: string]: number } = {}
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        
        // Inicializar últimos 7 días con 0
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          const dayName = dayNames[date.getDay()]
          salesByDay[dayName] = 0
        }

        // Sumar ventas por día
        ;(sales as SaleRow[] | null)?.forEach((sale) => {
          const date = new Date(sale.created_at)
          const dayName = dayNames[date.getDay()]
          salesByDay[dayName] = (salesByDay[dayName] || 0) + (Number(sale.total_amount) || 0)
        })

        // Convertir a formato para el gráfico
        const chartData: SalesData[] = Object.entries(salesByDay).map(([name, ventas]) => ({
          name,
          ventas: Math.round(ventas)
        }))

        setData(chartData)
      } catch (error) {
        console.error('Error fetching sales data:', error)
        // Usar datos de ejemplo si falla la carga
        setData([
          { name: 'Lun', ventas: 0 },
          { name: 'Mar', ventas: 0 },
          { name: 'Mié', ventas: 0 },
          { name: 'Jue', ventas: 0 },
          { name: 'Vie', ventas: 0 },
          { name: 'Sáb', ventas: 0 },
          { name: 'Dom', ventas: 0 },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchSalesData()
  }, [selectedBranchId])

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando datos…</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground text-sm">No hay datos de ventas disponibles</div>
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" vertical={false} />
          <XAxis 
            dataKey="name" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            stroke="currentColor"
            className="text-muted-foreground"
            tickFormatter={(value) => {
              if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
              if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
              return `${value}`
            }}
          />
          <Tooltip content={<CustomSalesTooltip />} />
          <Line 
            type="monotone" 
            dataKey="ventas" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SalesChart
