'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { clearProductDraft, readProductDraft, saveProductDraft } from '@/lib/products/product-draft'
import { Upload, Package, Tag, Warehouse, BarChart3, RefreshCw, Users, Sparkles, Plus, AlertCircle, CheckCircle2, CreditCard, Eye, Layers3 } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatPrice } from '@/lib/utils'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import {
  CREDIT_BASE_LABELS,
  resolveCreditBase,
  toProductInstallmentPlans,
} from '@/lib/credits/product-credit-defaults'
import { CreditDefaultsLink, CreditHowItWorks } from '@/components/dashboard/products/CreditHowItWorks'
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
import { buildCategoryOptions, getCategoryIndent } from '@/lib/categories/category-tree'
import { NewProductChecklist } from '@/components/dashboard/products/NewProductChecklist'
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
import { getFirstProductErrorTab, shouldConfirmProductModalClose, getProductRequirementsProgress } from './product-modal-behavior'
import { ProductVariantsEditor } from '@/components/dashboard/products/ProductVariantsEditor'
import { ProductVariantReview } from '@/components/dashboard/products/ProductVariantReview'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

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

export function normalizeProductVariantsForForm(product: any): {
  has_variants: boolean
  variant_attribute_config: any[]
  variants: any[]
} {
  if (!product) {
    return {
      has_variants: false,
      variant_attribute_config: [],
      variants: [],
    }
  }

  const rawConfig = Array.isArray(product.variant_attribute_config)
    ? product.variant_attribute_config
    : []

  const rawVariants = Array.isArray(product.variants) ? product.variants : []

  const normalizedConfig = rawConfig
    .filter((attr: any) => attr && typeof attr === 'object' && (attr.key || attr.name || attr.label))
    .map((attr: any) => {
      const key = String(attr.key || attr.id || attr.name || '').trim()
      const label = String(attr.label || attr.name || attr.key || '').trim()
      const rawOptions = Array.isArray(attr.options)
        ? attr.options
        : Array.isArray(attr.values)
          ? attr.values
          : []
      const options = rawOptions
        .map((opt: any) => (typeof opt === 'string' ? opt.trim() : typeof opt?.value === 'string' ? opt.value.trim() : typeof opt?.name === 'string' ? opt.name.trim() : ''))
        .filter(Boolean)

      return {
        key: key || `attr_${Math.random().toString(36).substring(2, 7)}`,
        label: label || 'Atributo',
        control: (attr.control === 'color' ? 'color' : 'select') as 'select' | 'color' | 'text' | 'number',
        options: options.length > 0 ? options : ['Default'],
      }
    })

  const normalizedVariants = rawVariants
    .filter((v: any) => v && typeof v === 'object')
    .map((v: any, index: number) => {
      let attributes: Record<string, string> = {}
      if (v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes)) {
        for (const [k, val] of Object.entries(v.attributes)) {
          if (val !== undefined && val !== null) {
            attributes[k] = String(val).trim()
          }
        }
      } else if (Array.isArray(v.attributes)) {
        for (const item of v.attributes) {
          if (item && typeof item === 'object') {
            const k = item.key || item.attribute_name || item.name || `attr_${index}`
            const val = item.value || item.display_value || ''
            if (k && val) attributes[String(k).trim()] = String(val).trim()
          }
        }
      }

      const attrKey = Object.entries(attributes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => `${k}=${val}`)
        .join('|')
      const clientKey = v.clientKey || v.client_key || attrKey || v.id || `variant-${index + 1}`

      const name = String(v.name || v.variant_name || Object.values(attributes).join(' / ') || `Variante ${index + 1}`).trim()
      const sku = String(v.sku || (product.sku ? `${product.sku}-${index + 1}` : `VAR-${index + 1}`)).trim().toUpperCase()
      const isValidUuid = typeof v.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)

      return {
        id: isValidUuid ? String(v.id) : undefined,
        clientKey,
        name: name || `Variante ${index + 1}`,
        attributes,
        sku: sku || `VAR-${index + 1}`,
        barcode: v.barcode ? String(v.barcode).trim() : undefined,
        purchasePrice: Number(v.purchasePrice ?? v.purchase_price ?? product.purchase_price ?? 0),
        salePrice: Number(v.salePrice ?? v.sale_price ?? product.sale_price ?? 0),
        wholesalePrice: v.wholesalePrice !== undefined && v.wholesalePrice !== null
          ? Number(v.wholesalePrice)
          : v.wholesale_price !== undefined && v.wholesale_price !== null
            ? Number(v.wholesale_price)
            : undefined,
        minStock: Number(v.minStock ?? v.min_stock ?? 0),
        stockQuantity: Number(v.stockQuantity ?? v.stock_quantity ?? 0),
        isActive: v.isActive !== undefined ? Boolean(v.isActive) : v.is_active !== undefined ? Boolean(v.is_active) : true,
      }
    })

  // No se debe convertir silenciosamente un producto con variantes en uno
  // simple cuando un listado resumido todavía no incluyó la relación. El modal
  // completa esos datos desde el detalle antes de permitir guardar.
  const effectiveHasVariants = Boolean(product.has_variants)

  return {
    has_variants: effectiveHasVariants,
    variant_attribute_config: effectiveHasVariants ? normalizedConfig : [],
    variants: effectiveHasVariants ? normalizedVariants : [],
  }
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
  // Se avisa cuando se recupero un borrador: si el formulario aparece lleno sin
  // explicacion, quien lo abre no sabe si eso es lo guardado o lo que estaba
  // escribiendo.
  const [draftRestored, setDraftRestored] = useState(false)
  // El producto se lee de un ref dentro del efecto de reset: asi el efecto puede
  // depender solo de su `id` y no del objeto, que cambia de identidad en cada
  // recarga de la lista.
  const productRef = useRef(product)
  productRef.current = product
  const productId = product?.id ?? null
  const listedVariants = (product as (Product & { variants?: unknown[] }) | null)?.variants
  const productNeedsVariantHydration = Boolean(
    product?.has_variants
    && (!Array.isArray(listedVariants) || listedVariants.length === 0)
  )
  const [hydratedVariantProductId, setHydratedVariantProductId] = useState<string | null>(null)
  const [isLoadingExistingVariants, setIsLoadingExistingVariants] = useState(false)
  const [variantLoadError, setVariantLoadError] = useState<string | null>(null)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const newlyUploadedImages = useRef(new Map<string, string>())
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)

  const { createCategory } = useCategories()
  const { createSupplier } = useSuppliers()
  const { createBrand } = useBrands()
  const canViewCost = useCanViewCost()
  const { businessVertical } = useSubscriptionStatus()

  // Local state for lists to support instant updates
  const [localCategories, setLocalCategories] = useState<Category[]>(categories ?? [])

  // El selector mostraba todo plano: una subcategoria se veia igual que una
  // raiz y dos hijas homonimas eran indistinguibles.
  const categoryOptions = useMemo(() => buildCategoryOptions(localCategories), [localCategories])

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
      images: [],
      has_variants: false,
      variant_attribute_config: [],
      variants: [],
    }
  })

  const { formState: { isSubmitting, errors, isValid, isDirty }, setValue, watch } = form
  const isExistingVariantDataReady = !productNeedsVariantHydration || hydratedVariantProductId === productId
  const submitState = getProductSubmitState({
    isEditing: Boolean(product),
    isSubmitting: isSubmitting || isUploadingImages || isLoadingExistingVariants,
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
  const INSTALLMENT_PRESETS = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24]
  // Estado para el chip expandido (popover inline de recargo)
  const [expandedChip, setExpandedChip] = useState<number | null>(null)
  const [chipRate, setChipRate] = useState<Record<number, string>>({})
  // Estado para el panel bulk "agregar varios"
  const [bulkOpen, setBulkOpen] = useState(false)
  // Elección al activar cuotas: usar los predeterminados o cargar desde cero.
  // 'pending' muestra el panel; cualquier otro valor lo oculta.
  const [creditChoice, setCreditChoice] = useState<'pending' | 'defaults' | 'manual'>('pending')
  // Se lee del endpoint admin. Si el usuario no tiene ese rol simplemente no
  // hay predeterminados y queda el flujo manual de siempre.
  const { settings: websiteSettings } = useAdminWebsiteSettings()
  const creditDefaults = websiteSettings?.product_credit_defaults
    ?? getWebsiteSettingsDefaults().product_credit_defaults!
  const defaultRateForInstallmentCount = (count: number) => (
    creditDefaults.plans.find((plan) => plan.count === count)?.rate ?? 0
  )
  const creditDefaultsBase = resolveCreditBase(
    {
      purchase_price: Number(purchasePrice) || 0,
      sale_price: Number(salePrice) || 0,
      offer_price: Number(offerPrice) || 0,
      has_offer: Boolean(hasOffer),
    },
    creditDefaults,
  )
  const showCreditChoice = Boolean(
    installmentsEnabled
    && creditDefaults.enabled
    && creditDefaults.plans.length > 0
    && creditChoice === 'pending'
    && (installmentsPlans ?? []).length === 0
  )

  const applyCreditDefaults = () => {
    form.setValue('installments_plans', toProductInstallmentPlans(creditDefaults), { shouldDirty: true })
    form.setValue('installments_public', creditDefaults.publicByDefault, { shouldDirty: true })
    setCreditChoice('defaults')
  }
  const [bulkDraft, setBulkDraft] = useState<Record<number, { checked: boolean; rate: string }>>({})
  const warrantyMonths = watch('warranty_months')
  const returnWindowDays = watch('return_window_days')
  const exchangeWindowDays = watch('exchange_window_days')
  const stockQuantity = watch('stock_quantity')
  const minStock = watch('min_stock')
  const maxStock = watch('max_stock')
  const unitMeasure = watch('unit_measure')
  const sku = watch('sku')
  const watchedName = watch('name')
  const watchedCategoryId = watch('category_id')
  const variantConfig = watch(['has_variants', 'variant_attribute_config', 'variants'])
  const variantValue = {
    hasVariants: Boolean(variantConfig[0]),
    attributes: variantConfig[1] ?? [],
    variants: variantConfig[2] ?? [],
  }

  // Progreso de obligatorios: se calcula en vivo para avisar antes de guardar,
  // no despues de rebotar en la validacion.
  const requirementsProgress = useMemo(
    () => getProductRequirementsProgress({
      name: watchedName,
      sku,
      category_id: watchedCategoryId,
      sale_price: salePrice,
    }),
    [watchedName, sku, watchedCategoryId, salePrice],
  )


  // Fix #1: Detectar qué tabs contienen errores de validación
  const tabErrorMap = useMemo(() => {
    const basicFields = ['sku', 'name', 'description', 'category_id', 'brand_id', 'brand', 'supplier_id', 'barcode', 'unit_measure', 'is_active']
    const pricingFields = ['purchase_price', 'sale_price', 'wholesale_price', 'offer_price', 'has_offer', 'installments_enabled', 'installments_plans']
    const inventoryFields = ['stock_quantity', 'min_stock', 'max_stock']
    const variantFields = ['has_variants', 'variant_attribute_config', 'variants']
    const postSaleFields = ['warranty_months', 'warranty_info', 'return_window_days', 'exchange_window_days', 'return_policy', 'exchange_policy']
    const imagesFields = ['images']
    const errorKeys = Object.keys(errors)
    return {
      basic: errorKeys.some(k => basicFields.includes(k)),
      pricing: errorKeys.some(k => pricingFields.includes(k)),
      inventory: errorKeys.some(k => inventoryFields.includes(k)),
      variants: errorKeys.some(k => variantFields.includes(k)),
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
  //
  // Depende del `id`, no del objeto: `product` llega como prop y cualquier
  // recarga de la lista lo reemplaza por uno nuevo con los mismos datos. Con el
  // objeto en las dependencias, ese reemplazo disparaba `form.reset()` y borraba
  // lo que la persona estaba escribiendo.
  useEffect(() => {
    const product = productRef.current
    newlyUploadedImages.current.clear()
    setSaveFeedback(null)
    setActiveTab('basic')
    // Cada producto vuelve a preguntar: sin esto, elegir "cargar nuevos" en un
    // producto se arrastraba al siguiente y la eleccion no volvia a aparecer.
    setCreditChoice('pending')

    // Un borrador de esta pestaña gana sobre los datos guardados: es lo que la
    // persona estaba escribiendo y todavia no llego a guardar.
    const draft = readProductDraft(productId)
    if (draft) {
      form.reset(draft as never)
      setDraftRestored(true)
      return
    }
    setDraftRestored(false)

    if (product) {
      const variantData = normalizeProductVariantsForForm(product)
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
        images: product.images || [],
        has_variants: variantData.has_variants,
        variant_attribute_config: variantData.variant_attribute_config,
        variants: variantData.variants,
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
        images: [],
        has_variants: false,
        variant_attribute_config: [],
        variants: [],
      })
    }
  }, [productId, form])

  // Algunos consumidores abren el modal desde listados resumidos que solo
  // incluyen `has_variants`. Recuperamos el detalle completo para mostrar las
  // combinaciones existentes y evitar que una edición las borre.
  useEffect(() => {
    if (!isOpen || !productId || !productNeedsVariantHydration) {
      setIsLoadingExistingVariants(false)
      setVariantLoadError(null)
      return
    }

    const controller = new AbortController()
    setIsLoadingExistingVariants(true)
    setVariantLoadError(null)
    setHydratedVariantProductId(null)

    void fetch(`/api/products/${productId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { success?: boolean; data?: unknown; error?: string } | null
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error || 'No se pudieron cargar las variantes guardadas.')
        }

        const variantData = normalizeProductVariantsForForm(payload.data)
        form.reset(
          { ...form.getValues(), ...variantData },
          { keepDirty: true, keepDirtyValues: true },
        )
        setHydratedVariantProductId(productId)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setVariantLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las variantes guardadas.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingExistingVariants(false)
      })

    return () => controller.abort()
  }, [form, isOpen, productId, productNeedsVariantHydration])

  // Se guarda lo escrito en cada cambio, pero solo mientras el formulario esta
  // sucio: sin eso, abrir un producto y cerrarlo dejaria un borrador identico a
  // lo guardado y la proxima apertura avisaria de una recuperacion que no
  // recupero nada.
  useEffect(() => {
    if (!isDirty) return
    const subscription = form.watch((values) => {
      saveProductDraft(productId, values as Record<string, unknown>)
    })
    return () => subscription.unsubscribe()
  }, [form, isDirty, productId])

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
      has_variants: Boolean(data.has_variants && (data.variant_attribute_config?.length ?? 0) > 0 && (data.variants?.length ?? 0) > 0),
      variant_attribute_config: data.has_variants && Array.isArray(data.variant_attribute_config)
        ? data.variant_attribute_config
        : [],
      variants: data.has_variants && Array.isArray(data.variants)
        ? data.variants
        : [],
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
      // Lo escrito ya esta en la base: el borrador dejaria de ser un respaldo
      // para pasar a ser una version vieja que reaparece.
      clearProductDraft(productId)
      setDraftRestored(false)
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
    // Descartar es explicito: si el borrador sobreviviera, volveria al abrir y
    // la persona habria descartado nada.
    clearProductDraft(productId)
    setDraftRestored(false)
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
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={!isSubmitting && !isUploadingImages}
        className="max-w-[95vw] w-full lg:max-w-6xl h-[95vh] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-none flex flex-col"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col flex-1 overflow-hidden h-full">
            {/* Header */}
            <div className={`shrink-0 relative overflow-hidden ${product
              ? 'border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20'
              : 'border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50/30 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900'
            }`}>
              {/* Decorative blur blob */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-blue-500/8 dark:bg-blue-400/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-40 h-24 bg-indigo-400/6 dark:bg-indigo-400/6 rounded-full blur-2xl pointer-events-none" />

              <div className="px-4 py-4 md:px-8 md:py-5 relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Icon badge */}
                    <div className={`relative flex-shrink-0 p-2.5 rounded-xl shadow-sm border ${product
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-400/30 shadow-blue-500/25'
                    }`}>
                      <Package className={`h-5 w-5 ${product ? 'text-blue-600 dark:text-blue-400' : 'text-white'}`} />
                      {!product && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900">
                          <span className="text-[8px] font-bold text-white">+</span>
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {product ? 'Editar Producto' : 'Nuevo Producto'}
                      </DialogTitle>
                      <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {product
                          ? <span>SKU: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{product.sku}</span></span>
                          : 'Completá la información básica para dar de alta el producto'
                        }
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {product && (
                      <Badge variant={product.is_active ? 'default' : 'secondary'} className="px-3 py-1 shadow-sm">
                        {product.is_active ? '● Activo' : '○ Inactivo'}
                      </Badge>
                    )}
                    {!product && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 px-2.5 py-1 text-xs font-semibold">
                        ✦ Nuevo
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Tips rápidos para producto nuevo */}
                {!product && (
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { icon: '🔑', tip: 'SKU, Nombre, Categoría y Precio de venta son obligatorios' },
                      { icon: '💡', tip: 'Podés agregar imágenes, variantes y configurar cuotas después' },
                      { icon: '👁️', tip: 'El producto aparecerá en tu tienda pública si está "Activo" y "Público"' },
                    ].map(({ icon, tip }) => (
                      <div key={tip} className="flex items-start gap-2 rounded-lg bg-white/70 dark:bg-slate-800/50 border border-blue-100/80 dark:border-blue-900/40 px-3 py-2">
                        <span className="text-base leading-none mt-0.5 flex-shrink-0">{icon}</span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {draftRestored && (
              <Alert className="mx-4 md:mx-8 mt-4 w-auto shrink-0 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Recuperamos lo que estabas cargando</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>Esto no está guardado todavía.</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearProductDraft(productId)
                      setDraftRestored(false)
                      onClose()
                    }}
                    className="rounded-md border border-amber-400 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-amber-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700 dark:hover:bg-amber-900/40"
                  >
                    Descartar y usar lo guardado
                  </button>
                </AlertDescription>
              </Alert>
            )}

            {saveFeedback && (
              <Alert variant="destructive" className="mx-4 md:mx-8 mt-4 w-auto shrink-0">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{saveFeedback.title}</AlertTitle>
                <AlertDescription>{saveFeedback.description}</AlertDescription>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex min-h-0 flex-col md:flex-row flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-full md:w-64 bg-slate-50/50 dark:bg-slate-900/30 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-3 md:p-5 overflow-hidden md:overflow-y-auto shrink-0 flex flex-col gap-6">
                  <TabsList className="grid grid-cols-3 md:flex md:flex-col h-auto bg-transparent w-full gap-2 md:gap-1 p-0 text-slate-500 dark:text-slate-400">
                    <TabsTrigger
                      value="basic"
                      className="w-full justify-center md:justify-start gap-2.5 px-3 py-2.5 text-xs md:text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800/50"
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
                      className="w-full justify-center md:justify-start gap-2.5 px-3 py-2.5 text-xs md:text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800/50"
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
                      className="w-full justify-center md:justify-start gap-2.5 px-3 py-2.5 text-xs md:text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    >
                      <Warehouse className="h-4 w-4" />
                      <span className="hidden md:inline">Inventario</span>
                      <span className="md:hidden">Stock</span>
                      {tabErrorMap.inventory && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="variants"
                      className="w-full justify-center md:justify-start gap-2.5 px-3 py-2.5 text-xs md:text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    >
                      <Layers3 className="h-4 w-4" />
                      <span className="hidden md:inline">Variantes</span>
                      <span className="md:hidden">Variantes</span>
                      {tabErrorMap.variants && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="post-sale"
                      className="w-full justify-center md:justify-start gap-2.5 px-3 py-2.5 text-xs md:text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800/50"
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
                      className="w-full justify-center md:justify-start gap-2.5 px-3 py-2.5 text-xs md:text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="hidden md:inline">Imágenes</span>
                      <span className="md:hidden">Fotos</span>
                      {tabErrorMap.images && (
                        <AlertCircle className="h-3.5 w-3.5 ml-auto text-red-500 shrink-0" />
                      )}
                    </TabsTrigger>
                  </TabsList>

                {/* Al crear: progreso de obligatorios. Al editar: info rapida. */}
                {!product && (
                  <NewProductChecklist
                    requirements={requirementsProgress.requirements}
                    completed={requirementsProgress.completed}
                    total={requirementsProgress.total}
                    isComplete={requirementsProgress.isComplete}
                    onNavigate={setActiveTab}
                  />
                )}

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
                  {/* Tip contextual - Pestaña Básica */}
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 px-4 py-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">📋</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Información Básica</p>
                      <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                        El <strong>SKU</strong> es el código único que identifica al producto en tu sistema.
                        Usá el botón <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-white/80 dark:bg-slate-800/80 rounded border border-blue-200 dark:border-blue-700 text-[10px] font-mono">✦ auto</span> para generar uno automáticamente.
                        La <strong>Categoría</strong> ayuda a organizar tu catálogo y mejora la búsqueda en tu tienda.
                      </p>
                    </div>
                  </div>

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
                                      placeholder="Ej: 7501234567890 (o escaneá con pistola USB)"
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
                                <FormDescription className="text-[11px]">
                                  💡 Si el producto físico ya tiene código de barras, podés posicionar el cursor aquí y <strong>disparar con tu lector láser</strong>.
                                </FormDescription>
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
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <FormLabel>Descripción <FieldRequirement /></FormLabel>
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span className="font-semibold text-primary">Plantillas rápidas:</span>
                                <button
                                  type="button"
                                  onClick={() => setValue('description', '• Características principales:\n• Material / Composición:\n• Medidas / Dimensiones:\n• Incluye en el paquete:\n• Recomendaciones de uso:', { shouldDirty: true })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  📦 General
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setValue('description', '• Confección y tela:\n• Calce y estilo:\n• Cuidados: Lavar con agua fría, no planchar sobre estampas.\n• Talles disponibles:', { shouldDirty: true })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  👕 Ropa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setValue('description', '• Marca y Modelo:\n• Especificaciones técnicas:\n• Conectividad / Puertos:\n• Batería / Autonomía:\n• Contenido de la caja:', { shouldDirty: true })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  📱 Tecnología
                                </button>
                              </div>
                            </div>
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
                                    {categoryOptions.map(({ category, depth, parentName }) => (
                                      <SelectItem key={category.id} value={category.id}>
                                        <span className={depth > 0 ? 'text-muted-foreground' : 'font-medium'}>
                                          {getCategoryIndent(depth)}
                                        </span>
                                        {category.name}
                                        {parentName && (
                                          <span className="ml-1.5 text-xs text-muted-foreground">
                                            en {parentName}
                                          </span>
                                        )}
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
                  {/* Tip contextual - Pestaña Precios */}
                  <div className="flex items-start gap-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 px-4 py-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">💰</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Precios y Ofertas</p>
                      <ul className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed space-y-0.5">
                        <li>• <strong>Precio de venta</strong>: el que ven tus clientes en la tienda. Es obligatorio.</li>
                        <li>• <strong>Precio mayorista</strong>: se aplica automáticamente a clientes mayoristas.</li>
                        <li>• <strong>Oferta</strong>: activala y ponele un precio especial por tiempo limitado.</li>
                        <li>• <strong>Cuotas</strong>: mostrá planes de financiación en la ficha del producto.</li>
                      </ul>
                    </div>
                  </div>

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
                            {/* ── Sugerencias rápidas de precio de venta ── */}
                            {canViewCost && Number(purchasePrice) > 0 && (
                              <div className="mt-2 space-y-1.5">
                                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                  💡 Sugerencias sobre el costo:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {[10, 20, 30, 40, 50, 70, 100].map(pct => {
                                    const suggested = Number((Number(purchasePrice) * (1 + pct / 100)).toFixed(2))
                                    const isActive = Math.abs(Number(salePrice) - suggested) < 0.01
                                    return (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => setValue('sale_price', suggested, { shouldDirty: true, shouldValidate: true })}
                                        className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all shadow-2xs select-none ${
                                          isActive
                                            ? 'border-green-500 bg-green-500 text-white shadow-green-200 dark:shadow-none'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-green-400 hover:text-green-700 dark:hover:border-green-600'
                                        }`}
                                        title={`+${pct}% sobre el costo`}
                                      >
                                        <span className="font-bold">+{pct}%</span>
                                        <span className="text-[9px] opacity-80">{formatCurrency(suggested)}</span>
                                      </button>
                                    )
                                  })}
                                </div>
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
                                {/* ── Sugerencias precio mayorista ── */}
                                {Number(salePrice) > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                      💡 Descuento sobre precio público:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {[5, 10, 15, 20, 25, 30].map(disc => {
                                        const suggested = Number((Number(salePrice) * (1 - disc / 100)).toFixed(2))
                                        const isActive = Math.abs(Number(wholesalePrice) - suggested) < 0.01
                                        return (
                                          <button
                                            key={disc}
                                            type="button"
                                            onClick={() => setValue('wholesale_price', suggested, { shouldDirty: true, shouldValidate: true })}
                                            className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all shadow-2xs select-none ${
                                              isActive
                                                ? 'border-blue-500 bg-blue-500 text-white'
                                                : 'border-blue-100 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                            }`}
                                            title={`${disc}% descuento sobre precio público`}
                                          >
                                            <span className="font-bold">-{disc}%</span>
                                            <span className="text-[9px] opacity-80">{formatCurrency(suggested)}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 leading-snug">
                                      El precio mayorista se aplica automáticamente a clientes con perfil mayorista. Si no lo cargás, estos clientes ven el precio público normal.
                                    </p>
                                  </div>
                                )}
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

                                {/* ── Sugerencias rápidas de precio de oferta ── */}
                                {hasOffer && Number(salePrice) > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                                      🔥 Descuento sobre precio público:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {[5, 10, 15, 20, 25, 30, 40, 50].map(disc => {
                                        const suggested = Number((Number(salePrice) * (1 - disc / 100)).toFixed(2))
                                        const isActive = Math.abs(Number(offerPrice) - suggested) < 0.01
                                        return (
                                          <button
                                            key={disc}
                                            type="button"
                                            onClick={() => setValue('offer_price', suggested, { shouldDirty: true, shouldValidate: true })}
                                            className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all shadow-2xs select-none ${
                                              isActive
                                                ? 'border-rose-500 bg-rose-500 text-white'
                                                : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:border-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30'
                                            }`}
                                            title={`${disc}% descuento sobre precio público`}
                                          >
                                            <span className="font-bold">-{disc}%</span>
                                            <span className="text-[9px] opacity-80">{formatCurrency(suggested)}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* ── Letra chica: Cómo funciona el precio de oferta ── */}
                                <div className={`mt-2 rounded-lg border px-3 py-2 transition-all ${hasOffer
                                  ? 'border-rose-200/80 bg-rose-50/50 dark:border-rose-800/40 dark:bg-rose-950/20'
                                  : 'border-gray-200/60 bg-gray-50/50 dark:border-gray-700/40 dark:bg-gray-900/20'
                                }`}>
                                  <p className={`text-[10px] font-semibold mb-1 ${hasOffer ? 'text-rose-700 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    ℹ️ Cómo funciona el precio de oferta:
                                  </p>
                                  <ul className={`text-[10px] leading-relaxed space-y-0.5 ${hasOffer ? 'text-rose-700/80 dark:text-rose-400/80' : 'text-gray-500/80 dark:text-gray-500/80'}`}>
                                    <li>• Al activar la oferta, el <strong>precio de oferta reemplaza al precio público</strong> en tu tienda online.</li>
                                    <li>• El precio público original se muestra <strong>tachado</strong> junto al precio de oferta para que el cliente vea el ahorro.</li>
                                    <li>• En el POS y reportes internos se usa siempre el precio de oferta mientras esté activo.</li>
                                    <li>• Si activás cuotas, las cuotas se calculan sobre el <strong>precio de oferta</strong> (no sobre el precio público).</li>
                                    <li>• Para desactivar la oferta, simplemente apagá el switch. El precio de oferta queda guardado para cuando quieras reactivarlo.</li>
                                  </ul>
                                </div>
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
                          <div className="space-y-2.5">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Activá la financiación para configurar los planes de cuotas del producto.
                              Los planes quedan guardados aunque la desactives.
                            </p>
                            <CreditHowItWorks
                              baseLabel={CREDIT_BASE_LABELS[creditDefaultsBase.source]}
                              planCount={creditDefaults.plans.length}
                              defaultsEnabled={creditDefaults.enabled}
                            />
                          </div>
                        ) : showCreditChoice ? (
                          <div className="space-y-3 rounded-xl border-2 border-indigo-300 bg-indigo-50/60 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
                            <div>
                              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                                ¿Cómo querés configurar las cuotas?
                              </p>
                              <p className="mt-0.5 text-xs text-indigo-700/80 dark:text-indigo-300/80">
                                Base configurada: {CREDIT_BASE_LABELS[creditDefaultsBase.source]} · {formatCurrency(creditDefaultsBase.baseAmount)}
                              </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={applyCreditDefaults}
                                className="rounded-lg border-2 border-indigo-400 bg-white p-3 text-left transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-900 dark:hover:bg-indigo-950/40"
                              >
                                <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                                  Usar datos predeterminados
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                                  {creditDefaults.plans.length} plan{creditDefaults.plans.length !== 1 ? 'es' : ''} ya configurado{creditDefaults.plans.length !== 1 ? 's' : ''}
                                  {creditDefaults.plans.length > 0 && `: ${creditDefaults.plans.map((plan) => `${plan.count}c`).join(', ')}`}
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => setCreditChoice('manual')}
                                className="rounded-lg border-2 border-gray-200 bg-white p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                              >
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                  Cargar nuevos desde cero
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                                  Armá los planes a mano solo para este producto.
                                </p>
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] text-indigo-700/70 dark:text-indigo-300/70">
                                Podés editar los planes después, elijas lo que elijas.
                              </p>
                              <CreditDefaultsLink />
                            </div>
                          </div>
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

                            {/* Como funciona + acceso a la configuracion, tambien
                                disponible mientras se arman los planes a mano. */}
                            <CreditHowItWorks
                              baseLabel={CREDIT_BASE_LABELS[creditDefaultsBase.source]}
                              planCount={creditDefaults.plans.length}
                              defaultsEnabled={creditDefaults.enabled}
                            />

                            {/* ── Chips rápidos con recargo inline ── */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Agregar plan rápido:</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={bulkOpen ? 'secondary' : 'outline'}
                                  onClick={() => setBulkOpen((v) => !v)}
                                  className="h-6 px-2 text-[11px] gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Agregar varios
                                </Button>
                              </div>

                              {/* Chips individuales con popover de recargo inline */}
                              <div className="flex flex-wrap gap-1.5">
                                {INSTALLMENT_PRESETS.map((preset) => {
                                  const already = (installmentsPlans ?? []).some((p) => Number(p?.count) === preset)
                                  const isExpanded = expandedChip === preset
                                  const currentRate = chipRate[preset] ?? '0'
                                  const previewAmount = installmentBase > 0 && !already
                                    ? buildCreditInstallmentPlan({
                                        principalAmount: installmentBase,
                                        interestRate: Number(currentRate) || 0,
                                        installmentCount: preset,
                                        frequency: 'monthly',
                                      })
                                    : null

                                  if (already) {
                                    return (
                                      <span
                                        key={preset}
                                        className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 cursor-default select-none"
                                      >
                                        ✓ {preset}c
                                      </span>
                                    )
                                  }

                                  if (isExpanded) {
                                    return (
                                      <div
                                        key={preset}
                                        className="flex flex-col gap-1.5 rounded-lg border-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 p-2 shadow-sm"
                                      >
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">{preset}c</span>
                                          <span className="text-[10px] text-gray-500 shrink-0">Rec.%:</span>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            max={999}
                                            autoFocus
                                            value={currentRate}
                                            onChange={(e) => setChipRate((prev) => ({ ...prev, [preset]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === 'Tab') {
                                                e.preventDefault()
                                                appendInstallment({ count: preset, rate: Number(currentRate) || 0 })
                                                setExpandedChip(null)
                                                setChipRate((prev) => { const n = { ...prev }; delete n[preset]; return n })
                                              }
                                              if (e.key === 'Escape') {
                                                setExpandedChip(null)
                                              }
                                            }}
                                            className="w-14 h-6 text-xs rounded border border-indigo-300 px-1.5 bg-white dark:bg-slate-900 dark:border-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                            placeholder="0"
                                          />
                                          {previewAmount && (
                                            <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 shrink-0">
                                              = {formatPrice(previewAmount.installments[0]?.amount ?? 0)}
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              appendInstallment({ count: preset, rate: Number(currentRate) || 0 })
                                              setExpandedChip(null)
                                              setChipRate((prev) => { const n = { ...prev }; delete n[preset]; return n })
                                            }}
                                            className="ml-0.5 flex items-center justify-center h-5 w-5 rounded bg-indigo-500 text-white hover:bg-indigo-600 text-xs font-bold shrink-0"
                                            title="Confirmar (Enter)"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setExpandedChip(null)}
                                            className="flex items-center justify-center h-5 w-5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 hover:text-gray-700 text-xs shrink-0"
                                            title="Cancelar (Esc)"
                                          >
                                            ×
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-1.5 pl-[3.25rem]">
                                          {[0, 10, 15, 20, 30].map(r => (
                                            <button
                                              key={r}
                                              type="button"
                                              onClick={() => {
                                                appendInstallment({ count: preset, rate: r })
                                                setExpandedChip(null)
                                                setChipRate((prev) => { const n = { ...prev }; delete n[preset]; return n })
                                              }}
                                              className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:border-indigo-300 transition-colors"
                                            >
                                              {r}%
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  }

                                  return (
                                    <Button
                                      key={preset}
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setBulkOpen(false)
                                        setExpandedChip(preset)
                                        setChipRate((prev) => ({ ...prev, [preset]: prev[preset] ?? String(defaultRateForInstallmentCount(preset)) }))
                                      }}
                                      className="h-7 px-2.5 text-xs border-dashed hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 transition-colors"
                                    >
                                      {preset === 1 ? '1 cuota' : `${preset}c`}
                                    </Button>
                                  )
                                })}
                                {/* Botón "Otra" para número personalizado */}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => appendInstallment({ count: 3, rate: 0 })}
                                  className="h-7 px-2 text-xs text-gray-400 hover:text-gray-700"
                                  title="Agregar fila con número personalizado"
                                >
                                  <Plus className="h-3 w-3 mr-0.5" /> Otra
                                </Button>
                              </div>

                              {/* ── Panel bulk: Agregar varios de una vez ── */}
                              {bulkOpen && (
                                <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/20 dark:border-indigo-700 p-3 space-y-2 shadow-inner">
                                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                                    Seleccioná los planes a agregar y configurá el recargo de cada uno:
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {INSTALLMENT_PRESETS.map((n) => {
                                      const already = (installmentsPlans ?? []).some((p) => Number(p?.count) === n)
                                      const entry = bulkDraft[n] ?? { checked: false, rate: String(defaultRateForInstallmentCount(n)) }
                                      const previewBulk = installmentBase > 0 && entry.checked
                                        ? buildCreditInstallmentPlan({
                                            principalAmount: installmentBase,
                                            interestRate: Number(entry.rate) || 0,
                                            installmentCount: n,
                                            frequency: 'monthly',
                                          })
                                        : null

                                      return (
                                        <label
                                          key={n}
                                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors
                                            ${already ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900' :
                                              entry.checked ? 'border-indigo-400 bg-white dark:bg-slate-900 dark:border-indigo-600 shadow-sm' :
                                              'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-slate-900/40 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                                        >
                                          <input
                                            type="checkbox"
                                            disabled={already}
                                            checked={entry.checked || already}
                                            onChange={(e) =>
                                              setBulkDraft((prev) => ({
                                                ...prev,
                                                [n]: {
                                                  checked: e.target.checked,
                                                  rate: prev[n]?.rate ?? String(defaultRateForInstallmentCount(n)),
                                                },
                                              }))
                                            }
                                            className="h-3.5 w-3.5 accent-indigo-600 shrink-0"
                                          />
                                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-16 shrink-0">
                                            {n === 1 ? '1 cuota' : `${n} cuotas`}
                                            {already && <span className="ml-1 text-[10px] text-indigo-500">✓</span>}
                                          </span>
                                          <div className="flex flex-col gap-1 flex-1">
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-gray-400 shrink-0">Rec.%</span>
                                              <input
                                                type="number"
                                                step="0.1"
                                                min={0}
                                                max={999}
                                                disabled={already || !entry.checked}
                                                value={entry.rate}
                                                onClick={(e) => e.preventDefault()}
                                                onChange={(e) =>
                                                  setBulkDraft((prev) => ({
                                                    ...prev,
                                                    [n]: { ...prev[n], rate: e.target.value },
                                                  }))
                                                }
                                                className="w-14 h-6 text-xs rounded border border-gray-200 dark:border-gray-700 px-1.5 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                                placeholder="0"
                                              />
                                            </div>
                                            {entry.checked && !already && (
                                              <div className="flex items-center gap-1">
                                                {[0, 10, 15, 20, 30].map(r => (
                                                  <button
                                                    key={r}
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      setBulkDraft((prev) => ({ ...prev, [n]: { ...prev[n], rate: String(r) } }))
                                                    }}
                                                    className="px-1 py-0.5 text-[9px] font-medium rounded border border-indigo-200/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                                                  >
                                                    {r}%
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          {previewBulk && (
                                            <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400 shrink-0 ml-auto">
                                              = {formatPrice(previewBulk.installments[0]?.amount ?? 0)}
                                            </span>
                                          )}
                                        </label>
                                      )
                                    })}
                                  </div>
                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] text-gray-500">
                                      {Object.values(bulkDraft).filter(e => e.checked).length} seleccionados
                                    </span>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setBulkOpen(false)
                                          setBulkDraft(Object.fromEntries(INSTALLMENT_PRESETS.map(n => [n, { checked: false, rate: '0' }])))
                                        }}
                                        className="h-7 px-2 text-xs"
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                          const toAdd = INSTALLMENT_PRESETS.filter((n) => {
                                            const already = (installmentsPlans ?? []).some((p) => Number(p?.count) === n)
                                            return !already && bulkDraft[n]?.checked
                                          })
                                          toAdd.forEach((n) =>
                                            appendInstallment({ count: n, rate: Number(bulkDraft[n]?.rate) || 0 })
                                          )
                                          setBulkOpen(false)
                                          setBulkDraft(Object.fromEntries(INSTALLMENT_PRESETS.map(n => [n, { checked: false, rate: '0' }])))
                                          if (toAdd.length === 0) toast.info('No hay planes nuevos para agregar.')
                                        }}
                                        className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                      >
                                        Agregar {Object.values(bulkDraft).filter(e => e.checked).length > 0
                                          ? `(${Object.values(bulkDraft).filter(e => e.checked).length})`
                                          : ''} planes
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {installmentFields.length === 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Agregá al menos una opción de cuotas usando los botones de arriba.
                              </p>
                            )}

                            {/* Filas editables por opción */}
                            <div className="space-y-1.5">
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
                                  <div key={row.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-slate-900/40 px-2.5 py-1.5">
                                    <FormField
                                      control={form.control}
                                      name={`installments_plans.${index}.count`}
                                      render={({ field }) => (
                                        <FormItem className="w-[68px] shrink-0">
                                          <FormLabel className="text-[10px] text-gray-400">Cuotas</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={60}
                                              className="h-7 text-sm px-2"
                                              {...field}
                                              value={field.value ?? ''}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget.closest('[data-row]')?.querySelector('input[data-rate]') as HTMLInputElement)?.focus() }
                                              }}
                                            />
                                          </FormControl>
                                          <FormMessage className="text-[10px]" />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name={`installments_plans.${index}.rate`}
                                      render={({ field }) => (
                                        <FormItem className="w-[80px] shrink-0">
                                          <FormLabel className="text-[10px] text-gray-400">Recargo %</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min={0}
                                              placeholder="0"
                                              className="h-7 text-sm px-2"
                                              data-rate
                                              {...field}
                                              value={field.value ?? ''}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  // focus next row or append a new one
                                                  const rows = document.querySelectorAll('[data-installment-row]')
                                                  const nextRow = rows[index + 1] as HTMLElement | null
                                                  if (nextRow) {
                                                    (nextRow.querySelector('input') as HTMLInputElement)?.focus()
                                                  } else {
                                                    appendInstallment({ count: count + 1 > 60 ? 60 : count + 1, rate: 0 })
                                                  }
                                                }
                                              }}
                                            />
                                          </FormControl>
                                          <FormMessage className="text-[10px]" />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="flex-1 min-w-0 pt-4" data-installment-row>
                                      {preview ? (
                                        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-snug">
                                          {count} × <strong>{formatPrice(preview.installments[0]?.amount ?? 0)}</strong>
                                          {preview.interestAmount > 0
                                            ? <span className="text-indigo-600/70"> · Total {formatPrice(preview.financedTotal)}</span>
                                            : <span className="text-indigo-600/70"> · sin interés</span>}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-gray-400 pt-0.5">—</p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeInstallment(index)}
                                      className="h-7 w-7 p-0 text-gray-300 hover:text-red-500 shrink-0 mt-3"
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
                  {/* Tip contextual - Inventario */}
                  <div className="flex items-start gap-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-4 py-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">📦</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Control de Inventario</p>
                      <ul className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed space-y-0.5">
                        <li>• <strong>Stock actual</strong>: cuántas unidades tenés disponibles hoy.</li>
                        <li>• <strong>Stock mínimo</strong>: recibirás alertas cuando baje de este valor.</li>
                        <li>• <strong>Stock máximo</strong>: referencia para reordenar stock (opcional).</li>
                      </ul>
                    </div>
                  </div>
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

                <TabsContent value="variants" className="space-y-5 py-4">
                  {/* Tip contextual - Variantes */}
                  <div className="flex items-start gap-3 rounded-xl bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40 px-4 py-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">🎨</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-violet-800 dark:text-violet-300 mb-1">Variantes del Producto</p>
                      <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80 leading-relaxed">
                        Usá variantes para manejar <strong>colores, talles, tamaños</strong> u otras opciones sin crear un producto separado por cada una.
                        Cada variante tiene su propio stock, precio y SKU derivado. Activá la opción solo si el producto tiene opciones distintas.
                      </p>
                    </div>
                  </div>
                  {isLoadingExistingVariants && (
                    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <AlertTitle>Cargando variantes guardadas</AlertTitle>
                      <AlertDescription>
                        Estamos recuperando talles, colores, precios y stock antes de habilitar la edición.
                      </AlertDescription>
                    </Alert>
                  )}
                  {variantLoadError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No se pudieron mostrar las variantes</AlertTitle>
                      <AlertDescription>
                        {variantLoadError} Cerrá y volvé a abrir el producto para reintentar. No se guardará ningún cambio mientras falten estos datos.
                      </AlertDescription>
                    </Alert>
                  )}
                  <ProductVariantsEditor
                    businessVertical={businessVertical}
                    value={variantValue}
                    baseSku={sku}
                    basePrices={{
                      purchasePrice: Number(purchasePrice) || 0,
                      salePrice: Number(salePrice) || 0,
                      wholesalePrice: Number(wholesalePrice) > 0 ? Number(wholesalePrice) : undefined,
                    }}
                    disabled={isSubmitting || isLoadingExistingVariants || !isExistingVariantDataReady}
                    onChange={(next) => {
                      form.setValue('has_variants', next.hasVariants, { shouldDirty: true, shouldValidate: true })
                      form.setValue('variant_attribute_config', next.attributes, { shouldDirty: true, shouldValidate: true })
                      form.setValue('variants', next.variants, { shouldDirty: true, shouldValidate: true })
                    }}
                  />
                  <ProductVariantReview value={variantValue} />
                </TabsContent>

                {/* Post-Sale */}
                <TabsContent value="post-sale" className="space-y-4 py-4">
                  {/* Tip contextual - Postventa */}
                  <div className="flex items-start gap-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 px-4 py-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">🛡️</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">Garantía y Política Postventa</p>
                      <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 leading-relaxed">
                        Esta información se muestra en la ficha pública del producto y genera <strong>confianza en el comprador</strong>.
                        Configurá la garantía en meses, los días de devolución y las políticas de cambio. Son <em>completamente opcionales</em> pero recomendados.
                      </p>
                    </div>
                  </div>
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
                              {/* ── Chips rápidos de meses ── */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {[
                                  { label: 'Sin garantía', val: 0 },
                                  { label: '1 mes', val: 1 },
                                  { label: '3 meses', val: 3 },
                                  { label: '6 meses', val: 6 },
                                  { label: '12 meses (1 año)', val: 12 },
                                  { label: '24 meses (2 años)', val: 24 },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => setValue('warranty_months', item.val, { shouldDirty: true })}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                      Number(field.value) === item.val
                                        ? 'bg-rose-500 text-white border-rose-500'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="rounded-xl border p-4 bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 flex flex-col justify-center">
                          <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Resumen en ficha pública</p>
                          <p className="text-lg font-bold text-rose-900 dark:text-rose-100 mt-0.5">
                            {warrantyMonths > 0 ? `🛡️ ${warrantyMonths} meses de garantía oficial` : '⚠️ Sin garantía'}
                          </p>
                          <p className="text-[10px] text-rose-700/70 dark:text-rose-300/70 mt-1">
                            Aparece destacado en la página de compra para generar seguridad.
                          </p>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="warranty_info"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <FormLabel>Condiciones de garantía <FieldRequirement /></FormLabel>
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span className="font-semibold text-primary">Plantillas:</span>
                                <button
                                  type="button"
                                  onClick={() => setValue('warranty_info', 'Garantía oficial por fallas o defectos de fabricación durante el período establecido. No cubre roturas por golpes, caídas, humedad, sobretensión eléctrica o manipulación indebida.', { shouldDirty: true })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  ⚡ Electrónica
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setValue('warranty_info', 'Garantía por defectos de confección o costura. El producto debe presentarse con etiqueta original y no presentar signos de uso ni lavado.', { shouldDirty: true })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  👕 Ropa/Calzado
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setValue('warranty_info', 'Cubre defectos o vicios de fabricación presentando el comprobante o factura de compra correspondiente y empaque original.', { shouldDirty: true })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  📦 Estándar
                                </button>
                              </div>
                            </div>
                            <FormControl>
                              <Textarea
                                rows={3}
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
                              {/* ── Chips rápidos días de devolución ── */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {[
                                  { label: 'No permite (0d)', val: 0 },
                                  { label: '7 días', val: 7 },
                                  { label: '10 días', val: 10 },
                                  { label: '15 días', val: 15 },
                                  { label: '30 días', val: 30 },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => setValue('return_window_days', item.val, { shouldDirty: true })}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                      Number(field.value) === item.val
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
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
                              {/* ── Chips rápidos días de cambio ── */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {[
                                  { label: 'No permite (0d)', val: 0 },
                                  { label: '7 días', val: 7 },
                                  { label: '15 días', val: 15 },
                                  { label: '30 días', val: 30 },
                                  { label: '60 días', val: 60 },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => setValue('exchange_window_days', item.val, { shouldDirty: true })}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                      Number(field.value) === item.val
                                        ? 'bg-indigo-500 text-white border-indigo-500'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="rounded-xl border p-4 bg-muted/20 text-sm">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Ventanas activas en la tienda:</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          <span>🔄 Devolución: <strong className="text-foreground">{returnWindowDays > 0 ? `${returnWindowDays} días` : 'No disponible'}</strong></span>
                          <span>·</span>
                          <span>🔁 Cambio: <strong className="text-foreground">{exchangeWindowDays > 0 ? `${exchangeWindowDays} días` : 'No disponible'}</strong></span>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="return_policy"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <FormLabel>Política de devolución <FieldRequirement /></FormLabel>
                              <button
                                type="button"
                                onClick={() => setValue('return_policy', 'Devolución aceptada dentro del plazo establecido. El producto debe encontrarse sin uso, en su empaque y caja original con todos los accesorios y factura de compra.', { shouldDirty: true })}
                                className="text-[11px] text-primary hover:underline font-semibold"
                              >
                                💡 Insertar política estándar
                              </button>
                            </div>
                            <FormControl>
                              <Textarea
                                rows={3}
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
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <FormLabel>Política de cambio <FieldRequirement /></FormLabel>
                              <button
                                type="button"
                                onClick={() => setValue('exchange_policy', 'Cambio directo por talle, modelo o equivalente dentro del plazo indicado, sujeto a stock disponible. El producto debe conservar su embalaje original.', { shouldDirty: true })}
                                className="text-[11px] text-primary hover:underline font-semibold"
                              >
                                💡 Insertar política de cambio
                              </button>
                            </div>
                            <FormControl>
                              <Textarea
                                rows={3}
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
                  {/* Tip contextual - Imágenes */}
                  <div className="flex items-start gap-3 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 px-4 py-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">📸</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 mb-1">Imágenes del Producto</p>
                      <ul className="text-[11px] text-sky-700/80 dark:text-sky-400/80 leading-relaxed space-y-0.5">
                        <li>• Subí hasta <strong>5 imágenes</strong>. La primera será la imagen principal de la ficha.</li>
                        <li>• Formatos soportados: <strong>JPG, PNG y WebP</strong>. Tamaño máximo 5 MB por imagen.</li>
                        <li>• 💡 <em>Tip</em>: fotos con fondo blanco y buena luz aumentan las conversiones.</li>
                      </ul>
                    </div>
                  </div>
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
            <div className="sticky bottom-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-4 py-3 md:px-8 md:py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0 z-10">
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
                  className="min-w-[100px] flex-1 sm:flex-none border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingImages || !isExistingVariantDataReady}
                  aria-describedby="product-form-status"
                  className={`min-w-[180px] flex-1 sm:flex-none text-white rounded-xl font-medium transition-all ${
                    submitState.ready
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 dark:bg-blue-600 dark:hover:bg-blue-500'
                      : 'bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 dark:bg-amber-600 dark:hover:bg-amber-500'
                  }`}
                >
                  {isSubmitting || isUploadingImages || isLoadingExistingVariants ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {isUploadingImages ? 'Subiendo imágenes...' : isLoadingExistingVariants ? 'Cargando variantes...' : 'Guardando...'}
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
