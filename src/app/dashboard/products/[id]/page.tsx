'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion  } from '../../../../components/ui/motion'
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package, 
  AlertTriangle,
  TrendingUp,
  Download,
  Upload,
  BarChart3,
  History,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Clock,
  Image as ImageIcon,
  DollarSign,
  CreditCard,
  Zap,
  Tag,
  ChevronRight,
  Home,
  TrendingDown,
  Minus,
  InboxIcon,
  FileText,
  Layers,
  Activity,
  Info,
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import type { Product } from '@/types/product-unified'
import { ProductModal } from '@/components/dashboard/product-modal'
import Image from 'next/image'
import { resolveProductImageUrl } from '@/lib/images'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

// ─── Local types (moved out of hooks for cleanliness) ────────────────────────

interface ProductImage {
  id: string
  url: string
  alt: string
  isPrimary: boolean
}

interface StockMovement {
  id: string
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia'
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  date: string
  user: string
}

type PriceHistoryEntry = {
  id: string
  type: 'purchase' | 'sale' | 'wholesale'
  old_price: number
  new_price: number
  change_reason?: string | null
  created_at: string
  currency?: string | null
}

type MovementRow = Database['public']['Tables']['product_movements']['Row'] & { notes?: string; reason?: string }

type PriceHistoryRow = {
  id: string
  product_id: string
  price_type: 'purchase' | 'sale' | 'wholesale'
  old_price?: number
  new_price: number
  change_reason?: string | null
  currency?: string | null
  user_id?: string | null
  created_at: string
}

// Extended type to avoid `as any` casts for installments fields
type ProductWithInstallments = Product & {
  installments_enabled?: boolean
  installments_public?: boolean
  installments_plans?: Array<{ count: number; rate: number }>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const canViewCost = useCanViewCost()
  const { toast } = useToast()
  const productId = params.id as string

  const {
    categories,
    suppliers,
    brands,
    updateProduct,
    deleteProduct
  } = useProductsSupabase()

  const [product, setProduct] = useState<ProductWithInstallments | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([])

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadProduct = useCallback(async () => {
    setLoadingProduct(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, phone, address)
        `)
        .eq('id', productId)
        .single()

      if (error) throw error
      setProduct(data as unknown as ProductWithInstallments)
    } catch (e) {
      logger.error('Error loading product', { error: e })
      toast({
        title: "Error",
        description: "No se pudo cargar la información del producto.",
        variant: "destructive"
      })
    } finally {
      setLoadingProduct(false)
    }
  }, [productId, toast])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  useEffect(() => {
    if (!loadingProduct && !product) {
      toast({
        title: "Producto no encontrado",
        description: "El producto que buscas no existe o ha sido eliminado.",
        variant: "destructive"
      })
      router.push('/dashboard/products')
    }
  }, [product, loadingProduct, router, toast])

  useEffect(() => {
    const fetchMovements = async () => {
      if (!productId) return
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('product_movements')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
        if (error) throw error
        const mapped: StockMovement[] = ((data || []) as MovementRow[]).map((m) => ({
          id: m.id,
          type: m.movement_type === 'in' ? 'entrada' : m.movement_type === 'out' ? 'salida' : m.movement_type === 'adjustment' ? 'ajuste' : 'transferencia',
          quantity: m.quantity,
          previousStock: m.previous_stock,
          newStock: m.new_stock,
          reason: m.notes || m.reason || '',
          date: m.created_at,
          user: m.user_id || 'Sistema'
        }))
        setStockMovements(mapped)
      } catch (e) {
        logger.debug('Error loading movements', { error: e })
      }
    }

    const fetchPriceHistory = async () => {
      if (!productId) return
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('product_price_history')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows = ((data || []) as PriceHistoryRow[])
        const mapped: PriceHistoryEntry[] = rows.map((row) => ({
          id: row.id,
          type: row.price_type,
          old_price: row.old_price ?? 0,
          new_price: row.new_price,
          change_reason: row.change_reason ?? null,
          currency: row.currency ?? 'PYG',
          created_at: row.created_at
        }))
        setPriceHistory(mapped)
      } catch (e) {
        logger.debug('Error loading price history', { error: e })
      }
    }

    fetchMovements()
    fetchPriceHistory()
  }, [productId])

  // ─── Memos ─────────────────────────────────────────────────────────────────

  const normalizedCategories = useMemo(() => {
    return (categories || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || null,
      parent_id: null,
      is_active: c.is_active,
      created_at: c.created_at,
      updated_at: c.updated_at
    }))
  }, [categories])

  const normalizedSuppliers = useMemo(() => {
    return (suppliers || []).map(s => ({
      id: s.id,
      name: s.name,
      contact_name: s.contact_name || null,
      contact_email: s.email || null,
      phone: s.phone || null,
      address: s.address || null,
      tax_id: s.tax_id || null,
      is_active: s.is_active,
      created_at: s.created_at,
      updated_at: s.updated_at
    }))
  }, [suppliers])

  const normalizedBrands = useMemo(() => {
    return (brands || []).map(b => ({
      id: b.id,
      name: b.name,
      description: b.description || null,
      website: b.website || null,
      country: b.country || null,
      founded_year: b.founded_year || null,
      logo_url: b.logo_url || null,
      is_active: b.is_active,
      created_at: b.created_at,
      updated_at: b.updated_at
    }))
  }, [brands])

  const productImages: ProductImage[] = useMemo(() => {
    const urls = (product?.images || []).filter(Boolean) as string[]
    const uniq = Array.from(new Set(urls))
    if (uniq.length === 0) {
      return [{ id: '1', url: '/placeholder-product.jpg', alt: product?.name || 'Producto', isPrimary: true }]
    }
    return uniq.map((u, i) => ({ id: `${i + 1}`, url: resolveProductImageUrl(u), alt: product?.name || 'Producto', isPrimary: i === 0 }))
  }, [product?.images, product?.name])

  const normalizedBarcode = (product?.barcode || '').trim()

  const calculatedStockStatus = useMemo(() => {
    const stock = product?.stock_quantity ?? 0
    const minStock = product?.min_stock ?? 0
    if (stock <= 0) return 'out_of_stock'
    if (stock <= Math.max(minStock, 0)) return 'low_stock'
    return 'in_stock'
  }, [product?.stock_quantity, product?.min_stock])

  // Stock progress: % between minStock (0%) and maxStock (100%) — clamped
  const stockProgressValue = useMemo(() => {
    const stock = product?.stock_quantity ?? 0
    const min = product?.min_stock ?? 0
    const max = product?.max_stock ?? 0
    if (max > min) {
      return Math.min(100, Math.max(0, ((stock - min) / (max - min)) * 100))
    }
    // Fallback: just cap at 200% of min_stock as "full"
    const reference = Math.max(min * 2, 1)
    return Math.min(100, (stock / reference) * 100)
  }, [product?.stock_quantity, product?.min_stock, product?.max_stock])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleEdit = () => setEditModalOpen(true)

  const handleDelete = async () => {
    if (!product) return
    try {
      const result = await deleteProduct(product.id)
      if (!result.success) throw new Error(result.error || 'No se pudo eliminar el producto.')
      toast({ title: "Producto eliminado", description: "El producto ha sido eliminado exitosamente." })
      router.push('/dashboard/products')
    } catch (error) {
      logger.error('Error deleting product from detail page', { error, productId: product.id })
      toast({ title: "Error", description: "No se pudo eliminar el producto.", variant: "destructive" })
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(product?.id || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "ID copiado", description: "El ID del producto ha sido copiado al portapapeles." })
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({ title: "Enlace copiado", description: "El enlace del producto ha sido copiado al portapapeles." })
  }

  const handleCopyBarcode = () => {
    if (!normalizedBarcode) return
    navigator.clipboard.writeText(normalizedBarcode)
    toast({ title: "Código copiado", description: "El código de barras fue copiado al portapapeles." })
  }

  const handleSearchBarcode = () => {
    if (!normalizedBarcode) return
    window.open(`https://www.google.com/search?q=${encodeURIComponent(normalizedBarcode)}`, '_blank', 'noopener,noreferrer')
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'low_stock': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'out_of_stock': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return 'En Stock'
      case 'low_stock': return 'Stock Bajo'
      case 'out_of_stock': return 'Agotado'
      default: return 'Desconocido'
    }
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(amount)
    return `Gs. ${formatted}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPriceChangeBadge = (entry: PriceHistoryEntry) => {
    const diff = entry.new_price - entry.old_price
    if (diff > 0) return { label: `+${formatCurrency(diff)}`, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: TrendingUp }
    if (diff < 0) return { label: formatCurrency(diff), className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: TrendingDown }
    return { label: 'Sin cambio', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: Minus }
  }

  const getPriceTypeLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'Compra'
      case 'sale': return 'Venta'
      case 'wholesale': return 'Mayorista'
      default: return type
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Header skeleton */}
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-96 w-full rounded-xl" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) return null

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Inicio</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
          <button
            onClick={() => router.push('/dashboard/products')}
            className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Productos
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
          <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px]">
            {product.name}
          </span>
        </motion.nav>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</span>
                <Button variant="ghost" size="sm" onClick={handleCopyId} className="h-6 px-2">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                {/* Active status pill */}
                <Badge className={product.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}>
                  {product.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Product Images */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-6">
                  {/* Main image */}
                  <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                    {productImages && productImages[selectedImageIndex]?.url ? (
                      <Image
                        src={productImages[selectedImageIndex].url}
                        alt={product?.name || ''}
                        fill
                        className="object-cover rounded-xl"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin imagen</p>
                      </div>
                    )}
                    {/* Image counter badge */}
                    {productImages.length > 1 && (
                      <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                        {selectedImageIndex + 1} / {productImages.length}
                      </div>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {productImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {productImages.map((image, index) => (
                        <button
                          key={image.id}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                            selectedImageIndex === index
                              ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                          }`}
                        >
                          <Image
                            src={image.url}
                            alt={image.alt}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Product Information Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 dark:bg-gray-800">
                  <TabsTrigger value="overview" className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Resumen
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Inventario
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Historial
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Análisis
                  </TabsTrigger>
                </TabsList>

                {/* ── Tab: Resumen ────────────────────────────────────────── */}
                <TabsContent value="overview" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <Package className="h-5 w-5" />
                        Información del Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Descripción</label>
                          <p className="text-gray-900 dark:text-gray-100 mt-0.5">{product.description || 'Sin descripción'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</label>
                          <p className="text-gray-900 dark:text-gray-100 mt-0.5">{product.brand || 'Sin marca'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoría</label>
                          <p className="text-gray-900 dark:text-gray-100 mt-0.5">{product.category?.name || 'Sin categoría'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Proveedor</label>
                          <p className="text-gray-900 dark:text-gray-100 mt-0.5">{product.supplier?.name || 'Sin proveedor'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Unidad de Medida</label>
                          <p className="text-gray-900 dark:text-gray-100 mt-0.5">{product.unit_measure || 'unidad'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Código de Barras</label>
                          {normalizedBarcode ? (
                            <div className="mt-1 space-y-2">
                              <code className="block rounded-md bg-gray-100 dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                                {normalizedBarcode}
                              </code>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleCopyBarcode}>
                                  <Copy className="h-3.5 w-3.5 mr-1" />
                                  Copiar
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleSearchBarcode}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Buscar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400 italic text-sm mt-0.5">Sin código de barras</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Tab: Inventario ─────────────────────────────────────── */}
                <TabsContent value="inventory" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <BarChart3 className="h-5 w-5" />
                        Estado del Inventario
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                          <Package className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{product.stock_quantity}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">Stock Actual</p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                          <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{product.min_stock ?? 0}</p>
                          <p className="text-sm text-yellow-600 dark:text-yellow-300">Stock Mínimo</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                          <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {product.max_stock != null ? product.max_stock : '—'}
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-300">Stock Máximo</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="dark:text-gray-300">Nivel de Stock</span>
                          <span className="dark:text-gray-300 font-medium">{Math.round(stockProgressValue)}%</span>
                        </div>
                        <Progress value={stockProgressValue} className="h-2" />
                        {calculatedStockStatus !== 'in_stock' && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {calculatedStockStatus === 'out_of_stock'
                              ? 'Sin stock disponible. Considera reabastecer.'
                              : 'El stock está por debajo del mínimo.'}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Tab: Historial ──────────────────────────────────────── */}
                <TabsContent value="history" className="space-y-6">
                  {/* Movimientos de Stock */}
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <History className="h-5 w-5" />
                        Movimientos de Stock
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stockMovements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                            <InboxIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                          </div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sin movimientos registrados</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Los movimientos de stock aparecerán aquí</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {stockMovements.map((movement, idx) => (
                            <motion.div
                              key={movement.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04 }}
                              className="flex items-center justify-between p-4 border rounded-xl dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  movement.type === 'entrada' ? 'bg-green-100 dark:bg-green-900/30' :
                                  movement.type === 'salida' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                                }`}>
                                  {movement.type === 'entrada' ? (
                                    <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  ) : movement.type === 'salida' ? (
                                    <Download className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  ) : (
                                    <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium dark:text-gray-100">
                                    {movement.type === 'entrada' ? 'Entrada' :
                                     movement.type === 'salida' ? 'Salida' : 'Ajuste'}{' '}
                                    de {Math.abs(movement.quantity)} unidades
                                  </p>
                                  {movement.reason && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{movement.reason}</p>
                                  )}
                                  <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatDate(movement.date)} • {movement.user}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                                  {movement.previousStock} → {movement.newStock}
                                </p>
                                <Badge
                                  className={`text-xs mt-1 ${
                                    movement.type === 'entrada'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                      : movement.type === 'salida'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  }`}
                                >
                                  {movement.type}
                                </Badge>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Historial de Precios */}
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <DollarSign className="h-5 w-5" />
                        Historial de Precios
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {priceHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                            <FileText className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                          </div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sin cambios de precio</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Los cambios de precio aparecerán aquí</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {priceHistory.map((ph, idx) => {
                            const badge = getPriceChangeBadge(ph)
                            const Icon = badge.icon
                            return (
                              <motion.div
                                key={ph.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="flex items-center justify-between p-4 border rounded-xl dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-full ${badge.className}`}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium dark:text-gray-100">
                                      {getPriceTypeLabel(ph.type)}: {formatCurrency(ph.old_price)} → {formatCurrency(ph.new_price)}
                                    </p>
                                    {ph.change_reason && (
                                      <p className="text-sm text-gray-500 dark:text-gray-400">{ph.change_reason}</p>
                                    )}
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(ph.created_at)}</p>
                                  </div>
                                </div>
                                <Badge className={`text-xs ${badge.className}`}>
                                  {badge.label}
                                </Badge>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Tab: Análisis ───────────────────────────────────────── */}
                <TabsContent value="analytics" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <BarChart3 className="h-5 w-5" />
                        Análisis de Rendimiento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3 dark:text-gray-200 flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            Métricas Financieras
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between py-1.5 border-b dark:border-gray-700">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Valor en Stock</span>
                              <span className="font-medium dark:text-gray-200">{formatCurrency(product.stock_quantity * product.sale_price)}</span>
                            </div>
                            {canViewCost && (
                              <div className="flex justify-between py-1.5 border-b dark:border-gray-700">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Margen por Unidad</span>
                                <span className="font-medium dark:text-gray-200">{formatCurrency(product.sale_price - (product.purchase_price || 0))}</span>
                              </div>
                            )}
                            {canViewCost && (
                              <div className="flex justify-between py-1.5">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Margen %</span>
                                <span className="font-medium dark:text-gray-200">
                                  {product.purchase_price
                                    ? `${(((product.sale_price - product.purchase_price) / product.purchase_price) * 100).toFixed(1)}%`
                                    : '—'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3 dark:text-gray-200 flex items-center gap-2">
                            <Tag className="h-4 w-4 text-gray-400" />
                            Estado del Producto
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-1.5 border-b dark:border-gray-700">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Stock</span>
                              <Badge className={getStockStatusColor(calculatedStockStatus)}>
                                {getStockStatusLabel(calculatedStockStatus)}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b dark:border-gray-700">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Activo</span>
                              <Badge variant={product.is_active ? "default" : "secondary"}>
                                {product.is_active ? 'Sí' : 'No'}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center py-1.5">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Destacado</span>
                              <Badge variant={product.featured ? "default" : "secondary"}>
                                {product.featured ? 'Sí' : 'No'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* ── Right Column ────────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Price & Stock Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <GSIcon className="h-5 w-5" />
                    Información de Precios
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Sale price */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Precio de Venta</label>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">{formatCurrency(product.sale_price)}</p>
                  </div>

                  {/* Offer price */}
                  {product.has_offer && product.offer_price != null && product.offer_price > 0 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" />
                          Precio en Oferta
                        </label>
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs">
                          Activa
                        </Badge>
                      </div>
                      <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">{formatCurrency(product.offer_price)}</p>
                      {product.sale_price > 0 && (
                        <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">
                          Descuento: {(((product.sale_price - product.offer_price) / product.sale_price) * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  )}

                  {/* Purchase price */}
                  {canViewCost && product.purchase_price != null && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Precio de Costo</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{formatCurrency(product.purchase_price)}</p>
                    </div>
                  )}

                  <Separator className="dark:bg-gray-700" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado de Stock</span>
                    <Badge className={getStockStatusColor(calculatedStockStatus)}>
                      {getStockStatusLabel(calculatedStockStatus)}
                    </Badge>
                  </div>

                  {/* Cuotas / financiación */}
                  {product.installments_enabled &&
                    Array.isArray(product.installments_plans) &&
                    product.installments_plans.length > 0 && (
                      <>
                        <Separator className="dark:bg-gray-700" />
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
                              <CreditCard className="h-4 w-4" />
                              Cuotas
                            </span>
                            <Badge className={
                              product.installments_public
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }>
                              {product.installments_public ? 'Visible en web' : 'Oculto en web'}
                            </Badge>
                          </div>
                          <ul className="space-y-1.5">
                            {[...product.installments_plans]
                              .filter((plan) => plan && plan.count >= 1)
                              .sort((a, b) => a.count - b.count)
                              .map((plan) => {
                                const built = buildCreditInstallmentPlan({
                                  principalAmount: product.sale_price,
                                  interestRate: plan.rate ?? 0,
                                  installmentCount: plan.count,
                                  frequency: 'monthly',
                                })
                                return (
                                  <li
                                    key={plan.count}
                                    className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40"
                                  >
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {plan.count}x{' '}
                                      <strong>{formatCurrency(built.installments[0]?.amount ?? 0)}</strong>
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {plan.rate > 0 ? `+${plan.rate}%` : 'sin interés'}
                                    </span>
                                  </li>
                                )
                              })}
                          </ul>
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <Zap className="h-5 w-5" />
                    Acciones Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Producto
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setActiveTab('inventory')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Ver Inventario
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard/reports/products')}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Reportes
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleShare}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Compartir Enlace
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Product Metadata */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <Clock className="h-5 w-5" />
                    Información del Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Creado</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{formatDate(product.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Última Actualización</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{formatDate(product.updated_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">ID del Producto</label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500 font-mono dark:text-gray-400 break-all">{product.id}</p>
                      <Button variant="ghost" size="sm" onClick={handleCopyId} className="h-6 px-2 flex-shrink-0">
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* ── Modals ────────────────────────────────────────────────────────── */}

        {editModalOpen && (
          <ProductModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            product={product ? ({ ...product, images: product.images ?? [] } as unknown as import('@/types/products').Product) : null}
            categories={normalizedCategories as any[]}
            brands={normalizedBrands as any[]}
            suppliers={normalizedSuppliers as any[]}
            onSave={async (data) => {
              try {
                const normalizedData = {
                  ...data,
                  category_id: data.category_id || null,
                  brand_id: data.brand_id || null,
                  supplier_id: data.supplier_id || null,
                  brand: data.brand?.trim() ? data.brand.trim() : null,
                  description: data.description?.trim() ? data.description.trim() : null,
                  barcode: data.barcode?.trim() ? data.barcode.trim() : null,
                  unit_measure: data.unit_measure?.trim() ? data.unit_measure.trim() : 'unidad',
                  wholesale_price: (data.wholesale_price ?? 0) > 0 ? data.wholesale_price : null,
                  has_offer: Boolean(data.has_offer),
                  offer_price: data.has_offer && (data.offer_price ?? 0) > 0 ? data.offer_price : null,
                  images: Array.isArray(data.images) ? data.images.filter(Boolean) : []
                }
                const result = await updateProduct(product.id, normalizedData as any)
                if (result.success) {
                  await loadProduct()
                  setEditModalOpen(false)
                } else {
                  throw new Error(result.error || 'Error al actualizar el producto')
                }
              } catch (error: any) {
                throw error
              }
            }}
          />
        )}

        {/* Delete Confirmation */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Eliminar Producto</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                ¿Estás seguro de que quieres eliminar &quot;{product.name}&quot;?
                Todos los datos relacionados se perderán permanentemente.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Eliminar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
