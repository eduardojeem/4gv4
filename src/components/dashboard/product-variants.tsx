'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, Edit2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface ProductVariant {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  attributes: Record<string, string>
}

interface ProductVariantsProps {
  productId?: string
  variants?: ProductVariant[]
  onVariantsChange?: (variants: ProductVariant[]) => void
  readonly?: boolean
}

export function ProductVariants({ 
  productId, 
  variants = [], 
  onVariantsChange, 
  readonly = false 
}: ProductVariantsProps) {
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>(variants)
  const [isAddingVariant, setIsAddingVariant] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)

  const handleAddVariant = (variant: Omit<ProductVariant, 'id'>) => {
    const newVariant: ProductVariant = {
      ...variant,
      id: Date.now().toString()
    }
    const updatedVariants = [...localVariants, newVariant]
    setLocalVariants(updatedVariants)
    onVariantsChange?.(updatedVariants)
    setIsAddingVariant(false)
  }

  const handleEditVariant = (updatedVariant: ProductVariant | Omit<ProductVariant, 'id'>) => {
    // Si viene sin ID (lo cual no debería pasar en edición, pero por tipos...), lo ignoramos o manejamos
    if (!('id' in updatedVariant)) return;
    
    const updatedVariants = localVariants.map(v => 
      v.id === updatedVariant.id ? updatedVariant : v
    )
    setLocalVariants(updatedVariants)
    onVariantsChange?.(updatedVariants)
    setEditingVariant(null)
  }

  const handleDeleteVariant = (variantId: string) => {
    const updatedVariants = localVariants.filter(v => v.id !== variantId)
    setLocalVariants(updatedVariants)
    onVariantsChange?.(updatedVariants)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variantes del Producto</CardTitle>
        <CardDescription>
          Gestiona las diferentes variantes de este producto (tallas, colores, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {localVariants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay variantes configuradas para este producto
            </div>
          ) : (
            <div className="space-y-3">
              {localVariants.map((variant) => (
                <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{variant.name}</span>
                      <Badge variant="outline">{variant.sku}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Precio: ${variant.price.toFixed(2)} | Stock: {variant.stock}
                    </div>
                    {Object.keys(variant.attributes).length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {!readonly && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingVariant(variant)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteVariant(variant.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!readonly && (
            <Dialog open={isAddingVariant} onOpenChange={setIsAddingVariant}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Variante
                </Button>
              </DialogTrigger>
              <DialogContent>
                <VariantForm
                  onSubmit={handleAddVariant}
                  onCancel={() => setIsAddingVariant(false)}
                />
              </DialogContent>
            </Dialog>
          )}

          {editingVariant && (
            <Dialog open={!!editingVariant} onOpenChange={() => setEditingVariant(null)}>
              <DialogContent>
                <VariantForm
                  variant={editingVariant}
                  onSubmit={handleEditVariant}
                  onCancel={() => setEditingVariant(null)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface VariantFormProps {
  variant?: ProductVariant
  onSubmit: (variant: ProductVariant | Omit<ProductVariant, 'id'>) => void
  onCancel: () => void
}

function VariantForm({ variant, onSubmit, onCancel }: VariantFormProps) {
  const [formData, setFormData] = useState({
    name: variant?.name || '',
    sku: variant?.sku || '',
    price: variant?.price || 0,
    stock: variant?.stock || 0,
    attributes: variant?.attributes || {}
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (variant) {
      onSubmit({ ...variant, ...formData })
    } else {
      onSubmit(formData)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {variant ? 'Editar Variante' : 'Nueva Variante'}
        </DialogTitle>
        <DialogDescription>
          Configura los detalles de la variante del producto
        </DialogDescription>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Talla M, Color Rojo"
              required
            />
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
              placeholder="SKU único"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="stock">Stock</Label>
            <Input
              id="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {variant ? 'Actualizar' : 'Crear'} Variante
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export default ProductVariants