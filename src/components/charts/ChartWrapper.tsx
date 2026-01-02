import React from 'react'
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { Legend } from 'recharts/es6/component/Legend';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { ReferenceLine } from 'recharts';
import { formatValue, CHART_COLORS } from '@/lib/formatters'

interface ChartConfig {
  dataKey: string
  name?: string
  stroke?: string
  fill?: string
  format?: 'currency' | 'percentage' | 'number' | 'compact'
}

interface ChartWrapperProps {
  type: 'line' | 'bar' | 'area' | 'pie'
  data: any[]
  height?: number
  config: ChartConfig[]
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  colors?: string[]
  className?: string
}

export function ChartWrapper({
  type,
  data,
  height = 300,
  config,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  colors = Object.values(CHART_COLORS),
  className
}: ChartWrapperProps) {
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const configItem = config.find(c => c.dataKey === entry.dataKey)
          const format = configItem?.format || 'number'
          
          return (
            <p key={index} className="text-sm flex items-center gap-2" style={{ color: entry.color }}>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name || configItem?.name || entry.dataKey}: {formatValue(entry.value, format)}
            </p>
          )
        })}
      </div>
    )
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 }
  }

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
            <XAxis dataKey={config[0]?.dataKey || 'name'} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {config.slice(1).map((item, index) => (
              <Line
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                stroke={item.stroke || colors[index % colors.length]}
                strokeWidth={2}
                name={item.name || item.dataKey}
              />
            ))}
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
            <XAxis dataKey={config[0]?.dataKey || 'name'} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {config.slice(1).map((item, index) => (
              <Bar
                key={item.dataKey}
                dataKey={item.dataKey}
                fill={item.fill || colors[index % colors.length]}
                name={item.name || item.dataKey}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
            <XAxis dataKey={config[0]?.dataKey || 'name'} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {config.slice(1).map((item, index) => (
              <Area
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                stroke={item.stroke || colors[index % colors.length]}
                fill={item.fill || colors[index % colors.length]}
                fillOpacity={0.1}
                name={item.name || item.dataKey}
              />
            ))}
          </AreaChart>
        )

      case 'pie':
        return (
          <PieChart {...commonProps}>
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey={config[0]?.dataKey || 'value'}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        )

      default:
        return null
    }
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}

// Componentes específicos para casos comunes
export function RevenueChart({ data, height = 300 }: { data: any[], height?: number }) {
  return (
    <ChartWrapper
      type="area"
      data={data}
      height={height}
      config={[
        { dataKey: 'month' },
        { dataKey: 'totalRevenue', name: 'Ingresos', format: 'currency' }
      ]}
    />
  )
}

export function CustomerGrowthChart({ data, height = 300 }: { data: any[], height?: number }) {
  return (
    <ChartWrapper
      type="line"
      data={data}
      height={height}
      config={[
        { dataKey: 'month' },
        { dataKey: 'newCustomers', name: 'Nuevos Clientes', format: 'number' },
        { dataKey: 'activeCustomers', name: 'Clientes Activos', format: 'number' }
      ]}
    />
  )
}

export function SegmentDistributionChart({ data, height = 300 }: { data: any[], height?: number }) {
  return (
    <ChartWrapper
      type="pie"
      data={data}
      height={height}
      config={[
        { dataKey: 'count', name: 'Clientes', format: 'number' }
      ]}
      showLegend={true}
    />
  )
}