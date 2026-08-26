import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Receipt, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { PosStats } from "../hooks/usePosStats"
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { SaleDetailsModal } from '@/app/dashboard/pos/components/SaleDetailsModal'

interface DetailedSalesTableProps {
    stats: PosStats
}

export function DetailedSalesTable({ stats }: DetailedSalesTableProps) {
    const allSales = stats.allSales || []
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

    return (
        <div className="space-y-4 mt-6">
            <Card className="border border-border/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                    <CardTitle className="text-sm font-semibold flex items-center">
                        <Receipt className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Detalle de Ventas POS
                        <span className="ml-auto text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
                            {allSales.length} transacciones
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {allSales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-card">
                            <div className="p-3 bg-muted/50 rounded-full mb-3">
                                <Receipt className="h-6 w-6 opacity-40" />
                            </div>
                            <p className="font-medium text-sm">No hay ventas en este periodo</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <div className="w-full">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider">Comprobante</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider">Cliente</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Facturado</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Costo Items</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Ganancia Neta</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider text-center">Método</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider w-12 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {allSales.map((sale) => {
                                            const total = Number(sale.total || 0)
                                            const cost = Number(sale.cost || 0)
                                            const refund = Number(sale.refundAmount || 0)
                                            const profit = Number(sale.profit || 0)
                                            const customerName = sale.customer?.name || 'Consumidor Final'
                                            const code = sale.code || sale.id.substring(0, 8).toUpperCase()
                                            
                                            return (
                                                <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                                        <span className="font-mono text-xs">{code}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {format(parseISO(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                        {customerName}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(total)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-slate-500">
                                                        {formatCurrency(cost)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                        {formatCurrency(profit)}
                                                        {refund > 0 && (
                                                            <div className="text-[10px] text-rose-500 font-normal mt-0.5 whitespace-nowrap">
                                                                (-{formatCurrency(refund)})
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                                                            {sale.payment_method}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                                                            onClick={() => setSelectedSaleId(sale.id)}
                                                        >
                                                            <Search className="h-4 w-4" />
                                                            <span className="sr-only">Ver detalle</span>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            <SaleDetailsModal 
                saleId={selectedSaleId}
                isOpen={!!selectedSaleId}
                onClose={() => setSelectedSaleId(null)}
            />
        </div>
    )
}
