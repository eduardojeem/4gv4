"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PosStats } from "../hooks/usePosStats"
import { formatCurrency } from '@/lib/currency'
import { PieChart as PieChartIcon } from 'lucide-react'

interface PaymentDistributionChartProps {
  data: PosStats['paymentMethods']
}

export function PaymentDistributionChart({ data }: PaymentDistributionChartProps) {
  return (
    <Card className="col-span-3 border-border/60 shadow-sm overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center">
          <PieChartIcon className="mr-2 h-4 w-4 text-violet-600" />
          Métodos de Pago
          <span className="ml-auto text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
            Distribución
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 pb-2">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <PieChartIcon className="h-8 w-8 opacity-20 mb-3" />
            <p className="text-sm">No hay datos de pagos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value) || 0), 'Monto']}
                contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                itemStyle={{ fontWeight: 600 }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
