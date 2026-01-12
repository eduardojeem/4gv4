"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PosStats } from "../hooks/usePosStats"

interface PaymentDistributionChartProps {
    data: PosStats['paymentMethods']
}

export function PaymentDistributionChart({ data }: PaymentDistributionChartProps) {
    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Métodos de Pago</CardTitle>
                <CardDescription>Distribución por transacciones</CardDescription>
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
                            formatter={(value) => [`${value}`, 'Transacciones']}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
