'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Edit, Trash2, Save, X, Palette, Ruler, Type, Hash, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useProductVariants } from '@/hooks/useProductVariants'
import { VariantAttribute, VariantOption, ProductVariant, VariantAttributeValue } from '@/types/product-variants'
import { toast } from 'sonner'

interface VariantManagerProps {
  productId?: string
  onVariantSelect?: (variant: ProductVariant) => void
}

export function VariantManager({ productId, onVariantSelect }: VariantManagerProps) {
  const {
    attributes,
    products,
    loading,
    createAttribute,
    updateAttribute,
    deleteAttribute,
    addAttributeOption,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant
  } = useProductVariants()

  const [activeTab, setActiveTab] = useState('attributes')
  const [editingAttribute, setEditingAttribute] = useState<VariantAttribute | null>(null)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [showCreateAttribute, setShowCreateAttribute] = useState(false)
  const [showCreateVariant, setShowCreateVariant] = useState(false)

  // Formulario para nuevo atributo
  const [newAttribute, setNewAttribute] = useState<{
    name: string
    type: VariantAttribute['type']
    required: boolean
    options: Omit<VariantOption, 'id' | 'attribute_id'>[]
  }>({
    name: '',
    type: 'text',
    required: false,
    options: []
  })

  // Formulario para nueva variante
  const [newVariant, setNewVariant] = useState({
    sku: '',
    name: '',
    attributes: [] as VariantAttributeValue[],
    price: 0,
    wholesale_price: 0,
    cost_price: 0,
    stock: 0,
    min_stock: 0,
    active: true
  })

  const currentProduct = useMemo(() => 
    productId ? products.find(p => p.id === productId) : null,
    [products, productId]
  )

  const availableAttributes = useMemo(() => 
    currentProduct ? attributes.filter(attr => 
      currentProduct.variant_attributes.includes(attr.id)
    ) : attributes,
    [attributes, currentProduct]
  )

  // Crear nuevo atributo
  const handleCreateAttribute = async () => {
    try {
      await createAttribute(newAttribute)
      setNewAttribute({
        name: '',
        type: 'text',
        required: false,
        options: []
      })
      setShowCreateAttribute(false)
    } catch (error) {
      console.error('Error creating attribute:', error)
    }
  }

  // Agregar opción a nuevo atributo
  const addOptionToNewAttribute = () => {
    setNewAttribute(prev => ({
      ...prev,
      options: [...prev.options, {
        value: '',
        sort_order: prev.options.length + 1,
        active: true
      }]
    }))
  }

  // Crear nueva variante
  const handleCreateVariant = async () => {
    if (!productId) {
      toast.error('Selecciona un producto primero')
      return
    }

    try {
      await createProductVariant(productId, newVariant)
      setNewVariant({
        sku: '',
        name: '',
        attributes: [],
        price: 0,
        wholesale_price: 0,
        cost_price: 0,
        stock: 0,
        min_stock: 0,
        active: true
      })
      setShowCreateVariant(false)
    } catch (error) {
      console.error('Error creating variant:', error)
    }
  }

  // Componente para editar atributo
  const AttributeEditor = ({ attribute }: { attribute: VariantAttribute }) => {
    const [editData, setEditData] = useState(attribute)

    const handleSave = async () => {
      try {
        await updateAttribute(attribute.id, editData)
        setEditingAttribute(null)
      } catch (error) {
        console.error('Error updating attribute:', error)
      }
    }

    return (
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {attribute.type === 'color' && <Palette className="h-4 w-4" />}
              {attribute.type === 'size' && <Ruler className="h-4 w-4" />}
              {attribute.type === 'text' && <Type className="h-4 w-4" />}
              {attribute.type === 'number' && <Hash className="h-4 w-4" />}
              <Input
                value={editData.name}
                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                className="font-semibold"
              />
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingAttribute(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editData.required}
                  onCheckedChange={(checked) => setEditData(prev => ({ ...prev, required: checked }))}
                />
                <Label>Requerido</Label>
              </div>
              <Select
                value={editData.type}
                onValueChange={(value: any) => setEditData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="size">Talla</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Opciones</Label>
              <div className="space-y-2 mt-2">
                {editData.options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.value}
                      onChange={(e) => {
                        const newOptions = [...editData.options]
                        newOptions[index] = { ...option, value: e.target.value }
                        setEditData(prev => ({ ...prev, options: newOptions }))
                      }}
                      placeholder="Valor de la opción"
                    />
                    {editData.type === 'color' && (
                      <Input
                        type="color"
                        value={option.color_hex || '#000000'}
                        onChange={(e) => {
                          const newOptions = [...editData.options]
                          newOptions[index] = { ...option, color_hex: e.target.value }
                          setEditData(prev => ({ ...prev, options: newOptions }))
                        }}
                        className="w-16"
                      />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newOptions = editData.options.filter((_, i) => i !== index)
                        setEditData(prev => ({ ...prev, options: newOptions }))
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newOption: VariantOption = {
                      id: `temp-${Date.now()}`,
                      attribute_id: attribute.id,
                      value: '',
                      sort_order: editData.options.length + 1,
                      active: true
                    }
                    setEditData(prev => ({ ...prev, options: [...prev.options, newOption] }))
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Opción
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Componente para mostrar variante
  const VariantCard = ({ variant }: { variant: ProductVariant }) => {
    return (
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {variant.name}
              {!variant.active && <Badge variant="secondary">Inactivo</Badge>}
              {variant.stock <= variant.min_stock && (
                <Badge variant="destructive">Stock Bajo</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingVariant(variant)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteProductVariant(variant.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {onVariantSelect && (
                <Button
                  size="sm"
                  onClick={() => onVariantSelect(variant)}
                >
                  Seleccionar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">SKU</Label>
              <p className="font-mono">{variant.sku}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Precio</Label>
              <p className="font-semibold">${variant.price.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Stock</Label>
              <p className={variant.stock <= variant.min_stock ? 'text-red-600 font-semibold' : ''}>
                {variant.stock}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Estado</Label>
              <p>{variant.active ? 'Activo' : 'Inactivo'}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <Label className="text-sm text-muted-foreground">Atributos</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {variant.attributes.map((attr) => (
                <Badge key={attr.attribute_id} variant="outline" className="flex items-center gap-1">
                  {attr.color_hex && (
                    <div 
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: attr.color_hex }}
                    />
                  )}
                  {attr.attribute_name}: {attr.value}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="attributes">Atributos</TabsTrigger>
          <TabsTrigger value="variants">Variantes</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Gestión de Atributos</h3>
            <Dialog open={showCreateAttribute} onOpenChange={setShowCreateAttribute}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Atributo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Atributo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nombre del Atributo</Label>
                    <Input
                      value={newAttribute.name}
                      onChange={(e) => setNewAttribute(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="ej: Color, Talla, Material"
                    />
                  </div>
                  
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={newAttribute.type}
                      onValueChange={(value: any) => setNewAttribute(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="color">Color</SelectItem>
                        <SelectItem value="size">Talla</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newAttribute.required}
                      onCheckedChange={(checked) => setNewAttribute(prev => ({ ...prev, required: checked }))}
                    />
                    <Label>Atributo requerido</Label>
                  </div>

                  <div>
                    <Label>Opciones</Label>
                    <div className="space-y-2 mt-2">
                      {newAttribute.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={option.value}
                            onChange={(e) => {
                              const newOptions = [...newAttribute.options]
                              newOptions[index] = { ...option, value: e.target.value }
                              setNewAttribute(prev => ({ ...prev, options: newOptions }))
                            }}
                            placeholder="Valor de la opción"
                          />
                          {newAttribute.type === 'color' && (
                            <Input
                              type="color"
                              value={option.color_hex || '#000000'}
                              onChange={(e) => {
                                const newOptions = [...newAttribute.options]
                                newOptions[index] = { ...option, color_hex: e.target.value }
                                setNewAttribute(prev => ({ ...prev, options: newOptions }))
                              }}
                              className="w-16"
                            />
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newOptions = newAttribute.options.filter((_, i) => i !== index)
                              setNewAttribute(prev => ({ ...prev, options: newOptions }))
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addOptionToNewAttribute}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Opción
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateAttribute} disabled={!newAttribute.name}>
                      Crear Atributo
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateAttribute(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {attributes.map((attribute) => (
              <div key={attribute.id}>
                {editingAttribute?.id === attribute.id ? (
                  <AttributeEditor attribute={attribute} />
                ) : (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {attribute.type === 'color' && <Palette className="h-4 w-4" />}
                          {attribute.type === 'size' && <Ruler className="h-4 w-4" />}
                          {attribute.type === 'text' && <Type className="h-4 w-4" />}
                          {attribute.type === 'number' && <Hash className="h-4 w-4" />}
                          {attribute.name}
                          {attribute.required && <Badge variant="secondary">Requerido</Badge>}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingAttribute(attribute)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteAttribute(attribute.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {attribute.options.map((option) => (
                          <Badge key={option.id} variant="outline" className="flex items-center gap-1">
                            {option.color_hex && (
                              <div 
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: option.color_hex }}
                              />
                            )}
                            {option.value}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Variantes {currentProduct && `de ${currentProduct.name}`}
            </h3>
            {productId && (
              <Dialog open={showCreateVariant} onOpenChange={setShowCreateVariant}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Variante
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Crear Nueva Variante</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>SKU</Label>
                        <Input
                          value={newVariant.sku}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, sku: e.target.value }))}
                          placeholder="Código único"
                        />
                      </div>
                      <div>
                        <Label>Nombre</Label>
                        <Input
                          value={newVariant.name}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nombre descriptivo"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newVariant.price}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label>Precio Mayorista</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newVariant.wholesale_price}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, wholesale_price: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label>Precio Costo</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newVariant.cost_price}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Stock</Label>
                        <Input
                          type="number"
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label>Stock Mínimo</Label>
                        <Input
                          type="number"
                          value={newVariant.min_stock}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={newVariant.active}
                        onCheckedChange={(checked) => setNewVariant(prev => ({ ...prev, active: checked }))}
                      />
                      <Label>Variante activa</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleCreateVariant} disabled={!newVariant.sku || !newVariant.name}>
                        Crear Variante
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateVariant(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!productId && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Selecciona un producto para ver y gestionar sus variantes
                </p>
              </CardContent>
            </Card>
          )}

          {currentProduct && (
            <div className="space-y-4">
              {currentProduct.variants.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      Este producto no tiene variantes aún
                    </p>
                  </CardContent>
                </Card>
              ) : (
                currentProduct.variants.map((variant) => (
                  <VariantCard key={variant.id} variant={variant} />
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}