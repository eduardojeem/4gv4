'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'

export interface ProductVariant {
    id: string
    variant_name: string
    sku: string
    price_adjustment: number
    stock_quantity: number
    is_active: boolean
}

export interface ProductWithVariants {
    id: string
    name: string
    base_price: number
    variants: ProductVariant[]
}

interface ProductVariantSelectorProps {
    product: ProductWithVariants | null
    isOpen: boolean
    onClose: () => void
    onSelectVariant: (variant: ProductVariant, quantity: number) => void
}

export function ProductVariantSelector({
    product,
    isOpen,
    onClose,
    onSelectVariant
}: ProductVariantSelectorProps) {
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
    const [quantity, setQuantity] = useState(1)

    const handleConfirm = () => {
        if (selectedVariant) {
            onSelectVariant(selectedVariant, quantity)
            setSelectedVariant(null)
            setQuantity(1)
            onClose()
        }
    }

    const handleClose = () => {
        setSelectedVariant(null)
        setQuantity(1)
        onClose()
    }

    if (!product) return null

    const activeVariants = product.variants.filter(v => v.is_active)

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Seleccionar Variante</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Product Info */}
                    <div className="bg-gray-50 p-4 rounded">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <p className="text-sm text-gray-600">
                            Precio base: {formatCurrency(product.base_price)}
                        </p>
                    </div>

                    {/* Variants Grid */}
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">Selecciona una variante:</p>
                        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                            {activeVariants.map((variant) => {
                                const finalPrice = product.base_price + variant.price_adjustment
                                const isSelected = selectedVariant?.id === variant.id
                                const hasStock = variant.stock_quantity > 0

                                return (
                                    <Card
                                        key={variant.id}
                                        className={`cursor-pointer transition-all ${isSelected
                                                ? 'border-2 border-blue-500 bg-blue-50'
                                                : hasStock
                                                    ? 'hover:border-blue-300'
                                                    : 'opacity-50 cursor-not-allowed'
                                            }`}
                                        onClick={() => hasStock && setSelectedVariant(variant)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <div className="font-medium">{variant.variant_name}</div>
                                                    <div className="text-xs text-gray-500">SKU: {variant.sku}</div>
                                                </div>
                                                {isSelected && (
                                                    <Check className="h-5 w-5 text-blue-600 shrink-0" />
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between mt-3">
                                                <div className="text-lg font-bold text-blue-600">
                                                    {formatCurrency(finalPrice)}
                                                </div>
                                                <Badge variant={hasStock ? 'default' : 'destructive'}>
                                                    {hasStock ? `Stock: ${variant.stock_quantity}` : 'Sin stock'}
                                                </Badge>
                                            </div>

                                            {variant.price_adjustment !== 0 && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {variant.price_adjustment > 0 ? '+' : ''}
                                                    {formatCurrency(variant.price_adjustment)} vs base
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quantity Selector */}
                    {selectedVariant && (
                        <div className="bg-blue-50 p-4 rounded space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Cantidad:</span>
                                <div className="flex items-center gap-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    >
                                        -
                                    </Button>
                                    <span className="font-bold w-12 text-center">{quantity}</span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setQuantity(Math.min(selectedVariant.stock_quantity, quantity + 1))}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-lg">
                                <span className="font-semibold">Total:</span>
                                <span className="font-bold text-blue-600">
                                    {formatCurrency((product.base_price + selectedVariant.price_adjustment) * quantity)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedVariant}
                            className="flex-1"
                            size="lg"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Agregar al Carrito
                        </Button>
                        <Button
                            onClick={handleClose}
                            variant="outline"
                            size="lg"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
