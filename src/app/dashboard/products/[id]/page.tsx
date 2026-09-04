'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from '@/components/ui/motion'
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
  Layers3,
  Activity,
  Info,
  Building2,
  Barcode,
  Star,
  Globe,
  EyeOff,
  CheckCircle2,
  Boxes,
  ShieldCheck,
  Percent,
  Search,
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  RefreshCw,
  X,
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
import { toast } from 'sonner'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import type { Product } from '@/types/product-unified'
import { ProductModal } from '@/components/dashboard/product-modal'
import { resolveProductImageUrl } from '@/lib/images'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

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

export interface NormalizedVariant {
  id: string
  name: string
  sku: string
  barcode?: string
  salePrice: number
  purchasePrice?: number
  wholesalePrice?: number
  stockQuantity: number
  minStock?: number
  isActive: boolean
  attributes: Record<string, string>
}

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
  const [copiedSku, setCopiedSku] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([])

  // State for variants management & interactive viewer
  const [variantSearch, setVariantSearch] = useState('')
  const [variantStockFilter, setVariantStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [variantViewMode, setVariantViewMode] = useState<'table' | 'cards'>('table')
  const [copiedVariantSku, setCopiedVariantSku] = useState<string | null>(null)
  const [copiedVariantBarcode, setCopiedVariantBarcode] = useState<string | null>(null)

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
          supplier:suppliers(id, name, contact_name, phone, address, email),
          variants:product_variants(*)
        `)
        .eq('id', productId)
        .single()

      if (error) throw error
      setProduct(data as unknown as ProductWithInstallments)
    } catch (e) {
      logger.error('Error loading product', { error: e })
      toast.error("No se pudo cargar el producto", {
        description: "Intenta nuevamente."
      })
    } finally {
      setLoadingProduct(false)
    }
  }, [productId])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  useEffect(() => {
    if (!loadingProduct && !product) {
      toast.error("Producto no encontrado", {
        description: "El producto que buscas no existe o fue eliminado."
      })
      router.push('/dashboard/products')
    }
  }, [product, loadingProduct, router])

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

  // ─── Normalized lists for edit modal ───────────────────────────────────────

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

  // ─── Variants Processing ───────────────────────────────────────────────────

  const normalizedVariants: NormalizedVariant[] = useMemo(() => {
    if (!product) return []
    const rawVariants = Array.isArray((product as any).variants) ? (product as any).variants : []
    return rawVariants.map((v: any, index: number) => {
      let attributes: Record<string, string> = {}
      if (v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes)) {
        for (const [k, val] of Object.entries(v.attributes)) {
          if (val !== undefined && val !== null) attributes[k] = String(val)
        }
      } else if (Array.isArray(v.attributes)) {
        for (const item of v.attributes) {
          if (item && typeof item === 'object') {
            const k = item.key || item.attribute_name || item.name || `attr_${index}`
            const val = item.value || item.display_value || ''
            if (k && val) attributes[String(k)] = String(val)
          }
        }
      }

      const name = v.variant_name || v.name || Object.values(attributes).join(' / ') || `Variante ${index + 1}`
      const salePrice = Number(v.sale_price ?? v.salePrice ?? product.sale_price ?? 0)
      const purchasePrice = v.purchase_price ?? v.purchasePrice ?? v.cost_price ?? null
      const wholesalePrice = v.wholesale_price ?? v.wholesalePrice ?? null
      const stockQuantity = Number(v.stock_quantity ?? v.stock ?? 0)
      const minStock = v.min_stock != null ? Number(v.min_stock) : undefined
      const sku = String(v.sku || `${product.sku || 'PROD'}-V${index + 1}`)
      const barcode = v.barcode || v.ean || undefined
      const isActive = v.is_active !== undefined ? Boolean(v.is_active) : (v.active !== undefined ? Boolean(v.active) : true)

      return {
        id: String(v.id || `v-${index}`),
        name,
        sku,
        barcode,
        salePrice,
        purchasePrice: purchasePrice !== null ? Number(purchasePrice) : undefined,
        wholesalePrice: wholesalePrice !== null ? Number(wholesalePrice) : undefined,
        stockQuantity,
        minStock,
        isActive,
        attributes
      }
    })
  }, [product])

  const hasVariants = normalizedVariants.length > 0 || Boolean(product?.has_variants)

  const variantStats = useMemo(() => {
    const count = normalizedVariants.length
    const totalStock = normalizedVariants.reduce((sum, v) => sum + v.stockQuantity, 0)
    const outOfStockCount = normalizedVariants.filter(v => v.stockQuantity <= 0).length
    const lowStockCount = normalizedVariants.filter(v => v.stockQuantity > 0 && v.stockQuantity <= (v.minStock ?? 0)).length
    const inStockCount = normalizedVariants.filter(v => v.stockQuantity > (v.minStock ?? 0)).length
    const activeCount = normalizedVariants.filter(v => v.isActive).length
    const totalValuation = normalizedVariants.reduce((sum, v) => sum + (v.stockQuantity * v.salePrice), 0)
    
    const prices = normalizedVariants.map(v => v.salePrice).filter(p => p > 0)
    const minPrice = prices.length ? Math.min(...prices) : (product?.sale_price ?? 0)
    const maxPrice = prices.length ? Math.max(...prices) : (product?.sale_price ?? 0)
    const hasPriceRange = maxPrice > minPrice

    // Extract unique attribute keys & their possible values
    const attributeMap: Record<string, Set<string>> = {}
    normalizedVariants.forEach(v => {
      Object.entries(v.attributes).forEach(([k, val]) => {
        if (!attributeMap[k]) attributeMap[k] = new Set()
        attributeMap[k].add(val)
      })
    })

    return {
      count,
      totalStock,
      outOfStockCount,
      lowStockCount,
      inStockCount,
      activeCount,
      totalValuation,
      minPrice,
      maxPrice,
      hasPriceRange,
      attributeMap: Object.fromEntries(
        Object.entries(attributeMap).map(([k, set]) => [k, Array.from(set)])
      )
    }
  }, [normalizedVariants, product?.sale_price])

  const filteredVariants = useMemo(() => {
    return normalizedVariants.filter(v => {
      // Search filter
      if (variantSearch.trim()) {
        const q = variantSearch.toLowerCase().trim()
        const matchesName = v.name.toLowerCase().includes(q)
        const matchesSku = v.sku.toLowerCase().includes(q)
        const matchesBarcode = v.barcode ? v.barcode.toLowerCase().includes(q) : false
        const matchesAttrs = Object.entries(v.attributes).some(([k, val]) => 
          k.toLowerCase().includes(q) || val.toLowerCase().includes(q)
        )
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesAttrs) {
          return false
        }
      }
      // Stock filter
      if (variantStockFilter === 'out_of_stock') {
        if (v.stockQuantity > 0) return false
      } else if (variantStockFilter === 'low_stock') {
        if (v.stockQuantity <= 0 || v.stockQuantity > (v.minStock ?? 0)) return false
      } else if (variantStockFilter === 'in_stock') {
        if (v.stockQuantity <= (v.minStock ?? 0)) return false
      }
      return true
    })
  }, [normalizedVariants, variantSearch, variantStockFilter])

  const calculatedStockStatus = useMemo(() => {
    const stock = hasVariants && normalizedVariants.length > 0 ? variantStats.totalStock : (product?.stock_quantity ?? 0)
    const minStock = product?.min_stock ?? 0
    if (stock <= 0) return 'out_of_stock'
    if (stock <= Math.max(minStock, 0)) return 'low_stock'
    return 'in_stock'
  }, [hasVariants, normalizedVariants.length, variantStats.totalStock, product?.stock_quantity, product?.min_stock])

  const stockProgressValue = useMemo(() => {
    const stock = hasVariants && normalizedVariants.length > 0 ? variantStats.totalStock : (product?.stock_quantity ?? 0)
    const min = product?.min_stock ?? 0
    const max = product?.max_stock ?? 0
    if (max > min) {
      return Math.min(100, Math.max(0, ((stock - min) / (max - min)) * 100))
    }
    const reference = Math.max(min * 2, 10)
    return Math.min(100, (stock / reference) * 100)
  }, [hasVariants, normalizedVariants.length, variantStats.totalStock, product?.stock_quantity, product?.min_stock, product?.max_stock])

  // Margin calculation
  const marginPercentage = useMemo(() => {
    if (!product || !product.purchase_price || product.purchase_price <= 0 || product.sale_price <= 0) return null
    return (((product.sale_price - product.purchase_price) / product.sale_price) * 100)
  }, [product])

  const marginAmount = useMemo(() => {
    if (!product || !product.purchase_price) return 0
    return Math.max(0, product.sale_price - product.purchase_price)
  }, [product])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleEdit = () => setEditModalOpen(true)

  const handleDelete = async () => {
    if (!product) return
    try {
      const result = await deleteProduct(product.id)
      if (!result.success) throw new Error(result.error || 'No se pudo eliminar el producto.')
      toast.success("Producto eliminado", { description: "El producto se eliminó exitosamente." })
      router.push('/dashboard/products')
    } catch (error) {
      logger.error('Error deleting product from detail page', { error, productId: product.id })
      toast.error("No se pudo eliminar el producto", { description: "Intenta nuevamente." })
    }
  }

  const handleCopySku = () => {
    if (!product?.sku) return
    navigator.clipboard.writeText(product.sku)
    setCopiedSku(true)
    setTimeout(() => setCopiedSku(false), 2000)
    toast.success("SKU copiado", { description: "El SKU se copió al portapapeles." })
  }

  const handleCopyVariantSku = (sku: string) => {
    if (!sku) return
    navigator.clipboard.writeText(sku)
    setCopiedVariantSku(sku)
    setTimeout(() => setCopiedVariantSku(null), 2000)
    toast.success("SKU de variante copiado", { description: `${sku} copiado al portapapeles.` })
  }

  const handleCopyVariantBarcode = (barcode: string) => {
    if (!barcode) return
    navigator.clipboard.writeText(barcode)
    setCopiedVariantBarcode(barcode)
    setTimeout(() => setCopiedVariantBarcode(null), 2000)
    toast.success("Código de variante copiado", { description: `${barcode} copiado al portapapeles.` })
  }

  const handleCopyId = () => {
    if (!product?.id) return
    navigator.clipboard.writeText(product.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
    toast.success("ID copiado", { description: "El ID del producto se copió al portapapeles." })
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast.success("Enlace copiado", { description: "El enlace del producto se copió al portapapeles." })
  }

  const handleCopyBarcode = () => {
    if (!normalizedBarcode) return
    navigator.clipboard.writeText(normalizedBarcode)
    toast.success("Código copiado", { description: "El código de barras se copió al portapapeles." })
  }

  const handleSearchBarcode = () => {
    if (!normalizedBarcode) return
    window.open(`https://www.google.com/search?q=${encodeURIComponent(normalizedBarcode)}`, '_blank', 'noopener,noreferrer')
  }

  // ─── Formatting helpers ────────────────────────────────────────────────────

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(amount)
    return `Gs. ${formatted}`
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-PY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return {
          label: 'En Stock',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
          dotClass: 'bg-emerald-500',
        }
      case 'low_stock':
        return {
          label: 'Stock Bajo',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
          dotClass: 'bg-amber-500 animate-pulse',
        }
      case 'out_of_stock':
        return {
          label: 'Agotado',
          badgeClass: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
          dotClass: 'bg-red-500',
        }
      default:
        return {
          label: 'Desconocido',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
          dotClass: 'bg-slate-400',
        }
    }
  }

  const getPriceChangeBadge = (entry: PriceHistoryEntry) => {
    const diff = entry.new_price - entry.old_price
    if (diff > 0) return { label: `+${formatCurrency(diff)}`, className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300', icon: TrendingUp }
    if (diff < 0) return { label: formatCurrency(diff), className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300', icon: TrendingDown }
    return { label: 'Sin cambio', className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400', icon: Minus }
  }

  const getPriceTypeLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'Costo / Compra'
      case 'sale': return 'Precio de Venta'
      case 'wholesale': return 'Precio Mayorista'
      default: return type
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-96 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) return null

  const stockBadge = getStockStatusBadge(calculatedStockStatus)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-3.5 sm:p-6 lg:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Breadcrumbs & Back ────────────────────────────────────────── */}
        <motion.nav
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </button>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              type="button"
              onClick={() => router.push('/dashboard/products')}
              className="hover:text-foreground transition-colors font-medium"
            >
              Productos
            </button>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-foreground font-semibold truncate max-w-[220px]">
              {product.name}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/products')}
            className="h-7.5 px-2.5 text-xs font-semibold rounded-lg gap-1.5 shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Productos
          </Button>
        </motion.nav>

        {/* ── Header Hero Card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm backdrop-blur-md"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Title, SKU, and Tags */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {product.brand && (
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    {product.brand}
                  </Badge>
                )}
                {product.category?.name && (
                  <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 rounded-md gap-1">
                    <Tag className="h-3 w-3 text-blue-500" />
                    {product.category.name}
                  </Badge>
                )}
                <Badge variant="outline" className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-md gap-1.5 border shadow-xs', stockBadge.badgeClass)}>
                  <span className={cn('h-2 w-2 rounded-full', stockBadge.dotClass)} />
                  {stockBadge.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-semibold px-2.5 py-0.5 rounded-md gap-1',
                    product.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {product.is_active ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <EyeOff className="h-3 w-3 text-slate-400" />}
                  {product.is_active ? 'Activo en Catálogo' : 'Inactivo'}
                </Badge>
                {product.featured && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-xs px-2 py-0.5 text-xs font-bold gap-1">
                    <Star className="h-3 w-3 fill-white" /> Destacado
                  </Badge>
                )}
                {hasVariants && (
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-md gap-1.5 bg-pink-50 text-pink-700 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800 shadow-xs">
                    <Layers3 className="h-3 w-3 text-pink-600 dark:text-pink-400" />
                    {normalizedVariants.length > 0 ? `${normalizedVariants.length} Variantes Registradas` : 'Con Variantes'}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 font-sans font-medium">SKU:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{product.sku}</span>
                  <button
                    type="button"
                    onClick={handleCopySku}
                    className="p-1 hover:text-foreground rounded transition-colors"
                    title="Copiar SKU"
                  >
                    {copiedSku ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>

                {normalizedBarcode && (
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <Barcode className="h-3.5 w-3.5 text-slate-500" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">{normalizedBarcode}</span>
                    <button
                      type="button"
                      onClick={handleCopyBarcode}
                      className="p-1 hover:text-foreground rounded transition-colors"
                      title="Copiar código de barras"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 text-[11px] font-sans">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span>Actualizado: {formatDate(product.updated_at)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="h-9 px-3 text-xs font-semibold rounded-xl gap-1.5 shadow-xs"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleEdit}
                className="h-9 px-4 text-xs font-semibold rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                <Edit className="h-3.5 w-3.5" />
                Editar Producto
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="h-9 px-3 text-xs font-semibold rounded-xl gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Top Metrics Ribbon (4 Cards) ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Precio de Venta */}
          <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-blue-50/70 to-indigo-50/30 dark:from-slate-900 dark:to-blue-950/20 shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Precio de Venta
                </span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                  {hasVariants && variantStats.hasPriceRange
                    ? `${formatCurrency(variantStats.minPrice)} – ${formatCurrency(variantStats.maxPrice)}`
                    : formatCurrency(product.sale_price)}
                </span>
              </div>
              {hasVariants && variantStats.hasPriceRange ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Rango variable según la variante
                </p>
              ) : product.has_offer && product.offer_price ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  <Tag className="h-3 w-3" />
                  <span>Oferta: {formatCurrency(product.offer_price)}</span>
                </div>
              ) : product.wholesale_price ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Mayorista: {formatCurrency(product.wholesale_price)}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Precio unitario de lista
                </p>
              )}
            </CardContent>
          </Card>

          {/* 2. Nivel de Stock */}
          <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-emerald-50/70 to-teal-50/30 dark:from-slate-900 dark:to-emerald-950/20 shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Stock Disponible
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                  {hasVariants && normalizedVariants.length > 0 ? variantStats.totalStock : product.stock_quantity}{' '}
                  <span className="text-xs font-medium text-muted-foreground">{product.unit_measure || 'unidades'}</span>
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                  {hasVariants && normalizedVariants.length > 0 ? (
                    <>
                      <span>{normalizedVariants.length} variantes</span>
                      <span>{variantStats.outOfStockCount > 0 ? `${variantStats.outOfStockCount} agotadas` : '100% en stock'}</span>
                    </>
                  ) : (
                    <>
                      <span>Mín: {product.min_stock ?? 0}</span>
                      <span>Máx: {product.max_stock ?? '—'}</span>
                    </>
                  )}
                </div>
                <Progress value={stockProgressValue} className="h-1.5 bg-slate-200 dark:bg-slate-800" />
              </div>
            </CardContent>
          </Card>

          {/* 3. Margen & Rentabilidad */}
          {canViewCost ? (
            <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-amber-50/70 to-yellow-50/30 dark:from-slate-900 dark:to-amber-950/20 shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Margen / Rentabilidad
                  </span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Percent className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                    {marginPercentage !== null ? `${marginPercentage.toFixed(1)}%` : '—'}
                  </span>
                  {marginAmount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-semibold bg-white/60 dark:bg-slate-800 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                      +{formatCurrency(marginAmount)}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Costo: {product.purchase_price ? formatCurrency(product.purchase_price) : 'No registrado'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50/70 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/40 shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
                    Proveedor
                  </span>
                  <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                    {product.supplier?.name || 'Sin proveedor asignado'}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                  {product.supplier?.phone || product.supplier?.address || 'Sin contacto directo'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 4. Valorización en Inventario */}
          <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-purple-50/70 to-violet-50/30 dark:from-slate-900 dark:to-purple-950/20 shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  Valorización en Stock
                </span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                  {formatCurrency(hasVariants && normalizedVariants.length > 0 ? variantStats.totalValuation : (product.stock_quantity * product.sale_price))}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {hasVariants && normalizedVariants.length > 0
                  ? `Valuación calculada de las ${normalizedVariants.length} variantes`
                  : 'Valuación a precio de venta actual'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Layout: 2 Columns ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column (Images + Tabs) ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Gallery Card */}
            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm overflow-hidden backdrop-blur-md">
              <CardContent className="p-4 sm:p-6">
                <div className="relative aspect-video sm:aspect-2/1 w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/80 dark:to-slate-900/80 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
                  {productImages && productImages[selectedImageIndex]?.url ? (
                    <Image
                      src={productImages[selectedImageIndex].url}
                      alt={product.name}
                      fill
                      priority
                      className="object-contain p-2 rounded-2xl transition-all duration-300 hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 800px"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <ImageIcon className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-400">Sin imagen registrada</p>
                    </div>
                  )}

                  {productImages.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full shadow-lg">
                      {selectedImageIndex + 1} / {productImages.length}
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {productImages.length > 1 && (
                  <div className="flex items-center gap-2.5 overflow-x-auto pt-4 pb-1">
                    {productImages.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={cn(
                          'relative flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all bg-slate-50 dark:bg-slate-800',
                          selectedImageIndex === index
                            ? 'border-blue-500 ring-2 ring-blue-300/50 dark:ring-blue-800/60 scale-105 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                        )}
                      >
                        <Image
                          src={image.url}
                          alt={image.alt}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Product Information Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className={cn(
                'grid w-full p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80',
                hasVariants ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
              )}>
                <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs font-semibold rounded-xl py-2">
                  <Info className="h-3.5 w-3.5" />
                  <span>Resumen</span>
                </TabsTrigger>
                {hasVariants && (
                  <TabsTrigger value="variants" className="flex items-center gap-1.5 text-xs font-semibold rounded-xl py-2">
                    <Layers3 className="h-3.5 w-3.5 text-pink-500" />
                    <span>Variantes</span>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 rounded-md bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300">
                      {normalizedVariants.length}
                    </Badge>
                  </TabsTrigger>
                )}
                <TabsTrigger value="inventory" className="flex items-center gap-1.5 text-xs font-semibold rounded-xl py-2">
                  <Boxes className="h-3.5 w-3.5" />
                  <span>Inventario</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs font-semibold rounded-xl py-2">
                  <History className="h-3.5 w-3.5" />
                  <span>Historial</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs font-semibold rounded-xl py-2">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Métricas</span>
                </TabsTrigger>
              </TabsList>

              {/* ── Tab 1: Resumen ──────────────────────────────────────── */}
              <TabsContent value="overview" className="space-y-4">
                <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <Package className="h-4 w-4 text-blue-500" />
                      Ficha Técnica y Descripción
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6 space-y-6">
                    {/* Description */}
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Descripción del Producto
                      </span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {product.description || 'Este producto no cuenta con una descripción detallada en el sistema.'}
                      </p>
                    </div>

                    {/* Specifications Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Marca
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {product.brand || 'No especificada'}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Categoría
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {product.category?.name || 'Sin categoría'}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Proveedor Oficial
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {product.supplier?.name || 'Sin proveedor asignado'}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Unidad de Medida
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block capitalize">
                          {product.unit_measure || 'Unidad'}
                        </span>
                      </div>
                    </div>

                    {/* Barcode Section */}
                    <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Barcode className="h-4 w-4 text-slate-500" />
                          Código de Barras / EAN
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                          {normalizedBarcode || 'Sin código de barras registrado'}
                        </span>
                      </div>
                      {normalizedBarcode && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyBarcode}
                            className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSearchBarcode}
                            className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Buscar en Google
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Variant Attributes & Options Preview */}
                {hasVariants && normalizedVariants.length > 0 && (
                  <Card className="rounded-3xl border border-pink-200/80 dark:border-pink-900/40 bg-gradient-to-br from-pink-50/50 via-white to-rose-50/30 dark:from-pink-950/20 dark:via-slate-900 dark:to-slate-900/80 shadow-sm backdrop-blur-md">
                    <CardHeader className="pb-3 border-b border-pink-100 dark:border-pink-900/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-pink-950 dark:text-pink-100">
                          <Layers3 className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                          Variantes y Atributos ({normalizedVariants.length} combinaciones)
                        </CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('variants')}
                          className="h-7 px-2.5 text-xs font-semibold text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/40 rounded-lg gap-1"
                        >
                          <span>Ver detalle completo</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 sm:p-6 space-y-4">
                      {/* Attribute Pills */}
                      {Object.keys(variantStats.attributeMap).length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-300">
                            Atributos Configurados:
                          </span>
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(variantStats.attributeMap).map(([attrName, values]) => (
                              <div key={attrName} className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-pink-200/60 dark:border-pink-900/40 text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300 mr-2">{attrName}:</span>
                                <div className="inline-flex flex-wrap gap-1 mt-0.5">
                                  {values.map(val => (
                                    <Badge key={val} variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-pink-100/70 dark:bg-pink-900/40 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-800">
                                      {val}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick Variant Preview Table */}
                      <div className="rounded-xl border border-pink-200/60 dark:border-pink-900/30 overflow-hidden bg-white/60 dark:bg-slate-900/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-pink-100/50 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 font-semibold border-b border-pink-200/50 dark:border-pink-900/30">
                            <tr>
                              <th className="py-2 px-3">Variante</th>
                              <th className="py-2 px-3">SKU</th>
                              <th className="py-2 px-3 text-right">Precio Venta</th>
                              <th className="py-2 px-3 text-center">Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-pink-100 dark:divide-slate-800/60">
                            {normalizedVariants.slice(0, 4).map((v) => {
                              const isOutOfStock = v.stockQuantity <= 0
                              const isLow = !isOutOfStock && v.stockQuantity <= (v.minStock ?? 0)
                              return (
                                <tr key={v.id} className="hover:bg-pink-50/30 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                                    {v.name}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                                    {v.sku}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(v.salePrice)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[10px] font-mono px-2 py-0.5 rounded-md font-bold',
                                        isOutOfStock
                                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                                          : isLow
                                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      )}
                                    >
                                      {v.stockQuantity} un
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {normalizedVariants.length > 4 && (
                        <div className="text-center pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('variants')}
                            className="text-xs h-8 rounded-xl font-semibold border-pink-300 dark:border-pink-800 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/40"
                          >
                            Ver todas las {normalizedVariants.length} variantes en la pestaña dedicada
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Installments & Financing Card if configured */}
                {product.installments_enabled &&
                  Array.isArray(product.installments_plans) &&
                  product.installments_plans.length > 0 && (
                    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            <CreditCard className="h-4 w-4 text-indigo-500" />
                            Planes de Cuotas y Financiación
                          </CardTitle>
                          <Badge variant="outline" className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-md',
                            product.installments_public
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          )}>
                            {product.installments_public ? 'Visible en Tienda Web' : 'Uso Interno'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                              const installmentAmount = built.installments[0]?.amount ?? 0
                              return (
                                <div
                                  key={plan.count}
                                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                      {plan.count} Cuotas
                                    </span>
                                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                                      {plan.rate > 0 ? `+${plan.rate}%` : 'Sin interés'}
                                    </Badge>
                                  </div>
                                  <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(installmentAmount)}
                                    <span className="text-[11px] font-normal text-muted-foreground ml-1">/mes</span>
                                  </p>
                                </div>
                              )
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </TabsContent>

              {/* ── Tab: Variantes & Combinaciones ─────────────────────── */}
              {hasVariants && (
                <TabsContent value="variants" className="space-y-4">
                  {/* Hero Summary Cards for Variants */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl border border-pink-200/80 dark:border-pink-900/40 bg-pink-50/50 dark:bg-pink-950/20">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-300 block">
                        Total Variantes
                      </span>
                      <p className="text-2xl font-black text-pink-950 dark:text-pink-100 mt-1">
                        {variantStats.count}
                      </p>
                      <p className="text-[11px] text-pink-600 dark:text-pink-400 mt-0.5">
                        {variantStats.activeCount} activas
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                        Stock en Variantes
                      </span>
                      <p className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
                        {variantStats.totalStock}{' '}
                        <span className="text-xs font-normal text-muted-foreground">{product.unit_measure || 'un.'}</span>
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {variantStats.outOfStockCount > 0 ? `${variantStats.outOfStockCount} sin stock` : 'Todas en stock'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                        Rango de Precios
                      </span>
                      <p className="text-lg font-black text-blue-950 dark:text-blue-100 mt-1 truncate">
                        {variantStats.hasPriceRange
                          ? `${formatCurrency(variantStats.minPrice)} – ${formatCurrency(variantStats.maxPrice)}`
                          : formatCurrency(product.sale_price)}
                      </p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                        {variantStats.hasPriceRange ? 'Precios personalizados' : 'Precio unificado'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                        Valor Inventario
                      </span>
                      <p className="text-lg font-black text-purple-950 dark:text-purple-100 mt-1 truncate">
                        {formatCurrency(variantStats.totalValuation)}
                      </p>
                      <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                        Suma de todas las variantes
                      </p>
                    </div>
                  </div>

                  {/* Main Variants Card */}
                  <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            <Layers3 className="h-4 w-4 text-pink-500" />
                            Listado y Existencias de Variantes
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Consulta el inventario, SKU, precios y códigos de barras de cada combinación.
                          </p>
                        </div>

                        {/* View toggle */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <Button
                            type="button"
                            variant={variantViewMode === 'table' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setVariantViewMode('table')}
                            className="h-8 px-2.5 text-xs rounded-lg gap-1"
                          >
                            <List className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Tabla</span>
                          </Button>
                          <Button
                            type="button"
                            variant={variantViewMode === 'cards' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setVariantViewMode('cards')}
                            className="h-8 px-2.5 text-xs rounded-lg gap-1"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Tarjetas</span>
                          </Button>
                        </div>
                      </div>

                      {/* Search & Stock Filter Toolbar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={variantSearch}
                            onChange={(e) => setVariantSearch(e.target.value)}
                            placeholder="Buscar por nombre, SKU, código o atributo..."
                            className="w-full h-8.5 pl-8.5 pr-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                          {variantSearch && (
                            <button
                              type="button"
                              onClick={() => setVariantSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                          <Button
                            type="button"
                            variant={variantStockFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setVariantStockFilter('all')}
                            className="h-7.5 px-2.5 text-[11px] font-semibold rounded-lg"
                          >
                            Todas ({normalizedVariants.length})
                          </Button>
                          <Button
                            type="button"
                            variant={variantStockFilter === 'in_stock' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setVariantStockFilter('in_stock')}
                            className="h-7.5 px-2.5 text-[11px] font-semibold rounded-lg text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          >
                            En Stock ({variantStats.inStockCount})
                          </Button>
                          <Button
                            type="button"
                            variant={variantStockFilter === 'low_stock' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setVariantStockFilter('low_stock')}
                            className="h-7.5 px-2.5 text-[11px] font-semibold rounded-lg text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                          >
                            Bajo Stock ({variantStats.lowStockCount})
                          </Button>
                          <Button
                            type="button"
                            variant={variantStockFilter === 'out_of_stock' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setVariantStockFilter('out_of_stock')}
                            className="h-7.5 px-2.5 text-[11px] font-semibold rounded-lg text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                          >
                            Agotadas ({variantStats.outOfStockCount})
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      {filteredVariants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                            <Layers3 className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            No se encontraron variantes
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                            No hay variantes que coincidan con la búsqueda o filtro aplicado.
                          </p>
                          {(variantSearch || variantStockFilter !== 'all') && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setVariantSearch('')
                                setVariantStockFilter('all')
                              }}
                              className="mt-3 text-xs h-7.5 rounded-lg"
                            >
                              Restablecer filtros
                            </Button>
                          )}
                        </div>
                      ) : variantViewMode === 'table' ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                              <tr>
                                <th className="py-3 px-4">Variante / Atributos</th>
                                <th className="py-3 px-4">SKU</th>
                                <th className="py-3 px-4">Código de Barras</th>
                                <th className="py-3 px-4 text-right">Precio Venta</th>
                                {canViewCost && <th className="py-3 px-4 text-right">Costo Base</th>}
                                <th className="py-3 px-4 text-center">Stock Actual</th>
                                <th className="py-3 px-4 text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {filteredVariants.map((variant) => {
                                const isOutOfStock = variant.stockQuantity <= 0
                                const isLow = !isOutOfStock && variant.stockQuantity <= (variant.minStock ?? 0)
                                const attrEntries = Object.entries(variant.attributes)
                                return (
                                  <tr
                                    key={variant.id}
                                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                  >
                                    {/* Name & Attribute Chips */}
                                    <td className="py-3.5 px-4">
                                      <div className="space-y-1">
                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                          {variant.name}
                                        </p>
                                        {attrEntries.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {attrEntries.map(([k, val]) => (
                                              <Badge
                                                key={k}
                                                variant="secondary"
                                                className="px-1.5 py-0 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                              >
                                                <span className="text-muted-foreground mr-1">{k}:</span>
                                                <span className="font-bold">{val}</span>
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    {/* SKU with Copy */}
                                    <td className="py-3.5 px-4 font-mono">
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-slate-900 dark:text-slate-100">{variant.sku}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyVariantSku(variant.sku)}
                                          className="p-1 hover:text-foreground text-slate-400 rounded transition-colors"
                                          title="Copiar SKU"
                                        >
                                          {copiedVariantSku === variant.sku ? (
                                            <Check className="h-3 w-3 text-emerald-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    </td>

                                    {/* Barcode with Copy */}
                                    <td className="py-3.5 px-4 font-mono">
                                      {variant.barcode ? (
                                        <div className="flex items-center gap-1">
                                          <Barcode className="h-3.5 w-3.5 text-slate-400" />
                                          <span className="text-slate-700 dark:text-slate-300">{variant.barcode}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyVariantBarcode(variant.barcode!)}
                                            className="p-1 hover:text-foreground text-slate-400 rounded transition-colors"
                                            title="Copiar Código"
                                          >
                                            {copiedVariantBarcode === variant.barcode ? (
                                              <Check className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>

                                    {/* Sale Price (+ wholesale) */}
                                    <td className="py-3.5 px-4 text-right">
                                      <p className="font-black text-slate-900 dark:text-slate-100 text-sm">
                                        {formatCurrency(variant.salePrice)}
                                      </p>
                                      {variant.wholesalePrice && (
                                        <p className="text-[10px] text-muted-foreground">
                                          Mayorista: {formatCurrency(variant.wholesalePrice)}
                                        </p>
                                      )}
                                      {variant.salePrice !== product.sale_price && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                          Personalizado
                                        </Badge>
                                      )}
                                    </td>

                                    {/* Cost Price */}
                                    {canViewCost && (
                                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                                        {variant.purchasePrice != null ? formatCurrency(variant.purchasePrice) : '—'}
                                      </td>
                                    )}

                                    {/* Stock Quantity + Badge */}
                                    <td className="py-3.5 px-4 text-center">
                                      <div className="inline-flex flex-col items-center gap-1">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            'text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border shadow-xs',
                                            isOutOfStock
                                              ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                              : isLow
                                              ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                          )}
                                        >
                                          {isOutOfStock ? '0 un. (Agotado)' : `${variant.stockQuantity} un.`}
                                        </Badge>
                                        {variant.minStock != null && variant.minStock > 0 && (
                                          <span className="text-[10px] text-muted-foreground">
                                            Mín: {variant.minStock} un.
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Active Status */}
                                    <td className="py-3.5 px-4 text-center">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] font-semibold px-2 py-0.5 rounded-md',
                                          variant.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                        )}
                                      >
                                        {variant.isActive ? 'Activa' : 'Inactiva'}
                                      </Badge>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        /* Cards Grid View */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 sm:p-5">
                          {filteredVariants.map((variant) => {
                            const isOutOfStock = variant.stockQuantity <= 0
                            const isLow = !isOutOfStock && variant.stockQuantity <= (variant.minStock ?? 0)
                            const attrEntries = Object.entries(variant.attributes)
                            return (
                              <div
                                key={variant.id}
                                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-all space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                      {variant.name}
                                    </h4>
                                    <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground mt-0.5">
                                      <span>SKU: {variant.sku}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyVariantSku(variant.sku)}
                                        className="p-0.5 hover:text-foreground text-slate-400"
                                      >
                                        {copiedVariantSku === variant.sku ? (
                                          <Check className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0',
                                      variant.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                    )}
                                  >
                                    {variant.isActive ? 'Activa' : 'Inactiva'}
                                  </Badge>
                                </div>

                                {attrEntries.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {attrEntries.map(([k, val]) => (
                                      <Badge
                                        key={k}
                                        variant="secondary"
                                        className="px-1.5 py-0 text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                      >
                                        <span className="text-muted-foreground mr-1">{k}:</span>
                                        <span className="font-bold">{val}</span>
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Precio</span>
                                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                                      {formatCurrency(variant.salePrice)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Stock Actual</span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs font-mono font-bold px-2 py-0.5 rounded-md mt-0.5',
                                        isOutOfStock
                                          ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300'
                                          : isLow
                                          ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      )}
                                    >
                                      {variant.stockQuantity} un.
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── Tab 2: Inventario ────────────────────────────────────── */}
              <TabsContent value="inventory" className="space-y-4">
                <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <Boxes className="h-4 w-4 text-emerald-500" />
                      Control de Existencias y Depósito
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60">
                        <Package className="h-7 w-7 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                        <p className="text-3xl font-black text-blue-900 dark:text-blue-100">
                          {hasVariants && normalizedVariants.length > 0 ? variantStats.totalStock : product.stock_quantity}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 mt-1">
                          {hasVariants && normalizedVariants.length > 0 ? 'Stock Total en Variantes' : 'Stock Actual'}
                        </p>
                      </div>

                      <div className="text-center p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60">
                        <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                        <p className="text-3xl font-black text-amber-900 dark:text-amber-100">
                          {hasVariants && normalizedVariants.length > 0 ? variantStats.lowStockCount : (product.min_stock ?? 0)}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mt-1">
                          {hasVariants && normalizedVariants.length > 0 ? 'Variantes con Bajo Stock' : 'Stock Mínimo'}
                        </p>
                      </div>

                      <div className="text-center p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                        <TrendingUp className="h-7 w-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                        <p className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
                          {hasVariants && normalizedVariants.length > 0 ? variantStats.inStockCount : (product.max_stock != null ? product.max_stock : '—')}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 mt-1">
                          {hasVariants && normalizedVariants.length > 0 ? 'Variantes con Stock OK' : 'Stock Máximo'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-300">Nivel de Cobertura de Stock</span>
                        <span className="text-slate-900 dark:text-slate-100">{Math.round(stockProgressValue)}%</span>
                      </div>
                      <Progress value={stockProgressValue} className="h-2 rounded-full" />
                      {calculatedStockStatus !== 'in_stock' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-1 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {calculatedStockStatus === 'out_of_stock'
                            ? 'Alerta: Sin stock disponible para la venta inmediata.'
                            : 'Alerta: El stock actual está por debajo del umbral mínimo configurado.'}
                        </p>
                      )}
                    </div>

                    {/* Existencias por Variante */}
                    {hasVariants && normalizedVariants.length > 0 && (
                      <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Layers3 className="h-4 w-4 text-pink-500" />
                            Distribución de Stock por Variante
                          </span>
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {variantStats.totalStock} unidades en total
                          </span>
                        </div>
                        <div className="space-y-2.5 pt-1">
                          {normalizedVariants.map((v) => {
                            const isOutOfStock = v.stockQuantity <= 0
                            const isLow = !isOutOfStock && v.stockQuantity <= (v.minStock ?? 0)
                            const percentage = variantStats.totalStock > 0
                              ? Math.round((v.stockQuantity / variantStats.totalStock) * 100)
                              : 0
                            return (
                              <div key={v.id} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {v.name} <span className="font-mono text-[11px] text-muted-foreground font-normal">({v.sku})</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                      {v.stockQuantity} un. ({percentage}%)
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[9px] px-1.5 py-0 rounded font-bold uppercase',
                                        isOutOfStock
                                          ? 'border-red-300 text-red-700 dark:text-red-300'
                                          : isLow
                                          ? 'border-amber-300 text-amber-700 dark:text-amber-300'
                                          : 'border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                      )}
                                    >
                                      {isOutOfStock ? 'Agotado' : isLow ? 'Bajo' : 'OK'}
                                    </Badge>
                                  </div>
                                </div>
                                <Progress
                                  value={percentage}
                                  className={cn(
                                    'h-1.5 rounded-full',
                                    isOutOfStock
                                      ? 'bg-red-100 dark:bg-red-950/40'
                                      : isLow
                                      ? 'bg-amber-100 dark:bg-amber-950/40'
                                      : 'bg-slate-200 dark:bg-slate-800'
                                  )}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Tab 3: Historial ─────────────────────────────────────── */}
              <TabsContent value="history" className="space-y-4">
                {/* Movimientos de Stock */}
                <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <History className="h-4 w-4 text-blue-500" />
                      Movimientos de Stock Recientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6">
                    {stockMovements.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                          <InboxIcon className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin movimientos registrados</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Las entradas, salidas y ajustes aparecerán aquí.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {stockMovements.map((movement, idx) => (
                          <motion.div
                            key={movement.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="flex items-center justify-between p-3.5 border rounded-2xl border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'p-2 rounded-xl',
                                movement.type === 'entrada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                movement.type === 'salida' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              )}>
                                {movement.type === 'entrada' ? (
                                  <Upload className="h-4 w-4" />
                                ) : movement.type === 'salida' ? (
                                  <Download className="h-4 w-4" />
                                ) : (
                                  <Edit className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 capitalize">
                                  {movement.type === 'entrada' ? 'Entrada' : movement.type === 'salida' ? 'Salida' : 'Ajuste'} de {Math.abs(movement.quantity)} unidades
                                </p>
                                {movement.reason && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{movement.reason}</p>
                                )}
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  {formatDate(movement.date)} • {movement.user}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                {movement.previousStock} → {movement.newStock}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-bold mt-1 uppercase',
                                  movement.type === 'entrada' ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300' :
                                  movement.type === 'salida' ? 'border-red-300 text-red-700 dark:text-red-300' :
                                  'border-blue-300 text-blue-700 dark:text-blue-300'
                                )}
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
                <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Historial de Cambios de Precio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6">
                    {priceHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                          <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin cambios de precio registrados</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Las actualizaciones tarifarias quedarán registradas aquí.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {priceHistory.map((ph, idx) => {
                          const badge = getPriceChangeBadge(ph)
                          const Icon = badge.icon
                          return (
                            <motion.div
                              key={ph.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="flex items-center justify-between p-3.5 border rounded-2xl border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn('p-2 rounded-xl', badge.className)}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                    {getPriceTypeLabel(ph.type)}: {formatCurrency(ph.old_price)} → {formatCurrency(ph.new_price)}
                                  </p>
                                  {ph.change_reason && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{ph.change_reason}</p>
                                  )}
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(ph.created_at)}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className={cn('text-xs font-bold font-mono', badge.className)}>
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

              {/* ── Tab 4: Métricas & Rendimiento ────────────────────────── */}
              <TabsContent value="analytics" className="space-y-4">
                <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                  <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <BarChart3 className="h-4 w-4 text-purple-500" />
                      Métricas Comerciales y Rendimiento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                          Métricas Financieras
                        </span>
                        <div className="space-y-2.5">
                          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                            <span className="text-muted-foreground">Valor Total en Stock</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.stock_quantity * product.sale_price)}</span>
                          </div>
                          {canViewCost && (
                            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                              <span className="text-muted-foreground">Ganancia Bruta por Unidad</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(marginAmount)}</span>
                            </div>
                          )}
                          {canViewCost && (
                            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                              <span className="text-muted-foreground">Margen de Rentabilidad</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {marginPercentage !== null ? `${marginPercentage.toFixed(1)}%` : '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                          Estado Comercial
                        </span>
                        <div className="space-y-2.5 text-xs">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-muted-foreground">Disponibilidad en Almacén</span>
                            <Badge variant="outline" className={cn('text-xs font-semibold px-2 py-0.5', stockBadge.badgeClass)}>
                              {stockBadge.label}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-muted-foreground">Habilitado para la Venta</span>
                            <Badge variant={product.is_active ? "default" : "secondary"}>
                              {product.is_active ? 'Sí (Activo)' : 'No (Inactivo)'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-muted-foreground">Producto Destacado</span>
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
          </div>

          {/* ── Right Column (Sidebar Cards) ────────────────────────────── */}
          <div className="space-y-6">

            {/* Price & Pricing Breakdown Card */}
            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <GSIcon className="h-4 w-4 text-emerald-500" />
                  Estructura Tarifaria
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Precio de Venta al Público
                  </span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {hasVariants && variantStats.hasPriceRange
                      ? `${formatCurrency(variantStats.minPrice)} – ${formatCurrency(variantStats.maxPrice)}`
                      : formatCurrency(product.sale_price)}
                  </p>
                  {hasVariants && variantStats.hasPriceRange && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Configurado según la variante seleccionada
                    </p>
                  )}
                </div>

                {product.has_offer && product.offer_price && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        Precio de Oferta
                      </span>
                      <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Activa</Badge>
                    </div>
                    <p className="text-xl font-black text-amber-700 dark:text-amber-400">
                      {formatCurrency(product.offer_price)}
                    </p>
                    {product.sale_price > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        Ahorro del {(((product.sale_price - product.offer_price) / product.sale_price) * 100).toFixed(0)}% para el cliente
                      </p>
                    )}
                  </div>
                )}

                {product.wholesale_price && (
                  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block">
                      Precio Mayorista
                    </span>
                    <p className="text-lg font-black text-blue-700 dark:text-blue-400 mt-0.5">
                      {formatCurrency(product.wholesale_price)}
                    </p>
                  </div>
                )}

                {canViewCost && product.purchase_price != null && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Precio de Costo Base
                    </span>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {formatCurrency(product.purchase_price)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Information Card */}
            {product.supplier && (
              <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    Datos del Proveedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 space-y-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Razón Social / Nombre</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {product.supplier.name}
                    </span>
                  </div>
                  {product.supplier.contact_name && (
                    <div>
                      <span className="text-muted-foreground block">Contacto Principal</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                        {product.supplier.contact_name}
                      </span>
                    </div>
                  )}
                  {product.supplier.phone && (
                    <div>
                      <span className="text-muted-foreground block">Teléfono</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                        {product.supplier.phone}
                      </span>
                    </div>
                  )}
                  {product.supplier.address && (
                    <div>
                      <span className="text-muted-foreground block">Dirección</span>
                      <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                        {product.supplier.address}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions Card */}
            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Acciones Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-2.5">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleEdit}
                  className="w-full h-9 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar Datos del Producto
                </Button>
                {hasVariants && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActiveTab('variants')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="w-full h-9 rounded-xl font-semibold text-xs gap-2 shadow-xs text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/40"
                  >
                    <Layers3 className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                    Ver Variantes ({normalizedVariants.length})
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActiveTab('inventory')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="w-full h-9 rounded-xl font-semibold text-xs gap-2 shadow-xs"
                >
                  <Package className="h-4 w-4" />
                  Consultar Inventario
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/reports/products')}
                  className="w-full h-9 rounded-xl font-semibold text-xs gap-2 shadow-xs"
                >
                  <BarChart3 className="h-4 w-4" />
                  Ver Reportes de Ventas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShare}
                  className="w-full h-9 rounded-xl font-semibold text-xs gap-2 shadow-xs"
                >
                  <Share2 className="h-4 w-4" />
                  Copiar Enlace Directo
                </Button>
              </CardContent>
            </Card>

            {/* System Info Metadata Card */}
            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Clock className="h-4 w-4 text-slate-500" />
                  Información de Registro
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Fecha de Registro</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                    {formatDate(product.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Última Modificación</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                    {formatDate(product.updated_at)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">ID Único en Base de Datos</span>
                  <div className="flex items-center gap-1.5 mt-1 bg-slate-100 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all select-all flex-1">
                      {product.id}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 hover:text-foreground rounded transition-colors shrink-0"
                      title="Copiar ID"
                    >
                      {copiedId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Modals ─────────────────────────────────────────────────── */}

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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Eliminar Producto</h3>
                  <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente <strong>&quot;{product.name}&quot;</strong>?
                Se eliminarán sus registros vinculados del catálogo.
              </p>
              <div className="flex gap-2.5 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="h-8.5 px-3.5 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="h-8.5 px-3.5 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white"
                >
                  Eliminar Producto
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
