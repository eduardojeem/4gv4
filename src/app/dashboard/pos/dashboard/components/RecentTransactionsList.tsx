import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import React, { useState } from 'react'
import { CreditCard, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { PosStats } from "../hooks/usePosStats"
import { SaleDetailsModal } from '@/app/dashboard/pos/components/SaleDetailsModal'

interface RecentTransactionsListProps {
    sales: PosStats['recentSales']
}

export function RecentTransactionsList({ sales }: RecentTransactionsListProps) {
    const [open, setOpen] = useState(false)
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

    const openDetails = (id: string) => {
        setSelectedSaleId(id)
        setOpen(true)
    }

    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Ventas Recientes</CardTitle>
                <CardDescription>Últimas transacciones del periodo</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sales.map((sale: any) => (
                        <div key={sale.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center space-x-4">
                                <div className="flex flex-col">
                                    <span className="font-medium text-xs md:text-sm">{sale.id.substring(0, 8)}...</span>
                                    <span className="text-xs text-muted-foreground">{sale.customer_name}</span>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <Badge variant="outline" className="flex items-center space-x-1">
                                    <CreditCard className="h-3 w-3" />
                                    <span className="capitalize">{sale.payment_method}</span>
                                </Badge>

                                <div className="text-right">
                                    <div className="font-medium">${sale.total.toFixed(2)}</div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-end">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {format(parseISO(sale.created_at), 'HH:mm', { locale: es })}
                                    </div>
                                </div>

                                <div className="text-xs text-muted-foreground hidden md:block">
                                    {sale.items_count} items
                                </div>

                                <Button variant="outline" size="sm" onClick={() => openDetails(sale.id)}>
                                    Ver detalle
                                </Button>
                            </div>
                        </div>
                    ))}
                    {sales.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay ventas registradas en este periodo.
                        </div>
                    )}
                </div>
            </CardContent>
            <SaleDetailsModal isOpen={open} onClose={() => setOpen(false)} saleId={selectedSaleId} />
        </Card>
    )
}
