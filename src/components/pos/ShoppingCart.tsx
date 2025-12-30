'use client'

import { Plus, Minus, Trash2, ShoppingCart as ShoppingCartIcon, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CartItem } from '@/hooks/usePOS'
import { formatCurrency } from '@/lib/currency'

interface ShoppingCartProps {
    items: CartItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    onUpdateQuantity: (itemId: string, quantity: number) => void
    onRemoveItem: (itemId: string) => void
    onApplyDiscount: (itemId: string, discount: number) => void
    onClearCart: () => void
}

export function ShoppingCart({
    items,
    subtotal,
    tax,
    discount,
    total,
    onUpdateQuantity,
    onRemoveItem,
    onApplyDiscount,
    onClearCart
}: ShoppingCartProps) {
    if (items.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingCartIcon className="h-5 w-5" />
                        Carrito de Compras
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ShoppingCartIcon className="h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="font-medium text-gray-900 mb-2">Carrito vacío</h3>
                        <p className="text-sm text-gray-600">
                            Agrega productos para comenzar una venta
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                    <ShoppingCartIcon className="h-5 w-5" />
                    Carrito ({items.length})
                </CardTitle>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearCart}
                    className="text-red-600 hover:text-red-700"
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpiar
                </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto space-y-3 pb-3">
                {items.map((item) => (
                    <Card key={item.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                            {/* Item Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm mb-1 truncate">
                                        {item.name}
                                    </h4>
                                    <div className="text-xs text-gray-600">
                                        SKU: {item.sku} • {formatCurrency(item.price)} c/u
                                    </div>
                                    {item.stock < 10 && (
                                        <Badge variant="destructive" className="mt-1 text-xs">
                                            Stock bajo: {item.stock}
                                        </Badge>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRemoveItem(item.id)}
                                    className="shrink-0 h-8 w-8 p-0"
                                >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                        disabled={item.quantity <= 1}
                                        className="h-8 w-8 p-0"
                                    >
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                                        className="w-16 text-center h-8"
                                        min={1}
                                        max={item.stock}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                        disabled={item.quantity >= item.stock}
                                        className="h-8 w-8 p-0"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>

                                <div className="ml-auto text-right">
                                    <div className="text-lg font-bold text-blue-600">
                                        {formatCurrency(item.subtotal)}
                                    </div>
                                </div>
                            </div>

                            {/* Discount */}
                            {item.discount > 0 && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <Percent className="h-3 w-3" />
                                    Descuento: -{formatCurrency(item.discount)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </CardContent>

            {/* Totals */}
            <CardContent className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>

                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span>Descuento:</span>
                            <span className="font-medium">-{formatCurrency(discount)}</span>
                        </div>
                    )}

                    {tax > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">IVA:</span>
                            <span className="font-medium">{formatCurrency(tax)}</span>
                        </div>
                    )}
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL:</span>
                    <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(total)}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
