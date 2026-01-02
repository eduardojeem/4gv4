'use client'

import { PieChart } from 'recharts/es6/chart/PieChart'
import { Pie } from 'recharts/es6/polar/Pie'
import { Cell } from 'recharts/es6/component/Cell'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { Legend } from 'recharts/es6/component/Legend'

// Mock data - In real app, this would come from Supabase
const data = [
  { name: 'Recibido', value: 8, color: '#ef4444' },
  { name: 'Diagnóstico', value: 5, color: '#f59e0b' },
  { name: 'Reparación', value: 12, color: '#3b82f6' },
  { name: 'Listo', value: 3, color: '#10b981' },
  { name: 'Entregado', value: 156, color: '#6b7280' },
]

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6b7280']

export function RepairsChart() {
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
