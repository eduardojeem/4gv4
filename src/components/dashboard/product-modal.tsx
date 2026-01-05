'use client'

import { useState, useEffect } from 'react'
import { motion  } from '../ui/motion'
import { X, Upload, Package, Tag, Warehouse, BarChart3, RefreshCw, Users, Sparkles, Scan, Plus } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Product, Category, Supplier, ProductFormData } from '@/types/products'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { ImageUploader } from '@/components/dashboard/products/ImageUploader'
import { validateProductForm, generateEAN13 } from '@/lib/validations/product-validation'
import { CategoryModal } from './category-modal'
import { SupplierModal } from './supplier-modal'
import { useCategories } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import type { UISupplier } from '@/lib/types/supplier-ui'

interface ProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSave: (productData: ProductFormData) => Promise<void>
  categories: Category[]
  suppliers: Supplier[]
}

export function ProductModal({
  product,
  isOpen,
  onClose,
  onSave,
  categories,
  suppliers
}: ProductModalProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    brand: '',
    supplier_id: '',
    purchase_price: 0,
    sale_price: 0,
    wholesale_price: 0,
    offer_price: 0,
    has_offer: false,
    stock_quantity: 0,
    min_stock: 0,
    max_stock: 0,
    unit_measure: '',
    barcode: '',
    is_active: true,
    images: []
  })

  const [loading, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('basic')

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const { createCategory } = useCategories()
  const { createSupplier } = useSuppliers()

  // Local state for lists to support instant updates
  const [localCategories, setLocalCategories] = useState<Category[]>(categories)
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers)

  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  useEffect(() => {
    setLocalSuppliers(suppliers)
  }, [suppliers])

  const handleSaveCategory = async (categoryData: any) => {
    const result = await createCategory(categoryData)
    if (result.success && result.data) {
       toast.success('Categoría creada')
       const newCategory = result.data as unknown as Category
       setLocalCategories(prev => [...prev, newCategory])
       handleInputChange('category_id', newCategory.id)
       setIsCategoryModalOpen(false)
    } else {
       toast.error(result.error || 'Error al crear categoría')
    }
  }

  const handleSaveSupplier = async (supplierData: Partial<UISupplier>) => {
    const result = await createSupplier(supplierData as any)
    if (result.success && result.data) {
       toast.success('Proveedor creado')
       const newSupplier = result.data as unknown as Supplier
       setLocalSuppliers(prev => [...prev, newSupplier])
       handleInputChange('supplier_id', newSupplier.id)
       setIsSupplierModalOpen(false)
    } else {
       toast.error(result.error || 'Error al crear proveedor')
    }
  }

  // Generar SKU automático
  const generateSKU = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `PROD-${timestamp}-${random}`
  }

  // Inicializar formulario cuando cambia el producto
  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        category_id: product.category_id || '',
        brand: product.brand || '',
        supplier_id: product.supplier_id || '',
        purchase_price: product.purchase_price || 0,
        sale_price: product.sale_price || 0,
        wholesale_price: product.wholesale_price || 0,
        offer_price: product.offer_price || 0,
        has_offer: product.has_offer || false,
        stock_quantity: product.stock_quantity || 0,
        min_stock: product.min_stock || 0,
        max_stock: product.max_stock || 0,
        unit_measure: product.unit_measure || '',
        barcode: product.barcode || '',
        is_active: product.is_active ?? true,
        images: product.images || []
      })
    } else {
      // Resetear formulario para nuevo producto
      setFormData({
        sku: '',
        name: '',
        description: '',
        category_id: '',
        brand: '',
        supplier_id: '',
        purchase_price: 0,
        sale_price: 0,
        wholesale_price: 0,
        offer_price: 0,
        has_offer: false,
        stock_quantity: 0,
        min_stock: 0,
        max_stock: 0,
        unit_measure: '',
        barcode: '',
        is_active: true,
        images: []
      })
    }
    setErrors({})
  }, [product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar formulario con el sistema de validaciones mejorado
    const validation = await validateProductForm(formData, !!product)
    
    if (!validation.isValid) {
      setErrors(validation.errors)
      toast.error('Por favor corrige los errores en el formulario', {
        description: 'Revisa los campos marcados en rojo'
      })
      return
    }

    setSaving(true)
    let retries = 0
    const maxRetries = 3

    const attemptSave = async (): Promise<boolean> => {
      try {
        await onSave(formData)
        toast.success(
          product ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente',
          {
            description: `SKU: ${formData.sku}`,
            duration: 5000
          }
        )
        onClose()
        return true
      } catch (error) {
        retries++
        
        if (error instanceof Error) {
          // Errores específicos del servidor
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            toast.error('SKU duplicado', {
              description: 'Este código ya existe en el sistema'
            })
            setErrors({ sku: 'Este SKU ya existe' })
            return false
          }
          
          if (error.message.includes('network') || error.message.includes('fetch')) {
            if (retries < maxRetries) {
              toast.warning(`Error de conexión. Reintentando... (${retries}/${maxRetries})`)
              await new Promise(resolve => setTimeout(resolve, 1000 * retries))
              return attemptSave()
            } else {
              toast.error('Error de conexión', {
                description: 'No se pudo conectar con el servidor. Verifica tu conexión.',
                action: {
                  label: 'Reintentar',
                  onClick: () => handleSubmit(e)
                }
              })
            }
          }
          
          toast.error('Error al guardar', {
            description: error.message
          })
        } else {
          toast.error('Error desconocido', {
            description: 'Ocurrió un error inesperado. Por favor intenta nuevamente.'
          })
        }
        
        console.error('Error saving product:', error)
        return false
      } finally {
        setSaving(false)
      }
    }

    await attemptSave()
  }

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const calculateMargin = () => {
    if (formData.purchase_price > 0 && formData.sale_price > 0) {
      return ((formData.sale_price - formData.purchase_price) / formData.sale_price * 100).toFixed(1)
    }
    return '0'
  }


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full lg:max-w-6xl h-[95vh] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  {product ? 'Editar Producto' : 'Nuevo Producto'}
                </DialogTitle>
                <DialogDescription className="text-blue-100 dark:text-blue-200 mt-1">
                  {product ? `SKU: ${product.sku}` : 'Completa la información del nuevo producto'}
                </DialogDescription>
              </div>
            </div>
            {product && (
              <Badge className="bg-white/20 text-white border-white/30">
                {product.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="md:w-56 bg-gray-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full">
              <TabsList className="flex flex-col h-auto bg-transparent w-full gap-2 text-gray-500 dark:text-gray-400">
                <TabsTrigger
                  value="basic"
                  className="w-full justify-start gap-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                >
                  <Tag className="h-4 w-4" />
                  <span className="hidden md:inline">Información Básica</span>
                  <span className="md:hidden">Básica</span>
                </TabsTrigger>
                <TabsTrigger
                  value="pricing"
                  className="w-full justify-start gap-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                >
                  <GSIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Precios y Ofertas</span>
                  <span className="md:hidden">Precios</span>
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="w-full justify-start gap-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                >
                  <Warehouse className="h-4 w-4" />
                  <span className="hidden md:inline">Inventario</span>
                  <span className="md:hidden">Stock</span>
                </TabsTrigger>
                <TabsTrigger
                  value="images"
                  className="w-full justify-start gap-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden md:inline">Imágenes</span>
                  <span className="md:hidden">Fotos</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Quick Info Sidebar */}
            {product && (
              <div className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm space-y-3 border border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Vista Rápida</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Stock</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{formData.stock_quantity} unidades</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Precio Venta</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(formData.sale_price)}</p>
                  </div>
                  {formData.has_offer && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Precio Oferta</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(formData.offer_price || 0)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" orientation="vertical">

              <TabsContent value="basic" className="space-y-6 py-4">
                <Card className="border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-800 dark:to-slate-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Información del Producto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sku" className="text-sm font-medium text-gray-700 dark:text-gray-300">SKU / Código *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="sku"
                            value={formData.sku}
                            onChange={(e) => handleInputChange('sku', e.target.value)}
                            placeholder="Ej: PROD-001"
                            className={`bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 ${errors.sku ? 'border-red-500' : ''}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleInputChange('sku', generateSKU())}
                            title="Generar código automáticamente"
                            className="shrink-0 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
                        {errors.sku && <p className="text-sm text-red-500">{errors.sku}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Producto *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Ej: iPhone 14 Pro"
                          className={`bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 ${errors.name ? 'border-red-500' : ''}`}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="brand" className="text-sm font-medium text-gray-700 dark:text-gray-300">Marca</Label>
                        <Input
                          id="brand"
                          value={formData.brand || ''}
                          onChange={(e) => handleInputChange('brand', e.target.value)}
                          placeholder="Ej: Apple"
                          className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="unit" className="text-sm font-medium text-gray-700 dark:text-gray-300">Unidad de Medida</Label>
                        <Select
                          value={formData.unit_measure || ''}
                          onValueChange={(value) => handleInputChange('unit_measure', value)}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            <SelectValue placeholder="Seleccionar unidad" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700">
                            <SelectItem value="unidad" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Unidad</SelectItem>
                            <SelectItem value="kg" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Kilogramo</SelectItem>
                            <SelectItem value="g" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Gramo</SelectItem>
                            <SelectItem value="l" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Litro</SelectItem>
                            <SelectItem value="ml" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Mililitro</SelectItem>
                            <SelectItem value="m" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Metro</SelectItem>
                            <SelectItem value="cm" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Centímetro</SelectItem>
                            <SelectItem value="caja" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Caja</SelectItem>
                            <SelectItem value="paquete" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">Paquete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="barcode" className="text-sm font-medium text-gray-700 dark:text-gray-300">Código de Barras</Label>
                        <div className="flex gap-2">
                          <Input
                            id="barcode"
                            value={formData.barcode || ''}
                            onChange={(e) => handleInputChange('barcode', e.target.value)}
                            placeholder="Ej: 7501234567890"
                            pattern="[0-9]{8,13}"
                            className={`bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 ${errors.barcode ? 'border-red-500' : ''}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleInputChange('barcode', generateEAN13())}
                            title="Generar código automáticamente"
                            className="shrink-0 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
                        {errors.barcode && <p className="text-sm text-red-500">{errors.barcode}</p>}
                        {formData.barcode && !errors.barcode && (
                          <p className="text-xs text-green-600 dark:text-green-400">✓ Código de barras válido</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Descripción detallada del producto..."
                        rows={3}
                        className="resize-none bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-100 dark:border-purple-900/50 bg-gradient-to-br from-white to-purple-50/30 dark:from-slate-800 dark:to-slate-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Categorización
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</Label>
                        <div className="flex gap-2">
                          <Select
                            value={formData.category_id || ''}
                            onValueChange={(value) => handleInputChange('category_id', value)}
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 w-full">
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700">
                              {localCategories.map((category) => (
                                <SelectItem key={category.id} value={category.id} className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsCategoryModalOpen(true)}
                            title="Agregar nueva categoría"
                            className="shrink-0 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="supplier" className="text-sm font-medium text-gray-700 dark:text-gray-300">Proveedor</Label>
                        <div className="flex gap-2">
                          <Select
                            value={formData.supplier_id || ''}
                            onValueChange={(value) => handleInputChange('supplier_id', value)}
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 w-full">
                              <SelectValue placeholder="Seleccionar proveedor" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700">
                              {localSuppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id} className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-slate-800">
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsSupplierModalOpen(true)}
                            title="Agregar nuevo proveedor"
                            className="shrink-0 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <Switch
                        id="active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                      />
                      <Label htmlFor="active" className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300">
                        Producto activo
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-6 py-4">
                {/* Precios Base */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-1 bg-blue-500 rounded-full" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Precios Base</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Precio de Compra */}
                    <div className="space-y-2">
                      <Label htmlFor="purchase_price" className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <GSIcon className="h-4 w-4" />
                        Precio de Compra (Costo)
                      </Label>
                      <Input
                        id="purchase_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.purchase_price}
                        onChange={(e) => handleInputChange('purchase_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`text-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white ${errors.purchase_price ? 'border-red-500' : 'border-orange-200 dark:border-orange-900 focus:border-orange-500'}`}
                      />
                      {errors.purchase_price && <p className="text-sm text-red-500">{errors.purchase_price}</p>}
                    </div>

                    {/* Precio de Venta */}
                    <div className="space-y-2">
                      <Label htmlFor="sale_price" className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Precio de Venta al Público *
                      </Label>
                      <Input
                        id="sale_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.sale_price}
                        onChange={(e) => handleInputChange('sale_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`text-lg font-semibold bg-white dark:bg-slate-900 text-gray-900 dark:text-white ${errors.sale_price ? 'border-red-500' : 'border-green-200 dark:border-green-900 focus:border-green-500'}`}
                      />
                      {errors.sale_price && <p className="text-sm text-red-500">{errors.sale_price}</p>}
                      {formData.purchase_price > 0 && formData.sale_price > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">Margen:</span>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {calculateMargin()}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Precios Especiales */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-1 bg-purple-500 rounded-full" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Precios Especiales</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Precio Mayorista */}
                    <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-slate-900">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                          <Users className="h-4 w-4" />
                          Precio Mayorista
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.wholesale_price || 0}
                          onChange={(e) => handleInputChange('wholesale_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="text-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-blue-200 dark:border-blue-800"
                        />
                        {formData.wholesale_price && formData.wholesale_price > 0 && formData.sale_price > 0 && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Descuento: {((1 - formData.wholesale_price / formData.sale_price) * 100).toFixed(1)}% del precio público
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Precio Oferta */}
                    <Card className={`border-2 transition-all ${formData.has_offer
                      ? 'border-red-400 dark:border-red-800 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10 shadow-lg shadow-red-100 dark:shadow-none'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900'
                      }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className={`text-sm font-medium flex items-center gap-2 ${formData.has_offer ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                            <Tag className="h-4 w-4" />
                            Precio en Oferta
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {formData.has_offer ? 'Activa' : 'Inactiva'}
                            </span>
                            <Switch
                              checked={formData.has_offer}
                              onCheckedChange={(checked) => handleInputChange('has_offer', checked)}
                              className="data-[state=checked]:bg-red-500"
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.offer_price}
                          onChange={(e) => handleInputChange('offer_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          disabled={!formData.has_offer}
                          className={`text-lg bg-white dark:bg-slate-900 ${!formData.has_offer ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white' : 'font-semibold text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'}`}
                        />
                        {formData.has_offer && (formData.offer_price ?? 0) > 0 && formData.sale_price > 0 && (
                          <div className="flex items-center justify-between p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <span className="text-xs font-medium text-red-700 dark:text-red-400">Ahorro:</span>
                            <div className="text-right">
                              <div className="text-sm font-bold text-red-700 dark:text-red-400">
                                {formatCurrency(formData.sale_price - (formData.offer_price ?? 0))}
                              </div>
                              <div className="text-xs text-red-600 dark:text-red-300">
                                ({((1 - (formData.offer_price ?? 0) / formData.sale_price) * 100).toFixed(0)}% desc.)
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Resumen de Rentabilidad */}
                {formData.purchase_price > 0 && formData.sale_price > 0 && (
                  <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <BarChart3 className="h-5 w-5" />
                        Análisis de Rentabilidad
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Ganancia Normal */}
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-800">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia Normal</div>
                          <div className="text-lg font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(formData.sale_price - formData.purchase_price)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{calculateMargin()}% margen</div>
                        </div>

                        {/* Ganancia Mayorista */}
                        {(formData.wholesale_price ?? 0) > 0 && (
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia Mayorista</div>
                            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                              {formatCurrency((formData.wholesale_price ?? 0) - formData.purchase_price)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {((formData.wholesale_price! - formData.purchase_price) / formData.wholesale_price! * 100).toFixed(1)}% margen
                            </div>
                          </div>
                        )}

                        {/* Ganancia en Oferta */}
                        {formData.has_offer && (formData.offer_price ?? 0) > 0 && (
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-red-100 dark:border-red-800">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia en Oferta</div>
                            <div className="text-lg font-bold text-red-700 dark:text-red-400">
                              {formatCurrency((formData.offer_price ?? 0) - formData.purchase_price)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {(((formData.offer_price ?? 0) - formData.purchase_price) / ((formData.offer_price ?? 0) || 1) * 100).toFixed(1)}% margen
                            </div>
                          </div>
                        )}

                        {/* Precio Promedio */}
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-100 dark:border-purple-800">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Precio Promedio</div>
                          <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                            {formatCurrency(
                              [formData.sale_price, formData.wholesale_price || 0, formData.has_offer ? (formData.offer_price ?? 0) : 0]
                                .filter(p => p > 0)
                                .reduce((a, b) => a + b, 0) /
                              [formData.sale_price, formData.wholesale_price || 0, formData.has_offer ? (formData.offer_price ?? 0) : 0]
                                .filter(p => p > 0).length
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Entre precios activos</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="inventory" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Warehouse className="h-4 w-4" />
                        Stock Actual
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        type="number"
                        min="0"
                        value={formData.stock_quantity}
                        onChange={(e) => handleInputChange('stock_quantity', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className={`bg-white dark:bg-slate-900 text-gray-900 dark:text-white ${errors.stock_quantity ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                      />
                      {errors.stock_quantity && <p className="text-sm text-red-500 mt-1">{errors.stock_quantity}</p>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Package className="h-4 w-4" />
                        Stock Mínimo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        type="number"
                        min="0"
                        value={formData.min_stock}
                        onChange={(e) => handleInputChange('min_stock', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className={`bg-white dark:bg-slate-900 text-gray-900 dark:text-white ${errors.min_stock ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                      />
                      {errors.min_stock && <p className="text-sm text-red-500 mt-1">{errors.min_stock}</p>}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Se generará una alerta cuando el stock esté por debajo de este valor
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Warehouse className="h-4 w-4 text-amber-600" />
                        Stock Máximo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        type="number"
                        min="0"
                        value={formData.max_stock}
                        onChange={(e) => handleInputChange('max_stock', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className={`bg-white dark:bg-slate-900 text-gray-900 dark:text-white ${errors.max_stock ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                      />
                      {errors.max_stock && <p className="text-sm text-red-500 mt-1">{errors.max_stock}</p>}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Límite superior recomendado para este producto
                      </p>
                      {formData.max_stock && formData.max_stock > 0 && formData.max_stock <= formData.min_stock && (
                        <p className="text-sm text-amber-600 mt-1">
                          ⚠️ El stock máximo debe ser mayor al stock mínimo
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Resumen de inventario */}
                <Card className="bg-gray-50 dark:bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-900 dark:text-gray-100">Resumen de Inventario</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Stock Actual:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formData.stock_quantity} {formData.unit_measure}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Valor Total en Stock:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(formData.sale_price * formData.stock_quantity)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Estado del Stock:</span>
                      <Badge variant={
                        formData.stock_quantity === 0 ? 'destructive' :
                          formData.stock_quantity <= formData.min_stock ? 'secondary' : 'default'
                      } className={
                        formData.stock_quantity <= formData.min_stock && formData.stock_quantity > 0 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                          : ''
                      }>
                        {formData.stock_quantity === 0 ? 'Agotado' :
                          formData.stock_quantity <= formData.min_stock ? 'Stock Bajo' : 'En Stock'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="images" className="space-y-4 py-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Upload className="h-4 w-4" />
                      Imágenes del Producto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageUploader
                      images={formData.images || []}
                      onChange={(images) => handleInputChange('images', images)}
                      maxImages={5}
                      maxSize={5242880}
                      disabled={loading}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </form>

        {/* Modern Sticky Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-800 px-8 py-4 flex justify-between items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 hidden md:block">
            {product ? 'Modificando producto existente' : 'Creando nuevo producto'}
          </div>
          <div className="flex gap-3 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-w-[100px] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              className="min-w-[140px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-900/30"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  {product ? 'Actualizar Producto' : 'Crear Producto'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <CategoryModal
      isOpen={isCategoryModalOpen}
      onClose={() => setIsCategoryModalOpen(false)}
      mode="add"
      onSave={handleSaveCategory}
      existingCategories={localCategories}
    />

    <SupplierModal
      isOpen={isSupplierModalOpen}
      onClose={() => setIsSupplierModalOpen(false)}
      mode="add"
      onSave={handleSaveSupplier}
    />
    </>
  )
}

export default ProductModal
