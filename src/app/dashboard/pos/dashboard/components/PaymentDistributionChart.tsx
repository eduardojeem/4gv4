"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PosStats } from "../hooks/usePosStats"
import { formatCurrency } from '@/lib/currency'

interface PaymentDistributionChartProps {
  data: PosStats['paymentMethods']
}

export function PaymentDistributionChart({ data }: PaymentDistributionChartProps) {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Metodos de Pago</CardTitle>
        <CardDescription>Distribucion por monto vendido</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value) || 0), 'Monto']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

