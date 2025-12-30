'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface SupplierProduct {
    id: string
    name: string
    suppliersku: string
    unitprice: number
    currency: string
}

interface OrderItem {
    productId: string
    name: string
    sku: string
    quantity: number
    unitPrice: number
    total: number
    currency: string
}

interface CreateOrderModalProps {
    isOpen: boolean
    onClose: () => void
    supplierId: string
    supplierName: string
    onOrderCreated: () => void
    initialProduct?: SupplierProduct | null
}

export function CreateOrderModal({ isOpen, onClose, supplierId, supplierName, onOrderCreated, initialProduct }: CreateOrderModalProps) {
    const [step, setStep] = useState<'products' | 'review'>('products')
    const [products, setProducts] = useState<SupplierProduct[]>([])
    const [items, setItems] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (isOpen && supplierId) {
            fetchProducts()
            setItems([])
            setStep('products')
            setSearch('')
            
            if (initialProduct) {
                setItems([{
                    productId: initialProduct.id,
                    name: initialProduct.name,
                    sku: initialProduct.suppliersku,
                    quantity: 1,
                    unitPrice: initialProduct.unitprice,
                    total: initialProduct.unitprice,
                    currency: initialProduct.currency
                }])
            }
        }
    }, [isOpen, supplierId, initialProduct])

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('supplier_products')
                .select('id, name, suppliersku, unitprice, currency')
                .eq('supplier_id', supplierId)

            if (error) throw error
            setProducts(data || [])
        } catch (error) {
            console.error('Error fetching products:', error)
            toast.error('Error al cargar productos')
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.suppliersku && p.suppliersku.toLowerCase().includes(search.toLowerCase()))
    )

    const addItem = (product: SupplierProduct) => {
        const existing = items.find(i => i.productId === product.id)
        if (existing) {
            updateQuantity(product.id, existing.quantity + 1)
        } else {
            setItems([...items, {
                productId: product.id,
                name: product.name,
                sku: product.suppliersku,
                quantity: 1,
                unitPrice: product.unitprice,
                total: product.unitprice,
                currency: product.currency
            }])
        }
        toast.success('Producto agregado')
    }

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(productId)
            return
        }
        setItems(items.map(item => 
            item.productId === productId 
                ? { ...item, quantity, total: quantity * item.unitPrice }
                : item
        ))
    }

    const removeItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId))
    }

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + item.total, 0)
    }

    const handleCreateOrder = async () => {
        if (items.length === 0) return

        try {
            setSubmitting(true)
            const orderNumber = `PO-${Date.now().toString().slice(-6)}` // Simple generation
            const total = calculateTotal()

            // Create order
            const { data: order, error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    supplierid: supplierId,
                    ordernumber: orderNumber,
                    status: 'draft',
                    subtotal: total,
                    taxamount: 0,
                    shippingcost: 0,
                    totalamount: total,
                    currency: products[0]?.currency || 'USD'
                })
                .select()
                .single()

            if (orderError) throw orderError

            // Create order items
            const orderItems = items.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                suppliersku: item.sku,
                name: item.name,
                quantity: item.quantity,
                unitprice: item.unitPrice,
                linetotal: item.total
            }))

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(orderItems)

            if (itemsError) throw itemsError

            toast.success('Pedido creado exitosamente')
            onOrderCreated()
            onClose()
        } catch (error) {
            console.error('Error creating order:', error)
            toast.error('Error al crear el pedido')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Pedido - {supplierName}</DialogTitle>
                    <DialogDescription>
                        {step === 'products' ? 'Selecciona los productos para agregar al pedido' : 'Revisa y confirma el pedido'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {step === 'products' ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar productos..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex-1"
                                />
                            </div>

                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead className="text-right">Precio</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8">Cargando productos...</TableCell>
                                            </TableRow>
                                        ) : filteredProducts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                    No se encontraron productos. Asegúrate de tener productos registrados para este proveedor.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredProducts.map((product) => (
                                                <TableRow key={product.id}>
                                                    <TableCell className="font-medium">{product.name}</TableCell>
                                                    <TableCell>{product.suppliersku || '-'}</TableCell>
                                                    <TableCell className="text-right">
                                                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: product.currency }).format(product.unitprice)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="ghost" onClick={() => addItem(product)}>
                                                            <Plus className="h-4 w-4" />
                                                            Agregar
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {items.length > 0 && (
                                <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="h-5 w-5" />
                                        <span className="font-medium">{items.length} items seleccionados</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-lg font-bold">
                                            Total: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: items[0]?.currency || 'USD' }).format(calculateTotal())}
                                        </div>
                                        <Button onClick={() => setStep('review')}>
                                            Ver Resumen
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-right">Precio Unit.</TableHead>
                                            <TableHead className="text-center w-[150px]">Cantidad</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.productId}>
                                                <TableCell className="font-medium">
                                                    <div>{item.name}</div>
                                                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(item.unitPrice)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                        >
                                                            -
                                                        </Button>
                                                        <span className="w-8 text-center">{item.quantity}</span>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(item.total)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeItem(item.productId)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col items-end gap-2 p-4 bg-muted/20 rounded-lg">
                                <div className="flex justify-between w-full max-w-xs text-sm">
                                    <span>Subtotal:</span>
                                    <span>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(calculateTotal())}</span>
                                </div>
                                <div className="flex justify-between w-full max-w-xs text-lg font-bold border-t pt-2">
                                    <span>Total:</span>
                                    <span>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(calculateTotal())}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'review' && (
                        <Button variant="outline" onClick={() => setStep('products')} className="mr-auto">
                            Volver a productos
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    {step === 'review' && (
                        <Button onClick={handleCreateOrder} disabled={submitting}>
                            {submitting ? 'Creando...' : 'Confirmar Pedido'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
