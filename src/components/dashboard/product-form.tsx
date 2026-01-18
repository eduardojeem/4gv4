'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Calculator, Package, Users, Image as ImageIcon, Barcode, Tag } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImageUpload } from './image-upload'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import type { Database } from '@/lib/supabase/types'

interface ProductFormData {
  // Información básica
  name: string
  description: string
  sku: string
  barcode: string
  category: string
  subcategory: string
  brand: string
  model: string
  
  // Precios
  purchasePrice: number
  wholesalePrice: number
  retailPrice: number
  
  // Márgenes calculados
  wholesaleMargin: number
  retailMargin: number
  
  // Inventario
  stock: number
  minStock: number
  maxStock: number
  location: string
  
  // Proveedor
  supplierId: string
  supplierCode: string
  supplierPrice: number
  
  // Características
  weight: number
  dimensions: {
    length: number
    width: number
    height: number
  }
  
  // Estado
  isActive: boolean
  isFeatured: boolean
  isOnSale: boolean
  salePrice?: number
  
  // Imágenes
  images: string[]
  
  // Metadatos
  tags: string[]
  notes: string
}

interface Supplier {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  isActive: boolean
}

interface Category {
  id: string
  name: string
  subcategories: string[]
}

interface ProductFormProps {
  initialData?: Partial<ProductFormData>
  onSubmit: (data: ProductFormData) => void
  onCancel: () => void
  isEditing?: boolean
}

export function ProductForm({ initialData, onSubmit, onCancel, isEditing = false }: ProductFormProps) {
  const supabase = createClient() as any
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    category: '',
    subcategory: '',
    brand: '',
    model: '',
    purchasePrice: 0,
    wholesalePrice: 0,
    retailPrice: 0,
    wholesaleMargin: 0,
    retailMargin: 0,
    stock: 0,
    minStock: 5,
    maxStock: 100,
    location: '',
    supplierId: '',
    supplierCode: '',
    supplierPrice: 0,
    weight: 0,
    dimensions: { length: 0, width: 0, height: 0 },
    isActive: true,
    isFeatured: false,
    isOnSale: false,
    images: [],
    tags: [],
    notes: '',
    ...initialData
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [newTag, setNewTag] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Cargar categorías y proveedores reales desde Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!config.supabase.isConfigured) return
      try {
        const catResult = await supabase.from('categories').select('id, name, description')
        const supResult = await supabase.from('suppliers').select('id, name, contact_name, phone, email')
        const { data: catData, error: catError } = catResult
        const { data: supData, error: supError } = supResult
        if (!catError && Array.isArray(catData)) {
          const mappedCats: Category[] = (catData as any[]).map(c => ({ id: c.id, name: c.name, subcategories: [] }))
          setCategories(mappedCats)
        }
        if (!supError && Array.isArray(supData)) {
          const mappedSuppliers: Supplier[] = (supData as any[]).map(s => ({
            id: s.id,
            name: s.name,
            contact: s.contact_name || '',
            email: s.email || '',
            phone: s.phone || '',
            isActive: true
          }))
          setSuppliers(mappedSuppliers)
        }
      } catch (e) {
        console.error('Error al cargar datos desde Supabase:', (e as any)?.message)
      }
    }
    loadData()
  }, [])

  // Calcular márgenes automáticamente
  useEffect(() => {
    if (formData.purchasePrice > 0) {
      const wholesaleMargin = formData.wholesalePrice > 0 
        ? ((formData.wholesalePrice - formData.purchasePrice) / formData.purchasePrice) * 100 
        : 0
      const retailMargin = formData.retailPrice > 0 
        ? ((formData.retailPrice - formData.purchasePrice) / formData.purchasePrice) * 100 
        : 0
      
      setFormData(prev => ({
        ...prev,
        wholesaleMargin: Math.round(wholesaleMargin * 100) / 100,
        retailMargin: Math.round(retailMargin * 100) / 100
      }))
    }
  }, [formData.purchasePrice, formData.wholesalePrice, formData.retailPrice])

  // Actualizar selección de categoría cuando cambia el ID
  useEffect(() => {
    const category = categories.find(cat => cat.id === formData.category) || null
    setSelectedCategory(category)
    if (category && category.subcategories.length > 0 && !category.subcategories.includes(formData.subcategory)) {
      setFormData(prev => ({ ...prev, subcategory: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.category, categories])

  // Generar SKU automático
  const generateSKU = () => {
    const categoryName = selectedCategory?.name || ''
    const categoryCode = categoryName.substring(0, 3).toUpperCase()
    const brandCode = formData.brand.substring(0, 3).toUpperCase()
    const timestamp = Date.now().toString().slice(-6)
    const sku = `${categoryCode}${brandCode}${timestamp}`
    setFormData(prev => ({ ...prev, sku }))
  }

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleDimensionChange = (dimension: keyof ProductFormData['dimensions'], value: number) => {
    setFormData(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, [dimension]: value }
    }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    if (!formData.category) newErrors.category = 'La categoría es requerida'
    if (!formData.supplierId) newErrors.supplierId = 'El proveedor es requerido'
    if (formData.purchasePrice <= 0) newErrors.purchasePrice = 'El precio de compra debe ser mayor a 0'
    if (formData.retailPrice <= 0) newErrors.retailPrice = 'El precio de venta debe ser mayor a 0'
    if (formData.retailPrice <= formData.purchasePrice) {
      newErrors.retailPrice = 'El precio de venta debe ser mayor al precio de compra'
    }
    if (formData.wholesalePrice > 0 && formData.wholesalePrice <= formData.purchasePrice) {
      newErrors.wholesalePrice = 'El precio mayorista debe ser mayor al precio de compra'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const selectedSupplier = suppliers.find(s => s.id === formData.supplierId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing ? 'Modifica la información del producto' : 'Completa la información para agregar un nuevo producto'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {isEditing ? 'Actualizar' : 'Crear'} Producto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="pricing">Precios</TabsTrigger>
          <TabsTrigger value="inventory">Inventario</TabsTrigger>
          <TabsTrigger value="supplier">Proveedor</TabsTrigger>
          <TabsTrigger value="images">Imágenes</TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
        </TabsList>

        {/* Información Básica */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Información Básica
              </CardTitle>
              <CardDescription>
                Información principal del producto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Producto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ej: iPhone 15 Pro Max 256GB"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="Ej: Apple"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="Ej: A2849"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
                </div>

                {selectedCategory && selectedCategory.subcategories.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Subcategoría</Label>
                    <Select value={formData.subcategory} onValueChange={(value) => handleInputChange('subcategory', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una subcategoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCategory.subcategories.map((subcategory) => (
                          <SelectItem key={subcategory} value={subcategory}>
                            {subcategory}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      placeholder="Código único del producto"
                    />
                    <Button type="button" variant="outline" onClick={generateSKU}>
                      <Barcode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => handleInputChange('barcode', e.target.value)}
                    placeholder="Código de barras del producto"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descripción detallada del producto..."
                  rows={3}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                  />
                  <Label htmlFor="isActive">Producto activo</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onCheckedChange={(checked) => handleInputChange('isFeatured', checked)}
                  />
                  <Label htmlFor="isFeatured">Producto destacado</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Precios */}
        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GSIcon className="h-5 w-5" />
                Gestión de Precios
              </CardTitle>
              <CardDescription>
                Configura los precios de compra, mayorista y venta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Precio de Compra *</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => handleInputChange('purchasePrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors.purchasePrice ? 'border-red-500' : ''}
                  />
                  {errors.purchasePrice && <p className="text-sm text-red-500">{errors.purchasePrice}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wholesalePrice">Precio Mayorista</Label>
                  <Input
                    id="wholesalePrice"
                    type="number"
                    step="0.01"
                    value={formData.wholesalePrice}
                    onChange={(e) => handleInputChange('wholesalePrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors.wholesalePrice ? 'border-red-500' : ''}
                  />
                  {errors.wholesalePrice && <p className="text-sm text-red-500">{errors.wholesalePrice}</p>}
                  {formData.wholesalePrice > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Margen: {formData.wholesaleMargin}%
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retailPrice">Precio de Venta *</Label>
                  <Input
                    id="retailPrice"
                    type="number"
                    step="0.01"
                    value={formData.retailPrice}
                    onChange={(e) => handleInputChange('retailPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors.retailPrice ? 'border-red-500' : ''}
                  />
                  {errors.retailPrice && <p className="text-sm text-red-500">{errors.retailPrice}</p>}
                  {formData.retailPrice > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Margen: {formData.retailMargin}%
                    </p>
                  )}
                </div>
              </div>

              {formData.purchasePrice > 0 && (
                <Alert>
                  <Calculator className="h-4 w-4" />
                  <AlertDescription>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="font-medium">Margen Mayorista:</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formData.wholesaleMargin}%
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Margen Venta:</p>
                        <p className="text-lg font-bold text-green-600">
                          {formData.retailMargin}%
                        </p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isOnSale"
                    checked={formData.isOnSale}
                    onCheckedChange={(checked) => handleInputChange('isOnSale', checked)}
                  />
                  <Label htmlFor="isOnSale">Producto en oferta</Label>
                </div>

                {formData.isOnSale && (
                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Precio de Oferta</Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      value={formData.salePrice || ''}
                      onChange={(e) => handleInputChange('salePrice', parseFloat(e.target.value) || undefined)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventario */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Control de Inventario
              </CardTitle>
              <CardDescription>
                Gestiona el stock y ubicación del producto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Actual</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minStock">Stock Mínimo</Label>
                  <Input
                    id="minStock"
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => handleInputChange('minStock', parseInt(e.target.value) || 0)}
                    placeholder="5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStock">Stock Máximo</Label>
                  <Input
                    id="maxStock"
                    type="number"
                    value={formData.maxStock}
                    onChange={(e) => handleInputChange('maxStock', parseInt(e.target.value) || 0)}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación en Almacén</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Ej: Estante A-3, Vitrina Principal"
                />
              </div>

              {formData.stock <= formData.minStock && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    El stock actual está por debajo del mínimo recomendado.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proveedor */}
        <TabsContent value="supplier" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Información del Proveedor
              </CardTitle>
              <CardDescription>
                Selecciona y configura el proveedor del producto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplierId">Proveedor *</Label>
                <Select value={formData.supplierId} onValueChange={(value) => handleInputChange('supplierId', value)}>
                  <SelectTrigger className={errors.supplierId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{supplier.name}</span>
                          <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                            {supplier.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.supplierId && <p className="text-sm text-red-500">{errors.supplierId}</p>}
              </div>

              {selectedSupplier && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">Contacto:</p>
                        <p>{selectedSupplier.contact}</p>
                      </div>
                      <div>
                        <p className="font-medium">Email:</p>
                        <p>{selectedSupplier.email}</p>
                      </div>
                      <div>
                        <p className="font-medium">Teléfono:</p>
                        <p>{selectedSupplier.phone}</p>
                      </div>
                      <div>
                        <p className="font-medium">Estado:</p>
                        <Badge variant={selectedSupplier.isActive ? 'default' : 'secondary'}>
                          {selectedSupplier.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplierCode">Código del Proveedor</Label>
                  <Input
                    id="supplierCode"
                    value={formData.supplierCode}
                    onChange={(e) => handleInputChange('supplierCode', e.target.value)}
                    placeholder="Código interno del proveedor"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplierPrice">Precio del Proveedor</Label>
                  <Input
                    id="supplierPrice"
                    type="number"
                    step="0.01"
                    value={formData.supplierPrice}
                    onChange={(e) => handleInputChange('supplierPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Imágenes */}
        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Imágenes del Producto
              </CardTitle>
              <CardDescription>
                Sube imágenes de alta calidad del producto. La primera imagen será la imagen principal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                onImagesChange={(images) => {
                  // Aquí puedes manejar las imágenes subidas
                  console.log('Imágenes subidas:', images)
                }}
                maxImages={10}
                maxSizeInMB={5}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detalles */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Detalles Adicionales
              </CardTitle>
              <CardDescription>
                Información adicional y características del producto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Peso (g)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="length">Largo (cm)</Label>
                  <Input
                    id="length"
                    type="number"
                    step="0.1"
                    value={formData.dimensions.length}
                    onChange={(e) => handleDimensionChange('length', parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Ancho (cm)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.1"
                    value={formData.dimensions.width}
                    onChange={(e) => handleDimensionChange('width', parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Alto (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    step="0.1"
                    value={formData.dimensions.height}
                    onChange={(e) => handleDimensionChange('height', parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Etiquetas</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Agregar etiqueta..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Agregar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Notas internas, observaciones, etc..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  )
}

export default ProductForm
