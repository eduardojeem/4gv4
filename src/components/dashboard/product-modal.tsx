'use client'

import { useState, useEffect } from 'react'
import { Upload, Package, Tag, Warehouse, BarChart3, RefreshCw, Users, Sparkles, Plus } from 'lucide-react'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import type { Product, Category, Supplier, Brand, ProductFormData } from '@/types/products'
import type { Category as UICategory } from '@/lib/types/catalog'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { ImageUploader } from '@/components/dashboard/products/ImageUploader'
import { generateEAN13 } from '@/lib/validations/product-validation'
import { productSchema, ProductFormValues } from '@/lib/validations/product-schema'
import { CategoryModal } from './category-modal'
import { SupplierModal } from './supplier-modal'
import { BrandModal } from '@/components/dashboard/brands/BrandModal'
import { useCategories } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useBrands } from '@/hooks/useBrands'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { uploadFile } from '@/lib/supabase-storage'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

interface ProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSave: (productData: ProductFormData) => Promise<void>
  categories: Category[]
  brands: Brand[]
  suppliers: Supplier[]
}

export function ProductModal({
  product,
  isOpen,
  onClose,
  onSave,
  categories,
  brands,
  suppliers
}: ProductModalProps) {
  const [activeTab, setActiveTab] = useState('basic')
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  
  const { createCategory } = useCategories()
  const { createSupplier } = useSuppliers()
  const { createBrand } = useBrands()

  // Local state for lists to support instant updates
  const [localCategories, setLocalCategories] = useState<Category[]>(categories ?? [])
  const [localBrands, setLocalBrands] = useState<Brand[]>(brands ?? [])
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers ?? [])

  // Form definition
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      category_id: '',
      brand: '',
      brand_id: '',
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
    }
  })

  const { formState: { isSubmitting, errors }, setValue, watch } = form
  
  // Watch values for calculations
  const purchasePrice = watch('purchase_price')
  const salePrice = watch('sale_price')
  const wholesalePrice = watch('wholesale_price')
  const offerPrice = watch('offer_price')
  const hasOffer = watch('has_offer')
  const stockQuantity = watch('stock_quantity')
  const minStock = watch('min_stock')
  const maxStock = watch('max_stock')
  const unitMeasure = watch('unit_measure')
  const sku = watch('sku')
  const barcode = watch('barcode')

  useEffect(() => {
    setLocalCategories(categories ?? [])
  }, [categories])

  useEffect(() => {
    setLocalBrands(brands ?? [])
  }, [brands])

  useEffect(() => {
    setLocalSuppliers(suppliers ?? [])
  }, [suppliers])

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      form.reset({
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        category_id: product.category_id || '',
        brand: product.brand || '',
        brand_id: (product as any).brand_id || '',
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
      form.reset({
        sku: '',
        name: '',
        description: '',
        category_id: '',
        brand: '',
        brand_id: '',
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
  }, [product, form])

  const handleSaveCategory = async (categoryData: any) => {
    const payload = {
      name: categoryData.name,
      description: categoryData.description,
      parent_id: categoryData.parentId || null,
      is_active: true
    }
    
    const result = await createCategory(payload)
    if (result.success && result.data) {
       toast.success('Categoría creada')
       const newCategory = result.data as unknown as Category
       setLocalCategories(prev => [...prev, newCategory])
       setValue('category_id', newCategory.id)
       setIsCategoryModalOpen(false)
    } else {
       toast.error(result.error || 'Error al crear categoría')
    }
  }

  // Convert DB categories to UI categories
  const uiCategories: UICategory[] = localCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    description: cat.description || '',
    subcategories: [],
    color: '#3B82F6',
    isActive: cat.is_active,
    productCount: 0,
    createdAt: cat.created_at,
    updatedAt: cat.updated_at,
    parentId: cat.parent_id || undefined,
    icon: 'Tag'
  }))

  const handleSaveSupplier = async (supplierData: Partial<UISupplier>) => {
    const result = await createSupplier(supplierData as any)
    if (result.success && result.data) {
       toast.success('Proveedor creado')
       const newSupplier = result.data as unknown as Supplier
       setLocalSuppliers(prev => [...prev, newSupplier])
       setValue('supplier_id', newSupplier.id)
       setIsSupplierModalOpen(false)
    } else {
       toast.error(result.error || 'Error al crear proveedor')
    }
  }

  const handleSaveBrand = async (brandData: any) => {
    const result = await createBrand(brandData)
    if (result.success && result.data) {
       toast.success('Marca creada')
       const newBrand = result.data as unknown as Brand
       setLocalBrands(prev => [...prev, newBrand])
       setValue('brand_id', newBrand.id)
       setValue('brand', newBrand.name)
       setIsBrandModalOpen(false)
       return { success: true }
    } else {
       toast.error(result.error || 'Error al crear marca')
       return { success: false, error: result.error }
    }
  }

  const generateSKU = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `PROD-${timestamp}-${random}`
  }

  const onSubmit = async (values: ProductFormValues) => {
    const maxRetries = 3

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Race condition with timeout to prevent hanging
          const savePromise = onSave(values as ProductFormData)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 50000)
          )
          
          await Promise.race([savePromise, timeoutPromise])
          toast.success(
            product ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente',
            {
              description: `SKU: ${values.sku}`,
              duration: 5000
            }
          )
          onClose()
          return
        } catch (error) {
          if (error instanceof Error) {
            const message = error.message.toLowerCase()

            if (message.includes('duplicate') || message.includes('unique')) {
              toast.error('SKU duplicado', {
                description: 'Este codigo ya existe en el sistema'
              })
              form.setError('sku', { message: 'Este SKU ya existe' })
              return
            }

            const isTimeout = message.includes('timeout')
            const isNetworkError = message.includes('network') || message.includes('fetch') || isTimeout

            if (isNetworkError) {
              if (attempt < maxRetries) {
                const retryMessage = isTimeout 
                  ? `La conexión está lenta. Reintentando... (${attempt}/${maxRetries})`
                  : `Error de red. Reintentando... (${attempt}/${maxRetries})`
                
                toast.warning(retryMessage)
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
                continue
              }
              
              const finalErrorMessage = isTimeout
                ? 'No pudimos completar la operación a tiempo. Por favor, verifica tu conexión a internet o intenta más tarde.'
                : 'Error de conexión persistente. Por favor verifica tu internet.'

              toast.error('Error de comunicación', {
                description: finalErrorMessage
              })
              return
            }

            toast.error('Error al guardar', {
              description: error.message
            })
          } else {
            toast.error('Error desconocido', {
              description: 'Ocurrio un error inesperado. Por favor intenta nuevamente.'
            })
          }

          console.error('Error saving product:', error)
          return
        }
      }
    } catch (error) {
       console.error("Critical error in form submission", error)
    }
  }

  const calculateMarginValue = () => {
    const pPrice = Number(purchasePrice)
    const sPrice = Number(salePrice)
    if (pPrice > 0 && sPrice > 0) {
      return ((sPrice - pPrice) / sPrice * 100).toFixed(1)
    }
    return '0'
  }

  const handleUploadFiles = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = []
    
    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `products/${fileName}`
        
        const result = await uploadFile('product-images', filePath, file)
        
        if (result.success && result.url) {
          uploadedUrls.push(result.url)
        } else {
          console.error('Upload error:', result.error)
          toast.error(`Error al subir imagen: ${result.error || 'Error desconocido'}`)
        }
      } catch (error) {
        console.error('Error uploading file:', error)
        toast.error('Error al subir imagen')
      }
    }
    
    return uploadedUrls
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full lg:max-w-6xl h-[95vh] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
        {/* Header */}
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

        <Form {...form}>
          <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Sidebar */}
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
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{stockQuantity} unidades</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Precio Venta</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(salePrice)}</p>
                    </div>
                    {hasOffer && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Precio Oferta</p>
                        <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(offerPrice || 0)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" orientation="vertical">
                
                {/* Basic Info */}
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
                        <FormField
                          control={form.control}
                          name="sku"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SKU / Código *</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input placeholder="Ej: PROD-001" {...field} />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setValue('sku', generateSKU())}
                                  title="Generar código automáticamente"
                                >
                                  <Sparkles className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre del Producto *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: iPhone 14 Pro" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="brand_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Marca</FormLabel>
                              <div className="flex gap-2">
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    const selectedBrand = localBrands.find(b => b.id === value)
                                    if (selectedBrand) {
                                      setValue('brand', selectedBrand.name)
                                    }
                                  }} 
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar marca" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {localBrands.map((brand) => (
                                      <SelectItem key={brand.id} value={brand.id}>
                                        {brand.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setIsBrandModalOpen(true)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="unit_measure"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unidad de Medida</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar unidad" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="unidad">Unidad</SelectItem>
                                  <SelectItem value="kg">Kilogramo</SelectItem>
                                  <SelectItem value="g">Gramo</SelectItem>
                                  <SelectItem value="l">Litro</SelectItem>
                                  <SelectItem value="ml">Mililitro</SelectItem>
                                  <SelectItem value="m">Metro</SelectItem>
                                  <SelectItem value="cm">Centímetro</SelectItem>
                                  <SelectItem value="caja">Caja</SelectItem>
                                  <SelectItem value="paquete">Paquete</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name="barcode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Código de Barras</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input 
                                      placeholder="Ej: 7501234567890" 
                                      {...field} 
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setValue('barcode', generateEAN13())}
                                    title="Generar código automáticamente"
                                  >
                                    <Sparkles className="h-4 w-4" />
                                  </Button>
                                </div>
                                <FormMessage />
                                {field.value && !errors.barcode && (
                                  <FormDescription className="text-green-600 dark:text-green-400">
                                    Código de barras válido
                                  </FormDescription>
                                )}
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Descripción detallada del producto..." 
                                className="resize-none" 
                                rows={3}
                                {...field} 
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                        <FormField
                          control={form.control}
                          name="category_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Categoría</FormLabel>
                              <div className="flex gap-2">
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar categoría" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {localCategories.map((category) => (
                                      <SelectItem key={category.id} value={category.id}>
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
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="supplier_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Proveedor</FormLabel>
                              <div className="flex gap-2">
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar proveedor" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {localSuppliers.map((supplier) => (
                                      <SelectItem key={supplier.id} value={supplier.id}>
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
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Producto activo
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Pricing */}
                <TabsContent value="pricing" className="space-y-6 py-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-1 bg-blue-500 rounded-full" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Precios Base</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="purchase_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <GSIcon className="h-4 w-4" />
                              Precio de Compra (Costo)
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                className="text-lg"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sale_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                              Precio de Venta al Público *
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                className="text-lg font-semibold"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                            {purchasePrice > 0 && salePrice > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">Margen:</span>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  {calculateMarginValue()}%
                                </Badge>
                              </div>
                            )}
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Special Prices */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-1 bg-purple-500 rounded-full" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Precios Especiales</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-slate-900">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Users className="h-4 w-4" />
                            Precio Mayorista
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <FormField
                            control={form.control}
                            name="wholesale_price"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    className="text-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      <Card className={`border-2 transition-all ${hasOffer
                        ? 'border-red-400 dark:border-red-800 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10 shadow-lg shadow-red-100 dark:shadow-none'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900'
                        }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${hasOffer ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              <Tag className="h-4 w-4" />
                              Precio en Oferta
                            </CardTitle>
                            <FormField
                              control={form.control}
                              name="has_offer"
                              render={({ field }) => (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {field.value ? 'Activa' : 'Inactiva'}
                                  </span>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="data-[state=checked]:bg-red-500"
                                  />
                                </div>
                              )}
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <FormField
                            control={form.control}
                            name="offer_price"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    disabled={!hasOffer}
                                    className={`text-lg ${!hasOffer ? 'opacity-50 cursor-not-allowed' : 'font-semibold text-red-600'}`}
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                {/* Inventory */}
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
                        <FormField
                          control={form.control}
                          name="stock_quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                        <FormField
                          control={form.control}
                          name="min_stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormDescription>
                                Se generará una alerta cuando el stock esté por debajo de este valor
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                        <FormField
                          control={form.control}
                          name="max_stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                    value={field.value ?? ""}
                                  />
                              </FormControl>
                              <FormDescription>
                                Límite superior recomendado para este producto
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Images */}
                <TabsContent value="images" className="space-y-4 py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Upload className="h-4 w-4" />
                        Imágenes del Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="images"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <ImageUploader
                                images={field.value || []}
                                onChange={field.onChange}
                                maxImages={5}
                                maxSize={5242880}
                                disabled={isSubmitting}
                                onUploadFiles={handleUploadFiles}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </form>
        </Form>

        {/* Footer */}
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
              form="product-form"
              disabled={isSubmitting}
              className="min-w-[140px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-900/30"
            >
              {isSubmitting ? (
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
      existingCategories={uiCategories}
    />

    <SupplierModal
      isOpen={isSupplierModalOpen}
      onClose={() => setIsSupplierModalOpen(false)}
      mode="add"
      onSave={handleSaveSupplier}
    />

    <BrandModal
      isOpen={isBrandModalOpen}
      onClose={() => setIsBrandModalOpen(false)}
      onSave={handleSaveBrand}
    />
    </>
  )
}

export default ProductModal
