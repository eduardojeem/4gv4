'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, FileText, Calendar, DollarSign } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface PurchaseOrder {
    id: string
    ordernumber: string
    status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    orderdate: string
    totalamount: number
    currency: string
    itemcount?: number
}

interface SupplierOrdersListProps {
    supplierId: string
    onCreateOrder: () => void
}

export function SupplierOrdersList({ supplierId, onCreateOrder }: SupplierOrdersListProps) {
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*')
                .eq('supplierid', supplierId)
                .order('orderdate', { ascending: false })

            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Error fetching orders:', error)
            toast.error('Error al cargar pedidos')
        } finally {
            setLoading(false)
        }
    }, [supplierId, supabase])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-800 border-gray-200',
            sent: 'bg-blue-100 text-blue-800 border-blue-200',
            confirmed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            shipped: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            delivered: 'bg-green-100 text-green-800 border-green-200',
            cancelled: 'bg-red-100 text-red-800 border-red-200'
        }
        const labels = {
            draft: 'Borrador',
            sent: 'Enviado',
            confirmed: 'Confirmado',
            shipped: 'Enviado',
            delivered: 'Entregado',
            cancelled: 'Cancelado'
        }
        return (
            <Badge className={styles[status as keyof typeof styles] || styles.draft}>
                {labels[status as keyof typeof labels] || status}
            </Badge>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Pedidos Recientes</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchOrders}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button onClick={onCreateOrder}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Pedido
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : orders.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="text-lg font-medium mb-2">No hay pedidos registrados</h4>
                    <p className="text-muted-foreground mb-4">Comienza creando un nuevo pedido para este proveedor.</p>
                    <Button onClick={onCreateOrder}>Crear Primer Pedido</Button>
                </div>
            ) : (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Orden #</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.ordernumber}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3 w-3 text-muted-foreground" />
                                            {format(new Date(order.orderdate), 'dd MMM yyyy', { locale: es })}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {new Intl.NumberFormat('es-AR', {
                                            style: 'currency',
                                            currency: order.currency || 'USD'
                                        }).format(order.totalamount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Ver Detalles</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
