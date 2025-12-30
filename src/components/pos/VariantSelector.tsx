'use client'

import React, { useState, useMemo } from 'react'
import { ProductWithVariants, ProductVariant, VariantAttributeValue } from '@/types/product-variants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/currency'
import { X, Package, AlertTriangle } from 'lucide-react'

interface VariantSelectorProps {
  product: ProductWithVariants
  isOpen: boolean
  onClose: () => void
  onAddToCart: (variant: ProductVariant, quantity: number) => void
}

export function VariantSelector({ product, isOpen, onClose, onAddToCart }: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)

  // Obtener variantes disponibles basadas en atributos seleccionados
  const availableVariants = useMemo(() => {
    if (!product.variants) return []
    
    return product.variants.filter(variant => {
      return variant.attributes.every((av: VariantAttributeValue) => {
        const selectedValue = selectedAttributes[av.attribute_id]
        return !selectedValue || selectedValue === av.option_id
      })
    })
  }, [product.variants, selectedAttributes])

  // Obtener la variante exacta seleccionada
  const selectedVariant = useMemo(() => {
    if (!product.variants) return null
    
    const attributeKeys = Object.keys(selectedAttributes)
    if (attributeKeys.length === 0) return null

    return product.variants.find(variant => {
      return variant.attributes.every((av: VariantAttributeValue) => 
        selectedAttributes[av.attribute_id] === av.option_id
      ) && variant.attributes.length === attributeKeys.length
    })
  }, [product.variants, selectedAttributes])

  // Obtener atributos únicos del producto
  const productAttributes = useMemo(() => {
    if (!product.variants) return []
    
    const attributeMap = new Map()
    
    product.variants.forEach(variant => {
      variant.attributes.forEach((av: VariantAttributeValue) => {
        if (!attributeMap.has(av.attribute_id)) {
          attributeMap.set(av.attribute_id, {
            id: av.attribute_id,
            name: av.attribute_name,
            values: new Set()
          })
        }
        attributeMap.get(av.attribute_id).values.add({
          id: av.option_id,
          name: av.display_value || av.value
        })
      })
    })

    return Array.from(attributeMap.values()).map(attr => ({
      ...attr,
      values: Array.from(attr.values)
    }))
  }, [product.variants])

  // Obtener valores disponibles para un atributo específico
  const getAvailableValues = (attributeId: string) => {
    const availableValues = new Set<string>()

    availableVariants.forEach(variant => {
      const attributeValue = variant.attributes.find((av: VariantAttributeValue) => av.attribute_id === attributeId)
      if (attributeValue) {
        availableValues.add(attributeValue.option_id)
      }
    })

    const attribute = productAttributes.find(attr => attr.id === attributeId)
    return attribute?.values.filter((value: { id: string; name: string }) => availableValues.has(value.id)) || []
  }

  // Manejar selección de atributo
  const handleAttributeChange = (attributeId: string, valueId: string) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [attributeId]: valueId
    }))
  }

  // Manejar confirmación de selección
  const handleConfirm = () => {
    if (selectedVariant) {
      onAddToCart(selectedVariant, quantity)
      onClose()
      // Resetear estado
      setSelectedAttributes({})
      setQuantity(1)
    }
  }

  // Resetear al cerrar
  const handleClose = () => {
    setSelectedAttributes({})
    setQuantity(1)
    onClose()
  }

  // Verificar si se puede agregar al carrito
  const canAddToCart = selectedVariant && selectedVariant.stock >= quantity

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Seleccionar Variante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del producto */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{product.images?.[0] || '📦'}</div>
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-gray-600">{product.description}</p>
                  {product.base_price && (
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(product.base_price)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selección de atributos */}
          <div className="space-y-3">
            {productAttributes.map(attribute => (
              <div key={attribute.id}>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {attribute.name}
                </label>
                <Select
                  value={selectedAttributes[attribute.id] || ''}
                  onValueChange={(value) => handleAttributeChange(attribute.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Seleccionar ${attribute.name.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableValues(attribute.id).map((value: { id: string; name: string }) => (
                      <SelectItem key={value.id} value={value.id}>
                        {value.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Información de la variante seleccionada */}
          {selectedVariant && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">SKU:</span>
                    <Badge variant="outline">{selectedVariant.sku}</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Precio:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(selectedVariant.price)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Stock:</span>
                    <div className="flex items-center gap-2">
                      <span className={selectedVariant.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                        {selectedVariant.stock} unidades
                      </span>
                      {selectedVariant.stock <= 5 && selectedVariant.stock > 0 && (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selección de cantidad */}
          {selectedVariant && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Cantidad
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="px-4 py-2 border rounded text-center min-w-[60px]">
                  {quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={quantity >= selectedVariant.stock}
                >
                  +
                </Button>
              </div>
              {quantity > selectedVariant.stock && (
                <p className="text-sm text-red-600 mt-1">
                  Cantidad excede el stock disponible
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Botones de acción */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!canAddToCart}
              className="flex-1"
            >
              Agregar al Carrito
            </Button>
          </div>

          {/* Mensaje de ayuda */}
          {productAttributes.length > 0 && Object.keys(selectedAttributes).length < productAttributes.length && (
            <p className="text-sm text-gray-500 text-center">
              Selecciona todas las opciones para continuar
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}