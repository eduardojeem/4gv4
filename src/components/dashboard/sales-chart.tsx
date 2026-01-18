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

interface SalesData {
  name: string
  ventas: number
}

export function SalesChart() {
  const [data, setData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        // Obtener ventas de los últimos 7 días
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)

        const { data: sales, error } = await supabase
          .from('sales')
          .select('total, created_at')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true })

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
        sales?.forEach((sale: any) => {
          const date = new Date(sale.created_at)
          const dayName = dayNames[date.getDay()]
          salesByDay[dayName] = (salesByDay[dayName] || 0) + (sale.total || 0)
        })

        // Convertir a formato para el gráfico
        const chartData: SalesData[] = Object.entries(salesByDay).map(([name, ventas]) => ({
          name,
          ventas: Math.round(ventas)
        }))

        setData(chartData)
      } catch (error) {
        console.error('Error fetching sales data:', error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchSalesData()
  }, [])

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Cargando datos...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-gray-400">No hay datos de ventas disponibles</div>
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip 
            formatter={(value) => [`${value}`, 'Ventas']}
            labelStyle={{ color: '#374151' }}
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
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
