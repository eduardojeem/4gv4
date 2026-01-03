'use client'

import { useEffect, useState } from 'react'
import { PieChart } from 'recharts/es6/chart/PieChart'
import { Pie } from 'recharts/es6/polar/Pie'
import { Cell } from 'recharts/es6/component/Cell'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { Legend } from 'recharts/es6/component/Legend'
import { createClient } from '@/lib/supabase/client'

const COLORS = {
  'recibido': '#ef4444',
  'diagnostico': '#f59e0b',
  'reparacion': '#3b82f6',
  'listo': '#10b981',
  'entregado': '#6b7280',
  'pausado': '#8b5cf6',
  'cancelado': '#9ca3af'
}

type ChartData = {
  name: string
  value: number
  color: string
}

export function RepairsChart() {
  const [data, setData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    try {
      const supabase = createClient()
      
      // Obtener conteos por estado
      const { data: repairs, error } = await supabase
        .from('repairs')
        .select('status')

      if (error) throw error

      if (repairs) {
        const counts = repairs.reduce((acc, curr) => {
          const status = curr.status as keyof typeof COLORS
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const formattedData = Object.entries(counts)
          .filter(([key]) => Object.keys(COLORS).includes(key))
          .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: COLORS[name as keyof typeof COLORS] || '#cbd5e1'
          }))
          .sort((a, b) => b.value - a.value)

        setData(formattedData)
      }
    } catch (error) {
      console.error('Error fetching repairs stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    const supabase = createClient()
    const channel = supabase
      .channel('repairs-chart-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No hay datos de reparaciones disponibles
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, name) => [value, name]}
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry) => (
              <span style={{ color: entry.color }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}export default RepairsChart
