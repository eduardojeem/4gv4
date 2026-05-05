"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PosStats } from "../hooks/usePosStats"
import { formatCurrency } from '@/lib/currency'
import { BarChart3 } from 'lucide-react'

interface SalesTrendChartProps {
  data: PosStats['dailySales']
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  return (
    <Card className="col-span-4 border-border/60 shadow-sm overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center">
          <BarChart3 className="mr-2 h-4 w-4 text-blue-600" />
          Ventas por Día
          <span className="ml-auto text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
            Tendencia
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 pb-2 pl-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground ml-6">
            <BarChart3 className="h-8 w-8 opacity-20 mb-3" />
            <p className="text-sm">No hay ventas registradas</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value) || 0)}
                dx={-10}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value) || 0), 'Ventas']}
                labelFormatter={(label) => {
                  const item = data.find((d) => d.date === label)
                  return item ? item.fullDate : label
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                labelStyle={{ fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                itemStyle={{ fontWeight: 600, color: '#3b82f6' }}
              />
              <Bar 
                dataKey="sales" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={50}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
