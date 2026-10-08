'use client'

import { useCallback, useEffect, useState } from 'react'
import { PieChart } from 'recharts/es6/chart/PieChart'
import { Pie } from 'recharts/es6/polar/Pie'
import { Cell } from 'recharts/es6/component/Cell'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { Legend } from 'recharts/es6/component/Legend'
import { createClient } from '@/lib/supabase/client'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'

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

interface CustomRepairsTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    payload: ChartData
  }>
}

function CustomRepairsTooltip({ active, payload }: CustomRepairsTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0]
    return (
      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur px-3 py-2 text-popover-foreground shadow-md text-xs">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.payload.color }}
          />
          <span className="font-medium text-foreground">{item.name}:</span>
          <span className="font-bold tabular-nums text-foreground">{item.value}</span>
        </div>
      </div>
    )
  }
  return null
}

export function RepairsChart() {
  const [data, setData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { selectedBranchId } = useBranch()

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient()
      
      // Verificar autenticación
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.warn('User not authenticated for repairs chart')
        setData([])
        return
      }
      
      // Obtener conteos por estado
      let query = supabase
        .from('repairs')
        .select('status')

      query = withBranchFilter(query, selectedBranchId)
      const { data: repairs, error } = await query

      if (error) {
        console.error('Error fetching repairs:', error)
        setData([])
        return
      }

      if (repairs && repairs.length > 0) {
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
      } else {
        setData([])
      }
    } catch (error) {
      console.error('Error fetching repairs stats:', error)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedBranchId])

  // Sin Realtime: repairs no está en la publicación supabase_realtime.
  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    <div className="h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
          <Tooltip content={<CustomRepairsTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => (
              <span className="text-xs text-foreground font-medium ml-1 mr-2">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RepairsChart
