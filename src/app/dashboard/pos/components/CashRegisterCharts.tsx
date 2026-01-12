'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatCurrency } from '@/lib/currency'

interface CashRegisterChartsProps {
  cashReport: any
  movements?: any[]
  precalculatedTotals?: {
    cash: number
    card: number
    transfer: number
    mixed: number
  }
}

export function CashRegisterCharts({ cashReport, movements, precalculatedTotals }: CashRegisterChartsProps) {
  if (!cashReport) return null

  // Prepare data for Payment Methods Pie Chart
  let methodTotals = { cash: 0, card: 0, transfer: 0, mixed: 0 }
  
  if (precalculatedTotals) {
    methodTotals = precalculatedTotals
  } else if (movements) {
    const sales = movements.filter(m => m.type === 'sale')
    const detectMethod = (m: any) => {
      if (m.payment_method) return m.payment_method
      const note = String((m.reason || m.note || '')).toLowerCase()
      if (note.includes('card') || note.includes('tarjeta')) return 'card'
      if (note.includes('transfer') || note.includes('transferencia')) return 'transfer'
      if (note.includes('mixed') || note.includes('mixta')) return 'mixed'
      return 'cash'
    }

    sales.forEach(s => {
      const m = detectMethod(s) as keyof typeof methodTotals
      methodTotals[m] += Number(s.amount || 0)
    })
  }

  const pieData = [
    { name: 'Efectivo', value: methodTotals.cash, color: '#22c55e' }, // green-500
    { name: 'Tarjeta', value: methodTotals.card, color: '#3b82f6' }, // blue-500
    { name: 'Transferencia', value: methodTotals.transfer, color: '#a855f7' }, // purple-500
    { name: 'Mixto', value: methodTotals.mixed, color: '#f97316' }, // orange-500
  ].filter(d => d.value > 0)

  // Prepare data for Income vs Expenses
  const barData = [
    { name: 'Ingresos', amount: cashReport.incomes, fill: '#22c55e' },
    { name: 'Egresos', amount: cashReport.expenses, fill: '#ef4444' },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Métodos de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No hay ventas registradas
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Balance del Turno</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 12}} />
                <Tooltip 
                    cursor={{fill: 'transparent'}}
                    formatter={(value: number) => formatCurrency(value)} 
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
