"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PosStats } from "../hooks/usePosStats"

interface SalesTrendChartProps {
    data: PosStats['dailySales']
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Ventas por Día</CardTitle>
                <CardDescription>Tendencia del periodo</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            formatter={(value, name) => [`$${value}`, 'Ventas']}
                            labelFormatter={(label) => {
                                const item = data.find(d => d.date === label)
                                return item ? item.fullDate : label
                            }}
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
