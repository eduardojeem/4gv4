'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import AdvancedSearch from '@/components/admin/advanced-search'
import StockControl from '@/components/admin/inventory/stock-control'
import StockMovements from '@/components/admin/inventory/stock-movements'
import InventoryReports from '@/components/admin/reports/inventory-reports'
import SupplierManagement from '@/components/admin/inventory/supplier-management'
import { PromotionManager } from '@/components/admin/inventory/PromotionManager'
import { VariantManager } from '@/components/admin/inventory/VariantManager'
import { ProductModal } from '@/components/dashboard/product-modal'
import { useInventory, Product } from '@/hooks/use-inventory'
import { useBranch } from '@/contexts/branch-context'
import {
  Package,
  Plus,
  Download,
  CheckCircle,
  TrendingUp,
  Tag,
  Search,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Edit,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Info,
  Building2,
  ArrowUpRight,
  Warehouse,
  History,
  Bell,
  Truck,
  FolderTree,
  Percent,
  BarChart3,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/currency'

const operationTabs = [
  { value: 'products', label: 'Catálogo', icon: Package },
  { value: 'stock-control', label: 'Stock por sucursal', icon: Warehouse },
  { value: 'movements', label: 'Movimientos', icon: History },
  { value: 'alerts', label: 'Alertas', icon: Bell },
] as const

const managementTabs = [
  { value: 'suppliers', label: 'Proveedores', icon: Truck },
  { value: 'categories', label: 'Categorías', icon: FolderTree },
  { value: 'variants', label: 'Variantes', icon: Layers },
  { value: 'promotions', label: 'Promociones', icon: Percent },
  { value: 'reports', label: 'Reportes', icon: BarChart3 },
  { value: 'search', label: 'Búsqueda avanzada', icon: SlidersHorizontal },
] as const

interface ValidationError {
  field: string
  message: string
}

interface SearchResult {
  id: string
  name: string
  sku: string
  category: string
  supplier: string
  price: number
  stock: number
  status: string
  lastMovement: Date
}

interface AdvancedSearchFilter {
  id: string
  type: string
  value: unknown
}

export default function InventoryManagement() {
  const { selectedBranch, loading: branchLoading } = useBranch()
  const {
    products,
    categories,
    suppliers,
    loading,
    isRefreshing,
    error,
    page,
    setPage,
    pageSize,
    totalCount,
    filters,
    setFilters,
    createProduct,
    updateProduct,
    deleteProduct
  } = useInventory()

  // Estados de interfaz locales
  const [activeTab, setActiveTab] = useState('products')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estados del formulario
  const [formData, setFormData] = useState<Partial<Product>>({})
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ label: category.name, value: category.id })),
    [categories]
  )
  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id })),
    [suppliers]
  )

  const parseNumberInput = (rawValue: string, parser: (value: string) => number) => {
    const trimmed = rawValue.trim()
    if (trimmed === '') return undefined
    const parsed = parser(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  // Validaciones
  const validateProduct = (data: Partial<Product>): ValidationError[] => {
    const errors: ValidationError[] = []
    const salePrice = Number(data.sale_price)
    const purchasePrice = Number(data.purchase_price)
    const stockQuantity = Number(data.stock_quantity)

    if (!data.name?.trim()) errors.push({ field: 'name', message: 'El nombre es requerido' })
    if (!data.sku?.trim()) errors.push({ field: 'sku', message: 'El SKU es requerido' })
    if (!data.category_id) errors.push({ field: 'category_id', message: 'La categoría es requerida' })
    if (!data.supplier_id) errors.push({ field: 'supplier_id', message: 'El proveedor es requerido' })
    if (!Number.isFinite(salePrice) || salePrice <= 0) errors.push({ field: 'sale_price', message: 'Precio inválido' })
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) errors.push({ field: 'purchase_price', message: 'Costo inválido' })
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) errors.push({ field: 'stock_quantity', message: 'Stock inválido' })

    return errors
  }

  // Helpers UI
  const getStockStatus = (product: Product) => {
    if (product.stock_quantity === 0) return { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', text: 'Agotado', icon: XCircle }
    if (product.stock_quantity <= product.min_stock) return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', text: 'Bajo', icon: AlertTriangle }
    if (product.stock_quantity >= product.max_stock) return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', text: 'Alto', icon: TrendingUp }
    return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', text: 'Normal', icon: CheckCircle }
  }

  const getStatusBadge = (product: Product) => {
    const isActive = product.status === 'active'
    return isActive 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }

  // KPIs calculados sobre la página actual (idealmente deberían venir del backend para total global)
  // Nota: Para una app real grande, estos KPIs deben ser endpoints dedicados.
  const stats = useMemo(() => {
    const lowStock = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length
    const outStock = products.filter(p => p.stock_quantity === 0).length
    const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.purchase_price), 0)
    // Margen promedio simple de la vista actual
    const avgMargin = products.length ? products.reduce((sum, p) => {
      const margin = p.sale_price > 0 ? ((p.sale_price - p.purchase_price) / p.sale_price) * 100 : 0
      return sum + margin
    }, 0) / products.length : 0

    return { lowStock, outStock, totalValue, avgMargin }
  }, [products])

  // Handlers CRUD
  const handleAddProduct = async () => {
    setValidationErrors([])
    setActionError('')
    setIsSubmitting(true)
    const errors = validateProduct(formData)
    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsSubmitting(false)
      return
    }

    const result = await createProduct(formData)
    if (result.success) {
      setSuccessMessage('Producto creado correctamente')
      setIsAddDialogOpen(false)
      setFormData({})
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setActionError(result.error || 'No fue posible crear el producto')
    }
    setIsSubmitting(false)
  }

  const handleEditProduct = async () => {
    if (!selectedProduct) return
    setValidationErrors([])
    setActionError('')
    setIsSubmitting(true)

    const errors = validateProduct(formData)
    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsSubmitting(false)
      return
    }

    const result = await updateProduct(selectedProduct.id, formData)
    if (result.success) {
      setSuccessMessage('Producto actualizado')
      setIsEditDialogOpen(false)
      setSelectedProduct(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setActionError(result.error || 'No fue posible actualizar el producto')
    }
    setIsSubmitting(false)
  }

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return
    setActionError('')
    setIsSubmitting(true)
    const result = await deleteProduct(selectedProduct.id)
    if (result.success) {
      setSuccessMessage('Producto eliminado')
      setIsDeleteDialogOpen(false)
      setSelectedProduct(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setActionError(result.error || 'No fue posible eliminar el producto')
    }
    setIsSubmitting(false)
  }

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product)
    setFormData({ ...product })
    setValidationErrors([])
    setActionError('')
    setIsEditDialogOpen(true)
  }

  const getFieldError = (field: string) => validationErrors.find(e => e.field === field)?.message

  const handleAdvancedSearch = (activeFilters: AdvancedSearchFilter[]) => {
    const byId = new Map(activeFilters.map((f) => [f.id, f]))
    const search = String(byId.get('search')?.value || '').trim()
    const categoriesFilter = Array.isArray(byId.get('category')?.value) ? (byId.get('category')?.value as string[]) : []
    const suppliersFilter = Array.isArray(byId.get('supplier')?.value) ? (byId.get('supplier')?.value as string[]) : []
    const statusFilter = Array.isArray(byId.get('status')?.value) ? (byId.get('status')?.value as string[]) : []
    const priceRange = Array.isArray(byId.get('priceRange')?.value) ? (byId.get('priceRange')?.value as number[]) : null
    const stockRange = Array.isArray(byId.get('stockRange')?.value) ? (byId.get('stockRange')?.value as number[]) : null
    const dateAdded = String(byId.get('dateAdded')?.value || '')
    const lastMovement = String(byId.get('lastMovement')?.value || '')
    const hasImage = Boolean(byId.get('hasImage')?.value)
    const stockStatus = statusFilter.includes('out_of_stock')
      ? 'out'
      : statusFilter.includes('low_stock')
        ? 'low'
        : 'all'
    const productStatus = statusFilter.find((status) => ['active', 'inactive', 'discontinued'].includes(status)) || 'all'

    setSearchResults([])
    setPage(1)
    setActiveTab('products')
    setFilters(prev => ({
      ...prev,
      search,
      category: categoriesFilter[0] || 'all',
      supplier: suppliersFilter[0] || 'all',
      status: productStatus,
      stockStatus,
      minPrice: priceRange && typeof priceRange[0] === 'number' ? priceRange[0] : null,
      maxPrice: priceRange && typeof priceRange[1] === 'number' ? priceRange[1] : null,
      minStock: stockRange && typeof stockRange[0] === 'number' ? stockRange[0] : null,
      maxStock: stockRange && typeof stockRange[1] === 'number' ? stockRange[1] : null,
      hasImage,
      dateAdded,
      lastMovement,
    }))
  }

  const clearAdvancedSearch = () => {
    setSearchResults([])
    setPage(1)
    setFilters(prev => ({
      ...prev,
      search: '',
      category: 'all',
      supplier: 'all',
      status: 'all',
      stockStatus: 'all',
      minPrice: null,
      maxPrice: null,
      minStock: null,
      maxStock: null,
      hasImage: false,
      dateAdded: '',
      lastMovement: '',
    }))
  }

  const handleExportProducts = () => {
    const rows = [
      ['Nombre', 'SKU', 'Categoria', 'Proveedor', 'Precio Venta', 'Costo', 'Stock', 'Estado'],
      ...products.map((product) => [
        product.name,
        product.sku,
        product.category?.name || '',
        product.supplier?.name || '',
        String(product.sale_price),
        String(product.purchase_price),
        String(product.stock_quantity),
        product.status
      ])
    ]

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasNextPage = page * pageSize < totalCount
  const rangeStart = totalCount === 0 ? 0 : ((page - 1) * pageSize) + 1
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount)
  const hasCatalogFilters = Boolean(
    filters.search.trim() || filters.category !== 'all' || filters.stockStatus !== 'all'
  )

  const clearCatalogFilters = () => {
    setPage(1)
    setFilters((current) => ({
      ...current,
      search: '',
      category: 'all',
      stockStatus: 'all',
    }))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Mensaje de éxito */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-300">{successMessage}</AlertDescription>
        </Alert>
      )}
      {(error || actionError) && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-300">{actionError || error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Gestión de Inventario
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Catálogo, existencias y trazabilidad</span>
                <Badge variant="outline" className="max-w-full gap-1.5 rounded-md font-semibold border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <span className="truncate">
                    {branchLoading ? 'Cargando sucursal...' : `Stock: ${selectedBranch?.name || 'sin sucursal activa'}`}
                  </span>
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-9 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10">
              <Link href="/dashboard/products">
                Productos <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-9 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10">
              <Link href="/admin/branches">
                Sucursales <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleExportProducts}
              className="h-9 rounded-xl border-slate-200 bg-white text-xs dark:border-white/10 dark:bg-[#0d1117]"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar CSV
            </Button>
            <Button
              onClick={() => {
                setFormData({})
                setValidationErrors([])
                setActionError('')
                setIsAddDialogOpen(true)
              }}
              className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-sm text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Info className="h-4 w-4 text-blue-500" /> ¿Cómo funciona la Gestión de Inventario?
            </div>
            <div className="select-none text-xs font-semibold text-slate-400">
              <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
              <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
            </div>
          </summary>
          <CardContent className="pt-0 pb-4">
            <div className="grid gap-4 text-xs sm:grid-cols-3">
              <div className="space-y-1 border-l-2 border-blue-500 pl-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">1</Badge>
                  Productos y Catálogo
                </h4>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  El producto, SKU, precios y categoría forman parte del catálogo compartido entre sucursales.
                </p>
              </div>
              <div className="space-y-1 border-l-2 border-amber-500 pl-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">2</Badge>
                  Control y Alertas de Stock
                </h4>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  Las existencias corresponden a la sucursal activa seleccionada en la cabecera.
                </p>
              </div>
              <div className="space-y-1 border-l-2 border-emerald-500 pl-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">3</Badge>
                  Movimientos e Historial
                </h4>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  Usa ajustes o transferencias para modificar stock de forma auditada.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Total de productos', value: totalCount.toLocaleString(), icon: Package, tone: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
          { label: 'Stock bajo (Lote)', value: stats.lowStock.toLocaleString(), icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
          { label: 'Valor del Lote (Costo)', value: formatCurrency(stats.totalValue), icon: GSIcon, tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20' },
          { label: 'Margen Promedio', value: `${stats.avgMargin.toFixed(1)}%`, icon: TrendingUp, tone: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/20' },
        ].map(({ label, value, icon: Icon, tone, bg }) => (
          <Card key={label} className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
                <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${tone}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 space-y-5">
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="h-11 w-full rounded-lg border-border bg-card px-3 shadow-sm" aria-label="Seleccionar sección de inventario">
              <SelectValue placeholder="Seleccionar sección" />
            </SelectTrigger>
            <SelectContent className="max-h-[70vh]">
              <SelectGroup>
                <SelectLabel className="font-semibold uppercase">Operación</SelectLabel>
                {operationTabs.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="font-semibold uppercase">Gestión</SelectLabel>
                {managementTabs.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <aside className="hidden min-w-0 lg:block">
          <nav className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0d1117]" aria-label="Secciones de inventario">
            <div className="mb-3 border-b border-slate-100 dark:border-white/5 px-2 pb-3">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Secciones</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Navegación de inventario</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Operación</p>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 bg-transparent p-0 xl:grid-cols-4">
                  {operationTabs.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-10 min-w-0 justify-center gap-2 rounded-md border border-transparent px-2.5 text-xs font-semibold text-slate-600 shadow-none transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:border-blue-500 dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="border-t border-slate-100 dark:border-white/5 pt-3">
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Gestión</p>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 bg-transparent p-0 xl:grid-cols-3 2xl:grid-cols-6">
                  {managementTabs.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-10 min-w-0 justify-center gap-2 rounded-md border border-transparent px-2.5 text-xs font-semibold text-slate-600 shadow-none transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:border-blue-500 dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
          </nav>
        </aside>

        <div className="min-w-0">

        <TabsContent value="products" className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]" aria-labelledby="catalog-title">
            <div className="border-b border-slate-100 dark:border-white/5 p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 id="catalog-title" className="font-bold text-slate-900 dark:text-white">Catálogo de productos</h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Precios y datos compartidos; stock correspondiente a <span className="font-semibold">{selectedBranch?.name || 'la sucursal activa'}</span>.
                  </p>
                </div>
                <div className="flex min-h-8 items-center gap-2 self-start sm:self-auto">
                  {isRefreshing && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Actualizando
                    </span>
                  )}
                  {hasCatalogFilters && (
                    <Button variant="ghost" size="sm" onClick={clearCatalogFilters} className="h-8 rounded-xl text-xs text-slate-500 hover:text-slate-900">
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Buscar por nombre, SKU o descripción..."
                    className="pl-9 h-9 text-xs rounded-xl border-slate-200 dark:border-white/10 dark:bg-[#161b22] dark:text-white"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <Select value={filters.category} onValueChange={(val) => setFilters(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-xl border-slate-200 dark:border-white/10 dark:bg-[#161b22] dark:text-white">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.stockStatus} onValueChange={(val) => setFilters(prev => ({ ...prev, stockStatus: val }))}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-xl border-slate-200 dark:border-white/10 dark:bg-[#161b22] dark:text-white">
                    <SelectValue placeholder="Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los stocks</SelectItem>
                    <SelectItem value="low">Stock bajo</SelectItem>
                    <SelectItem value="out">Agotado</SelectItem>
                    <SelectItem value="normal">Stock normal</SelectItem>
                    <SelectItem value="high">Stock alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                  <tr>
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Producto</th>
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">SKU</th>
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Categoría</th>
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Precio / Costo</th>
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock</th>
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Estado</th>
                    <th className="p-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-500" />
                        Cargando catálogo...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <EmptyState
                          icon={Package}
                          title={hasCatalogFilters ? 'No hay resultados' : 'Todavía no hay productos'}
                          description={hasCatalogFilters
                            ? 'Prueba con otros términos o elimina los filtros aplicados.'
                            : 'Crea el primer producto para comenzar a controlar existencias.'}
                          action={hasCatalogFilters
                            ? { label: 'Limpiar filtros', onClick: clearCatalogFilters, icon: RotateCcw }
                            : {
                                label: 'Nuevo producto',
                                onClick: () => {
                                  setFormData({})
                                  setValidationErrors([])
                                  setActionError('')
                                  setIsAddDialogOpen(true)
                                },
                                icon: Plus,
                              }}
                          className="py-14"
                        />
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const stockInfo = getStockStatus(product)
                      return (
                        <tr key={product.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                          <td className="p-3.5">
                            <p className="font-semibold text-slate-900 dark:text-white text-xs">{product.name}</p>
                            {product.description && <p className="max-w-[240px] truncate text-[11px] text-slate-400">{product.description}</p>}
                          </td>
                          <td className="p-3.5"><Badge variant="outline" className="text-[11px] font-mono border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400">{product.sku}</Badge></td>
                          <td className="p-3.5"><Badge variant="secondary" className="text-[11px] bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300">{product.category?.name || '-'}</Badge></td>
                          <td className="p-3.5">
                            <p className="font-semibold tabular-nums text-xs text-slate-900 dark:text-white">{formatCurrency(product.sale_price)}</p>
                            <p className="text-[11px] tabular-nums text-slate-400">Costo: {formatCurrency(product.purchase_price)}</p>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span className="min-w-6 font-bold tabular-nums text-xs text-slate-900 dark:text-white">{product.stock_quantity}</span>
                              <Badge className={`text-[10px] px-2 py-0.5 border-0 ${stockInfo.color}`}>{stockInfo.text}</Badge>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <Badge className={`text-[10px] px-2 py-0.5 border-0 ${getStatusBadge(product)}`}>
                              {product.status === 'active' ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-500/20"
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setIsVariantDialogOpen(true)
                                }}
                                title="Gestionar variantes"
                                aria-label={`Gestionar variantes de ${product.name}`}
                              >
                                <Layers className="h-3.5 w-3.5 text-purple-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/20" onClick={() => openEditDialog(product)} title="Editar producto" aria-label={`Editar ${product.name}`}>
                                <Edit className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20" onClick={() => { setSelectedProduct(product); setIsDeleteDialogOpen(true); }} title="Eliminar producto" aria-label={`Eliminar ${product.name}`}>
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Paginación */}
            <div className="flex items-center justify-between border-t p-3 dark:border-gray-700">
              <span className="text-xs text-muted-foreground">
                Mostrando {rangeStart} - {rangeEnd} de {totalCount}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setPage(p => p + 1)} disabled={!hasNextPage || loading} aria-label="Página siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="categories">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-4">
              <h3 className="font-semibold text-foreground">Categorías</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Organización del catálogo compartido.</p>
            </div>
            {categories.length === 0 ? (
              <EmptyState icon={FolderTree} title="No hay categorías" description="Crea categorías desde la sección de Productos para organizar el catálogo." />
            ) : (
              <div className="divide-y">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                    </div>
                    <Badge variant="secondary" className="rounded-md">{category.productCount || 0} productos</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="variants">
          <VariantManager />
        </TabsContent>

        <TabsContent value="promotions">
          <PromotionManager />
        </TabsContent>

        <TabsContent value="suppliers">
          <SupplierManagement />
        </TabsContent>

        <TabsContent value="search">
          <AdvancedSearch
            onSearch={handleAdvancedSearch}
            onClearFilters={clearAdvancedSearch}
            results={searchResults}
            isLoading={loading}
            categoryOptions={categoryOptions}
            supplierOptions={supplierOptions}
          />
        </TabsContent>

        <TabsContent value="stock-control">
          <StockControl />
        </TabsContent>

        <TabsContent value="movements">
          <StockMovements />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {/* Out of Stock Card */}
            <Card className="border-red-200 dark:border-red-800 dark:bg-gray-800">
              <CardHeader className="bg-red-50/50 dark:bg-red-950/10 border-b dark:border-red-900/20">
                <CardTitle className="text-red-800 dark:text-red-400 flex items-center text-base">
                  <XCircle className="h-5 w-5 mr-2 shrink-0" />
                  Productos Agotados ({products.filter(p => p.stock_quantity === 0).length})
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Artículos sin inventario disponible para la venta</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                {products.filter(p => p.stock_quantity === 0).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No hay productos agotados. ¡Excelente!</p>
                ) : (
                  products.filter(p => p.stock_quantity === 0).map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 rounded-lg border bg-card dark:border-gray-700 hover:bg-muted/10 transition-colors">
                      <div>
                        <p className="font-semibold text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(product)} className="h-8 rounded-lg text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20">
                        Reabastecer
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Low Stock Card */}
            <Card className="border-yellow-200 dark:border-yellow-800 dark:bg-gray-800">
              <CardHeader className="bg-yellow-50/50 dark:bg-yellow-950/10 border-b dark:border-yellow-900/20">
                <CardTitle className="text-yellow-800 dark:text-yellow-400 flex items-center text-base">
                  <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
                  Stock Bajo ({products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length})
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Artículos cerca o por debajo de su cantidad mínima</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                {products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No hay productos con stock bajo.</p>
                ) : (
                  products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 rounded-lg border bg-card dark:border-gray-700 hover:bg-muted/10 transition-colors">
                      <div>
                        <p className="font-semibold text-sm">{product.name}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <Badge variant="outline" className="text-[10px] h-4 py-0 dark:border-gray-600">SKU: {product.sku}</Badge>
                          <span className="text-xs text-amber-600 font-medium">Stock: {product.stock_quantity} (Min: {product.min_stock})</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(product)} className="h-8 rounded-lg text-xs border-yellow-200 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 dark:border-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-950/20">
                        Modificar
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <InventoryReports />
        </TabsContent>
        </div>
      </Tabs>

      {/* Dialogs: Create/Edit Product - Sincronizado con ProductModal completo de Dashboard */}
      <ProductModal
        product={(selectedProduct as any) || null}
        isOpen={isAddDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false)
          setIsEditDialogOpen(false)
          setSelectedProduct(null)
        }}
        categories={categories as any}
        brands={[]}
        suppliers={suppliers as any}
        onSave={async (productData) => {
          if (isEditDialogOpen && selectedProduct) {
            const result = await updateProduct(selectedProduct.id, productData as any)
            if (!result.success) throw new Error(result.error || 'No fue posible actualizar el producto')
            setSuccessMessage('Producto actualizado correctamente')
          } else {
            const result = await createProduct(productData as any)
            if (!result.success) throw new Error(result.error || 'No fue posible crear el producto')
            setSuccessMessage('Producto creado correctamente')
          }
          setIsAddDialogOpen(false)
          setIsEditDialogOpen(false)
          setSelectedProduct(null)
          setTimeout(() => setSuccessMessage(''), 3000)
        }}
      />

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Confirmar Eliminación</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              ¿Está seguro de que desea eliminar <strong>{selectedProduct?.name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={isSubmitting}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Variantes para: {selectedProduct?.name}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Administre variantes y opciones personalizadas (ej: Talla, Color, Capacidad) para este producto.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {selectedProduct && (
              <VariantManager productId={selectedProduct.id} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsVariantDialogOpen(false); setSelectedProduct(null); }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


