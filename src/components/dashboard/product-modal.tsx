'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Upload, Package, Tag, Warehouse, BarChart3, RefreshCw, Users, Sparkles, Plus, AlertCircle, CheckCircle2, CreditCard, Eye } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatPrice } from '@/lib/utils'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Product, Category, Supplier, Brand, ProductFormData } from '@/types/products'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { ImageUploader } from '@/components/dashboard/products/ImageUploader'
import { generateEAN13 } from '@/lib/validations/product-validation'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { productSchema, ProductFormValues } from '@/lib/validations/product-schema'
import { CategoryModal } from '@/components/categories/CategoryModal'
import { SupplierModal } from './supplier-modal'
import { BrandModal } from '@/components/dashboard/brands/BrandModal'
import { useCategories } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useBrands } from '@/hooks/useBrands'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { removeFile, uploadFile } from '@/lib/supabase-storage'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getProductSubmitState } from './product-modal-submit-state'
import { getProductSaveFeedback, type ProductSaveFeedback } from '@/lib/products/product-save-feedback'
import { getFirstProductErrorTab, shouldConfirmProductModalClose } from './product-modal-behavior'

interface ProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSave: (productData: ProductFormData) => Promise<void>
  categories: Category[]
  brands: Brand[]
  suppliers: Supplier[]
  /** Called when a category, brand, or supplier is created from within the modal */
  onCatalogChange?: () => void
}

const DEFAULT_POST_SALE_VALUES = {
  warranty_months: 3,
  warranty_info: 'Cubre defectos de fabrica. No cubre golpes, humedad ni manipulacion.',
  return_window_days: 7,
  exchange_window_days: 7,
  return_policy: 'Devolucion dentro de 7 dias con factura, empaque original y producto sin danos.',
  exchange_policy: 'Cambio dentro de 7 dias por falla de fabrica o error de entrega, sujeto a stock.',
} as const

function FieldRequirement({ required = false, conditional }: { required?: boolean; conditional?: string }) {
  return (
    <span className={`ml-1 text-xs font-normal ${required || conditional ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
      {conditional || (required ? '• Obligatorio' : '• Opcional')}
    </span>
  )
}

export function ProductModal({
  product,
  isOpen,
  onClose,
  onSave,
  categories,
  brands,
  suppliers,
  onCatalogChange
}: ProductModalProps) {
  const [activeTab, setActiveTab] = useState('basic')
  const [saveFeedback, setSaveFeedback] = useState<ProductSaveFeedback | null>(null)
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const newlyUploadedImages = useRef(new Map<string, string>())
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  
  const { createCategory } = useCategories()
  const { createSupplier } = useSuppliers()
  const { createBrand } = useBrands()
  const canViewCost = useCanViewCost()

  // Local state for lists to support instant updates
  const [localCategories, setLocalCategories] = useState<Category[]>(categories ?? [])
  const [localBrands, setLocalBrands] = useState<Brand[]>(brands ?? [])
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers ?? [])

  // Form definition
  // Nota: `as any` en zodResolver es necesario por incompatibilidad de tipos entre
  // @hookform/resolvers@v5 y zod@v4 (input vs output types en z.coerce.*)
  // No afecta el comportamiento en runtime.
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    mode: 'onChange',
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
      installments_enabled: false,
      installments_public: true,
      installments_plans: [],
      ...DEFAULT_POST_SALE_VALUES,
      stock_quantity: 0,
      min_stock: 0,
      max_stock: 0,
      unit_measure: '',
      barcode: '',
      is_active: true,
      visibility: 'public',
      images: []
    }
  })

  const { formState: { isSubmitting, errors, isValid, isDirty }, setValue, watch } = form
  const submitState = getProductSubmitState({
    isEditing: Boolean(product),
    isSubmitting: isSubmitting || isUploadingImages,
    isValid,
  })
  
  // Watch values for calculations
  const purchasePrice = watch('purchase_price')
  const salePrice = watch('sale_price')
  const wholesalePrice = watch('wholesale_price')
  const offerPrice = watch('offer_price')
  const hasOffer = watch('has_offer')
  const installmentsEnabled = watch('installments_enabled')
  const installmentsPublic = watch('installments_public')
  const installmentsPlans = watch('installments_plans')
  const { fields: installmentFields, append: appendInstallment, remove: removeInstallment } = useFieldArray({
    control: form.control,
    name: 'installments_plans',
  })
  // Precio efectivo sobre el que se calculan las cuotas (respeta oferta)
  const installmentBase = hasOffer && Number(offerPrice) > 0 ? Number(offerPrice) : Number(salePrice) || 0
  // Cantidades de cuota sugeridas como chips rápidos
  const INSTALLMENT_PRESETS = [3, 4, 5, 6, 9, 12, 18, 24]
  const warrantyMonths = watch('warranty_months')
  const returnWindowDays = watch('return_window_days')
  const exchangeWindowDays = watch('exchange_window_days')
  const stockQuantity = watch('stock_quantity')
  const minStock = watch('min_stock')
  const maxStock = watch('max_stock')
  const unitMeasure = watch('unit_measure')
  const sku = watch('sku')

  // Fix #1: Detectar qué tabs contienen errores de validación
  const tabErrorMap = useMemo(() => {
    const basicFields = ['sku', 'name', 'description', 'category_id', 'brand_id', 'brand', 'supplier_id', 'barcode', 'unit_measure', 'is_active']
    const pricingFields = ['purchase_price', 'sale_price', 'wholesale_price', 'offer_price', 'has_offer', 'installments_enabled', 'installments_plans']
    const inventoryFields = ['stock_quantity', 'min_stock', 'max_stock']
    const postSaleFields = ['warranty_months', 'warranty_info', 'return_window_days', 'exchange_window_days', 'return_policy', 'exchange_policy']
    const imagesFields = ['images']
    const errorKeys = Object.keys(errors)
    return {
      basic: errorKeys.some(k => basicFields.includes(k)),
      pricing: errorKeys.some(k => pricingFields.includes(k)),
      inventory: errorKeys.some(k => inventoryFields.includes(k)),
      postSale: errorKeys.some(k => postSaleFields.includes(k)),
      images: errorKeys.some(k => imagesFields.includes(k)),
    }
  }, [errors])

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
    newlyUploadedImages.current.clear()
    setSaveFeedback(null)
    setActiveTab('basic')

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
        installments_enabled: (product as any).installments_enabled || false,
        installments_public: (product as any).installments_public ?? true,
        installments_plans: Array.isArray((product as any).installments_plans)
          ? (product as any).installments_plans
          : [],
        warranty_months: (product as any).warranty_months ?? DEFAULT_POST_SALE_VALUES.warranty_months,
        warranty_info: (product as any).warranty_info ?? DEFAULT_POST_SALE_VALUES.warranty_info,
        return_window_days: (product as any).return_window_days ?? DEFAULT_POST_SALE_VALUES.return_window_days,
        exchange_window_days: (product as any).exchange_window_days ?? DEFAULT_POST_SALE_VALUES.exchange_window_days,
        return_policy: (product as any).return_policy ?? DEFAULT_POST_SALE_VALUES.return_policy,
        exchange_policy: (product as any).exchange_policy ?? DEFAULT_POST_SALE_VALUES.exchange_policy,
        stock_quantity: product.stock_quantity || 0,
        min_stock: product.min_stock || 0,
        max_stock: product.max_stock || 0,
        unit_measure: product.unit_measure || '',
        barcode: product.barcode || '',
        is_active: product.is_active ?? true,
        visibility: (product as any).visibility || 'public',
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
        installments_enabled: false,
        installments_public: true,
        installments_plans: [],
        ...DEFAULT_POST_SALE_VALUES,
        stock_quantity: 0,
        min_stock: 0,
        max_stock: 0,
        unit_measure: '',
        barcode: '',
        is_active: true,
        visibility: 'public',
        images: []
      })
    }
  }, [product, form])

  const handleSaveCategory = async (categoryData: { name: string; description: string; parent_id: string | null; global_category_id: string | null; is_active: boolean }) => {
    const payload = {
      name: categoryData.name,
      description: categoryData.description,
      parent_id: categoryData.parent_id,
      global_category_id: categoryData.global_category_id,
      is_active: categoryData.is_active,
    }
    
    const result = await createCategory(payload)
    if (result.success && result.data) {
       const newCategory = result.data as unknown as Category
       setLocalCategories(prev => [...prev, newCategory])
       setValue('category_id', newCategory.id, { shouldDirty: true, shouldValidate: true })
       setIsCategoryModalOpen(false)
       onCatalogChange?.()
       toast.success('Categoría creada')
    } else {
       toast.error(result.error || 'Error al crear categoría')
       throw new Error(result.error || 'Error al crear categoría')
    }
  }

  const handleSaveSupplier = async (supplierData: Partial<UISupplier>) => {
    const result = await createSupplier(supplierData as any)
    if (result.success && result.data) {
       toast.success('Proveedor creado')
       const newSupplier = result.data as unknown as Supplier
       setLocalSuppliers(prev => [...prev, newSupplier])
       setValue('supplier_id', newSupplier.id, { shouldDirty: true, shouldValidate: true })
       setIsSupplierModalOpen(false)
       onCatalogChange?.()
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
       setValue('brand_id', newBrand.id, { shouldDirty: true, shouldValidate: true })
       setValue('brand', newBrand.name, { shouldDirty: true })
       setIsBrandModalOpen(false)
       onCatalogChange?.()
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

  const cleanProductData = (data: ProductFormValues) => {
    const rest = { ...data };
    
    // Si no hay producto (creación), no enviamos ID
    if (!product) {
       delete (rest as any).id
    }

    // Fix #5: derivar nombre de marca desde brand_id si brand está vacío
    let brandName = data.brand?.trim() || null
    if (!brandName && data.brand_id) {
      const found = localBrands.find(b => b.id === data.brand_id)
      if (found) brandName = found.name
    }
    
    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : []
    
    return {
      ...rest,
      category_id: data.category_id || null,
      brand_id: data.brand_id || null,
      supplier_id: data.supplier_id || null,
      brand: brandName,
      description: data.description?.trim() || null,
      barcode: data.barcode?.trim() || null,
      unit_measure: data.unit_measure?.trim() || 'unidad',
      wholesale_price: (data.wholesale_price ?? 0) > 0 ? data.wholesale_price : null,
      offer_price: data.has_offer && (data.offer_price ?? 0) > 0 ? data.offer_price : null,
      warranty_months: Number(data.warranty_months ?? 0),
      warranty_info: data.warranty_info?.trim() || null,
      return_window_days: Number(data.return_window_days ?? 0),
      exchange_window_days: Number(data.exchange_window_days ?? 0),
      return_policy: data.return_policy?.trim() || null,
      exchange_policy: data.exchange_policy?.trim() || null,
      images: images,
      // Sync legacy image_url field with the first image of the array
      image_url: images.length > 0 ? images[0] : null,
      // Asegurar tipos numéricos
      purchase_price: Number(data.purchase_price),
      sale_price: Number(data.sale_price),
      stock_quantity: Number(data.stock_quantity),
      min_stock: Number(data.min_stock),
      is_active: data.is_active ?? true,
      visibility: data.visibility || 'public',
      has_offer: data.has_offer ?? false,
      installments_enabled: data.installments_enabled ?? false,
      installments_public: data.installments_public ?? true,
      // Los planes se conservan siempre (aunque se desactive la financiación o
      // la visibilidad pública) para no perder la configuración cargada.
      installments_plans: Array.isArray(data.installments_plans)
        ? data.installments_plans
            .filter((plan) => Number(plan.count) >= 1)
            .map((plan) => ({ count: Number(plan.count), rate: Number(plan.rate) || 0 }))
            .sort((a, b) => a.count - b.count)
        : [],
    }
  }

  const onSubmit = async (values: ProductFormValues) => {
    setSaveFeedback(null)

    try {
      const cleanedData = cleanProductData(values)

      // El costo (purchase_price) es editable solo por admin/super_admin.
      // Para el resto, no se envía: en edición se preserva el valor actual y
      // en creación queda en el default de la base.
      if (!canViewCost) {
        delete (cleanedData as Record<string, unknown>).purchase_price
      }

      // Ensure we're not sending an ID for new products
      if (!product && 'id' in cleanedData) {
        delete (cleanedData as any).id
      }

      console.log('Sending product data:', cleanedData)
      await onSave(cleanedData as unknown as ProductFormData)
      
      toast.success(
        product ? 'Producto actualizado correctamente' : 'Producto creado correctamente',
        {
          description: product
            ? `"${values.name}" · SKU ${values.sku}`
            : `"${values.name}" · SKU ${values.sku} · Stock inicial ${values.stock_quantity}`,
          duration: 4000
        }
      )
      const savedImages = new Set(values.images || [])
      await Promise.all(
        [...newlyUploadedImages.current.keys()]
          .filter(url => !savedImages.has(url))
          .map(cleanupNewImage),
      )
      newlyUploadedImages.current.clear()
      form.reset(values)
      onClose()
    } catch (error) {
      console.error('Error saving product:', error)
      const feedback = getProductSaveFeedback(error, product ? 'update' : 'create')
      setSaveFeedback(feedback)
      toast.error(feedback.title, { description: feedback.description })
    }
  }

  const onInvalidSubmit = (validationErrors: typeof errors) => {
    const firstErrorTab = getFirstProductErrorTab(Object.keys(validationErrors))
    if (firstErrorTab) setActiveTab(firstErrorTab)

    const messages = Object.values(validationErrors)
      .map(error => error?.message)
      .filter((message): message is string => typeof message === 'string')
    const remaining = Math.max(messages.length - 1, 0)
    const feedback = {
      title: 'Revisa los datos obligatorios',
      description: messages[0]
        ? `${messages[0]}${remaining > 0 ? ` Hay ${remaining} campo${remaining === 1 ? '' : 's'} más por corregir.` : ''}`
        : 'Corrige los campos marcados antes de guardar el producto.',
    }

    setSaveFeedback(feedback)
    toast.error(feedback.title, { description: feedback.description })
  }

  const requestClose = () => {
    const closeBehavior = shouldConfirmProductModalClose({ isDirty, isSubmitting, isUploadingImages })
    if (closeBehavior === 'blocked') return
    if (closeBehavior === 'confirm') {
      setShowDiscardConfirmation(true)
      return
    }
    onClose()
  }

  const discardChangesAndClose = async () => {
    setShowDiscardConfirmation(false)
    await cleanupAllNewImages()
    form.reset()
    onClose()
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
          newlyUploadedImages.current.set(result.url, filePath)
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

  const cleanupNewImage = async (url: string) => {
    const filePath = newlyUploadedImages.current.get(url)
    if (!filePath) return

    const result = await removeFile('product-images', filePath)
    if (result.success) {
      newlyUploadedImages.current.delete(url)
    } else {
      console.warn('Could not remove unused product image:', result.error)
    }
  }

  const cleanupAllNewImages = async () => {
    await Promise.all([...newlyUploadedImages.current.keys()].map(cleanupNewImage))
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) requestClose()
    }}>
      <DialogContent
        showCloseButton={!isSubmitting && !isUploadingImages}
        className="max-w-[95vw] w-full lg:max-w-6xl h-[95vh] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-none flex flex-col"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col flex-1 overflow-hidden h-full">
            {/* Header */}
            <div className="bg-primary px-4 py-4 md:px-8 md:py-6 text-primary-foreground shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary-foreground/15 rounded-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-primary-foreground">
                      {product ? 'Editar Producto' : 'Nuevo Producto'}
                    </DialogTitle>
                    <DialogDescription className="text-primary-foreground/80 mt-1">
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

            {saveFeedback && (
              <Alert variant="destructive" className="mx-4 md:mx-8 mt-4 w-auto shrink-0">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{saveFeedback.title}</AlertTitle>
                <AlertDescription>{saveFeedback.description}</AlertDescription>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex min-h-0 flex-col md:flex-row flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-full md:w-56 bg-gray-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-3 md:p-4 overflow-hidden md:overflow-y-auto shrink-0">
                  <TabsList className="grid grid-cols-3 md:flex md:flex-col h-auto bg-transparent w-full gap-2 text-gray-500 dark:text-gray-400">
                    <TabsTrigger
                      value="basic"
                      className="w-full justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border md:border-0 rounded-lg whitespace-nowrap"
                    >
                      <Tag className="h-4 w-4" />
                      <span className="hidden md:inline">Información Básica</span>
                      <span className="md:hidden">Básica</span>
                      {tabErrorMap.basic && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="pricing"
                      className="w-full justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border md:border-0 rounded-lg whitespace-nowrap"
                    >
                      <GSIcon className="h-4 w-4" />
                      <span className="hidden md:inline">Precios y Ofertas</span>
                      <span className="md:hidden">Precios</span>
                      {tabErrorMap.pricing && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="inventory"
                      className="w-full justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border md:border-0 rounded-lg whitespace-nowrap"
                    >
                      <Warehouse className="h-4 w-4" />
                      <span className="hidden md:inline">Inventario</span>
                      <span className="md:hidden">Stock</span>
                      {tabErrorMap.inventory && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="post-sale"
                      className="w-full justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border md:border-0 rounded-lg whitespace-nowrap"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="hidden md:inline">Postventa</span>
                      <span className="md:hidden">Postventa</span>
                      {tabErrorMap.postSale && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="images"
                      className="w-full justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border md:border-0 rounded-lg whitespace-nowrap"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="hidden md:inline">Imágenes</span>
                      <span className="md:hidden">Fotos</span>
                      {tabErrorMap.images && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                  </TabsList>

                {/* Quick Info Sidebar */}
                {product && (
                  <div className="hidden md:block mt-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm space-y-3 border border-gray-100 dark:border-gray-700">
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
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span><strong className="font-medium text-red-600 dark:text-red-400">• Obligatorio</strong> para crear el producto</span>
                <span><strong className="font-medium">• Opcional</strong> se puede completar después</span>
              </div>

                {/* Basic Info */}
                <TabsContent value="basic" className="space-y-6 py-4">
                  <Card className="border-0 shadow-none bg-transparent md:border md:border-blue-100 md:dark:border-blue-900/50 md:bg-gradient-to-br md:from-white md:to-blue-50/30 md:dark:from-slate-800 md:dark:to-slate-800/50">
                    <CardHeader className="pb-3 px-0 md:px-6">
                      <CardTitle className="text-base flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Información del Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="sku"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SKU / Código <FieldRequirement required /></FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input placeholder="Ej: PROD-001" {...field} />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setValue('sku', generateSKU(), { shouldDirty: true, shouldValidate: true })}
                                  aria-label="Generar SKU automáticamente"
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
                              <FormLabel>Nombre del Producto <FieldRequirement required /></FormLabel>
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
                              <FormLabel>Marca <FieldRequirement /></FormLabel>
                              <div className="flex gap-2">
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    const selectedBrand = localBrands.find(b => b.id === value)
                                    if (selectedBrand) {
                                      setValue('brand', selectedBrand.name, { shouldDirty: true })
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
                                  aria-label="Crear nueva marca"
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
                              <FormLabel>Unidad de Medida <FieldRequirement /></FormLabel>
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
                                <FormLabel>Código de Barras <FieldRequirement /></FormLabel>
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
                                    onClick={() => setValue('barcode', generateEAN13(), { shouldDirty: true, shouldValidate: true })}
                                    aria-label="Generar código de barras automáticamente"
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
                            <FormLabel>Descripción <FieldRequirement /></FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Descripción detallada del producto..." 
                                className="resize-none" 
                                rows={6}
                                {...field} 
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription>
                              Máximo 2000 caracteres.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-none bg-transparent md:border md:border-purple-100 md:dark:border-purple-900/50 md:bg-gradient-to-br md:from-white md:to-purple-50/30 md:dark:from-slate-800 md:dark:to-slate-800/50">
                    <CardHeader className="pb-3 px-0 md:px-6">
                      <CardTitle className="text-base flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Categorización
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="category_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Categoría <FieldRequirement required /></FormLabel>
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
                                  aria-label="Crear nueva categoría"
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
                              <FormLabel>Proveedor <FieldRequirement /></FormLabel>
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
                                  aria-label="Crear nuevo proveedor"
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
                              Producto activo <FieldRequirement />
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="visibility"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visibilidad en tienda pública <FieldRequirement /></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || 'public'}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar visibilidad" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="public">Público — visible para todos</SelectItem>
                                <SelectItem value="wholesale">Mayorista — solo clientes mayoristas</SelectItem>
                                <SelectItem value="hidden">Oculto — no se muestra en la tienda</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
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
                      {canViewCost && (
                      <FormField
                        control={form.control}
                        name="purchase_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <GSIcon className="h-4 w-4" />
                              Precio de Compra (Costo) <FieldRequirement required />
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
                      )}

                      <FormField
                        control={form.control}
                        name="sale_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                              Precio de Venta al Público <FieldRequirement required />
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
                            {canViewCost && purchasePrice > 0 && salePrice > 0 && (
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
                      <Card className="border-0 shadow-none bg-transparent md:border md:border-blue-200 md:dark:border-blue-800 md:bg-gradient-to-br md:from-blue-50/50 md:to-white md:dark:from-blue-900/10 md:dark:to-slate-900">
                        <CardHeader className="pb-3 px-0 md:px-6">
                          <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Users className="h-4 w-4" />
                            Precio Mayorista <FieldRequirement />
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-2">
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

                      <Card className={`transition-all ${hasOffer
                        ? 'border-l-4 border-red-500 bg-red-50/20 dark:bg-red-955/10 md:border-2 md:border-red-400 md:dark:border-red-800 md:bg-gradient-to-br md:from-red-50 md:to-pink-50 md:dark:from-red-900/10 md:dark:to-pink-900/10 md:shadow-lg md:shadow-red-100 md:dark:shadow-none'
                        : 'border-0 shadow-none bg-transparent md:border md:border-gray-200 md:dark:border-gray-700 md:bg-white md:dark:bg-slate-900'
                        }`}>
                        <CardHeader className="pb-3 px-0 md:px-6">
                          <div className="flex items-center justify-between">
                            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${hasOffer ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              <Tag className="h-4 w-4" />
                              Precio en Oferta <FieldRequirement conditional={hasOffer ? '• Obligatorio con oferta activa' : '• Opcional'} />
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
                                    aria-label="Activar precio en oferta"
                                  />
                                </div>
                              )}
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-2">
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

                    {/* Cuotas / Financiación (informativo en la web pública) */}
                    <Card className={`transition-all ${installmentsEnabled
                      ? 'border-l-4 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 md:border-2 md:border-indigo-400 md:dark:border-indigo-800 md:bg-gradient-to-br md:from-indigo-50 md:to-white md:dark:from-indigo-900/10 md:dark:to-slate-900 md:shadow-lg md:shadow-indigo-100 md:dark:shadow-none'
                      : 'border-0 shadow-none bg-transparent md:border md:border-gray-200 md:dark:border-gray-700 md:bg-white md:dark:bg-slate-900'
                      }`}>
                      <CardHeader className="pb-3 px-0 md:px-6">
                        <div className="flex items-center justify-between">
                          <CardTitle className={`text-sm font-medium flex items-center gap-2 ${installmentsEnabled ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            <CreditCard className="h-4 w-4" />
                            Activar cuotas / financiación <FieldRequirement conditional={installmentsEnabled ? '• Configurá los planes abajo' : '• Opcional'} />
                          </CardTitle>
                          <FormField
                            control={form.control}
                            name="installments_enabled"
                            render={({ field }) => (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {field.value ? 'Activa' : 'Inactiva'}
                                </span>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-indigo-500"
                                  aria-label="Activar cuotas / financiación"
                                />
                              </div>
                            )}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-3">
                        {!installmentsEnabled ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Activá la financiación para configurar los planes de cuotas del producto.
                            Los planes quedan guardados aunque la desactives.
                          </p>
                        ) : (
                          <>
                            {/* Toggle independiente: mostrar en la web pública */}
                            <FormField
                              control={form.control}
                              name="installments_public"
                              render={({ field }) => (
                                <div className="flex items-center justify-between rounded-lg border border-indigo-200/70 bg-white/60 px-3 py-2 dark:border-indigo-900/40 dark:bg-slate-900/40">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    <div>
                                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">Mostrar en la web pública</p>
                                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {field.value ? 'Las cuotas se ven en la tienda online' : 'Oculto en la tienda (los planes siguen guardados)'}
                                      </p>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="data-[state=checked]:bg-indigo-500"
                                    aria-label="Mostrar cuotas en la web pública"
                                  />
                                </div>
                              )}
                            />

                            {/* Chips rápidos: agregar una opción de cuota */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Agregar:</span>
                              {INSTALLMENT_PRESETS.map((preset) => {
                                const already = (installmentsPlans ?? []).some((p) => Number(p?.count) === preset)
                                return (
                                  <Button
                                    key={preset}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={already}
                                    onClick={() => appendInstallment({ count: preset, rate: 0 })}
                                    className="h-7 px-2 text-xs"
                                  >
                                    {preset} cuotas
                                  </Button>
                                )
                              })}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => appendInstallment({ count: 2, rate: 0 })}
                                className="h-7 px-2 text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Otra
                              </Button>
                            </div>

                            {installmentFields.length === 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Agregá al menos una opción de cuotas.
                              </p>
                            )}

                            {/* Filas editables por opción */}
                            <div className="space-y-2">
                              {installmentFields.map((row, index) => {
                                const count = Number(installmentsPlans?.[index]?.count) || 0
                                const rate = Number(installmentsPlans?.[index]?.rate) || 0
                                const preview =
                                  installmentBase > 0 && count >= 1
                                    ? buildCreditInstallmentPlan({
                                        principalAmount: installmentBase,
                                        interestRate: rate,
                                        installmentCount: count,
                                        frequency: 'monthly',
                                      })
                                    : null
                                return (
                                  <div key={row.id} className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                                    <FormField
                                      control={form.control}
                                      name={`installments_plans.${index}.count`}
                                      render={({ field }) => (
                                        <FormItem className="w-20 shrink-0">
                                          <FormLabel className="text-[10px] text-gray-500">Cuotas</FormLabel>
                                          <FormControl>
                                            <Input type="number" min={1} max={60} className="h-8 text-sm" {...field} value={field.value ?? ''} />
                                          </FormControl>
                                          <FormMessage className="text-[10px]" />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name={`installments_plans.${index}.rate`}
                                      render={({ field }) => (
                                        <FormItem className="w-24 shrink-0">
                                          <FormLabel className="text-[10px] text-gray-500">Recargo %</FormLabel>
                                          <FormControl>
                                            <Input type="number" step="0.01" min={0} placeholder="0" className="h-8 text-sm" {...field} value={field.value ?? ''} />
                                          </FormControl>
                                          <FormMessage className="text-[10px]" />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="flex-1 min-w-0 pt-4">
                                      {preview ? (
                                        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-snug">
                                          {count} × <strong>{formatPrice(preview.installments[0]?.amount ?? 0)}</strong>
                                          {preview.interestAmount > 0
                                            ? <span className="text-indigo-600/70"> · Total {formatPrice(preview.financedTotal)}</span>
                                            : <span className="text-indigo-600/70"> · sin interés</span>}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-gray-400 pt-0.5">Definí precio de venta para ver el cálculo</p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeInstallment(index)}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 shrink-0"
                                      aria-label="Quitar opción de cuotas"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Inventory */}
                <TabsContent value="inventory" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
                      <CardHeader className="pb-3 px-0 md:px-6">
                        <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <Warehouse className="h-4 w-4" />
                          Stock Actual <FieldRequirement required />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 md:p-6 pt-0 md:pt-0">
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

                    <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
                      <CardHeader className="pb-3 px-0 md:px-6">
                        <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <Package className="h-4 w-4" />
                          Stock Mínimo <FieldRequirement required />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 md:p-6 pt-0 md:pt-0">
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

                    <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
                      <CardHeader className="pb-3 px-0 md:px-6">
                        <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <Warehouse className="h-4 w-4 text-amber-600" />
                          Stock Máximo <FieldRequirement />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 md:p-6 pt-0 md:pt-0">
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

                {/* Post-Sale */}
                <TabsContent value="post-sale" className="space-y-4 py-4">
                  <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
                    <CardHeader className="pb-3 px-0 md:px-6">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <RefreshCw className="h-4 w-4" />
                        Garantia del Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="warranty_months"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meses de garantía <FieldRequirement /></FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={60} {...field} value={field.value ?? 0} />
                              </FormControl>
                              <FormDescription>
                                0 = sin garantia
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="rounded-lg border p-4 bg-muted/20">
                          <p className="text-sm text-muted-foreground">Resumen</p>
                          <p className="text-lg font-semibold mt-1">
                            {warrantyMonths > 0 ? `${warrantyMonths} meses de garantia` : 'Sin garantia'}
                          </p>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="warranty_info"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Condiciones de garantía <FieldRequirement /></FormLabel>
                            <FormControl>
                              <Textarea
                                rows={4}
                                placeholder="Ej: Cubre fallas de fabrica. No cubre golpes, humedad o manipulacion."
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

                  <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
                    <CardHeader className="pb-3 px-0 md:px-6">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <RefreshCw className="h-4 w-4" />
                        Cambios y Devoluciones
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6 pt-0 md:pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="return_window_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Días para devolución <FieldRequirement /></FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={90} {...field} value={field.value ?? 0} />
                              </FormControl>
                              <FormDescription>
                                0 = no permite devolucion
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="exchange_window_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Días para cambio <FieldRequirement /></FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={90} {...field} value={field.value ?? 0} />
                              </FormControl>
                              <FormDescription>
                                0 = no permite cambios
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="rounded-lg border p-4 bg-muted/20 text-sm">
                        <p className="font-medium">Ventanas activas</p>
                        <p className="text-muted-foreground mt-1">
                          Devolucion: {returnWindowDays} dias | Cambio: {exchangeWindowDays} dias
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="return_policy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Política de devolución <FieldRequirement /></FormLabel>
                            <FormControl>
                              <Textarea
                                rows={4}
                                placeholder="Ej: Producto sin uso, con caja y factura, dentro del plazo."
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="exchange_policy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Política de cambio <FieldRequirement /></FormLabel>
                            <FormControl>
                              <Textarea
                                rows={4}
                                placeholder="Ej: Cambio por mismo producto o equivalente sujeto a stock."
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
                </TabsContent>

                {/* Images */}
                <TabsContent value="images" className="space-y-4 py-4">
                  <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
                    <CardHeader className="px-0 md:px-6">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Upload className="h-4 w-4" />
                        Imágenes del Producto <FieldRequirement />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6 pt-0 md:pt-0">
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
                                onRemoveImage={cleanupNewImage}
                                onUploadingChange={setIsUploadingImages}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
            </div>
          </Tabs>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 md:px-8 md:py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <div
                id="product-form-status"
                role="status"
                className={`flex items-start sm:items-center gap-2 text-sm ${submitState.ready ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}
              >
                {submitState.ready ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{submitState.status}</span>
              </div>
              <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestClose}
                  disabled={isSubmitting || isUploadingImages}
                  className="min-w-[100px] flex-1 sm:flex-none border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingImages}
                  aria-describedby="product-form-status"
                  className={`min-w-[180px] flex-1 sm:flex-none text-white shadow-lg ${
                    submitState.ready
                      ? 'bg-primary hover:bg-primary/90 shadow-sm'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 dark:bg-amber-700 dark:hover:bg-amber-600'
                  }`}
                >
                  {isSubmitting || isUploadingImages ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {isUploadingImages ? 'Subiendo imágenes...' : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      {submitState.label}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDiscardConfirmation} onOpenChange={setShowDiscardConfirmation}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar cambios del producto?</AlertDialogTitle>
          <AlertDialogDescription>
            Los datos que completaste todavía no fueron guardados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={discardChangesAndClose}>
            Descartar cambios
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <CategoryModal
      isOpen={isCategoryModalOpen}
      onClose={() => setIsCategoryModalOpen(false)}
      onSubmit={handleSaveCategory}
      categories={localCategories as any}
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
