'use client'

import { useState, useMemo } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
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
import { useInventory, Product } from '@/hooks/use-inventory'
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
  Layers
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'

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
  const {
    products,
    categories,
    suppliers,
    loading,
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

  const toLowerSafe = (value?: string | null) => (value || '').toLowerCase()

  const getStockDerivedStatus = (product: Product) => {
    if (product.stock_quantity === 0) return 'out_of_stock'
    if (product.stock_quantity <= product.min_stock) return 'low_stock'
    return product.status
  }

  const handleAdvancedSearch = (activeFilters: AdvancedSearchFilter[]) => {
    const byId = new Map(activeFilters.map((f) => [f.id, f]))
    const search = String(byId.get('search')?.value || '').trim().toLowerCase()
    const categoriesFilter = Array.isArray(byId.get('category')?.value) ? (byId.get('category')?.value as string[]) : []
    const suppliersFilter = Array.isArray(byId.get('supplier')?.value) ? (byId.get('supplier')?.value as string[]) : []
    const statusFilter = Array.isArray(byId.get('status')?.value) ? (byId.get('status')?.value as string[]) : []
    const priceRange = Array.isArray(byId.get('priceRange')?.value) ? (byId.get('priceRange')?.value as number[]) : null
    const stockRange = Array.isArray(byId.get('stockRange')?.value) ? (byId.get('stockRange')?.value as number[]) : null
    const dateAdded = String(byId.get('dateAdded')?.value || '')
    const hasImage = Boolean(byId.get('hasImage')?.value)

    const filtered = products.filter((product) => {
      const productName = toLowerSafe(product.name)
      const sku = toLowerSafe(product.sku)
      const description = toLowerSafe(product.description)
      const categoryName = toLowerSafe(product.category?.name)
      const supplierName = toLowerSafe(product.supplier?.name)

      if (search && !productName.includes(search) && !sku.includes(search) && !description.includes(search)) {
        return false
      }

      if (
        categoriesFilter.length > 0 &&
        !categoriesFilter.some((value) => categoryName.includes(String(value).toLowerCase()))
      ) {
        return false
      }

      if (
        suppliersFilter.length > 0 &&
        !suppliersFilter.some((value) => supplierName.includes(String(value).toLowerCase()))
      ) {
        return false
      }

      if (priceRange && typeof priceRange[0] === 'number' && typeof priceRange[1] === 'number') {
        if (product.sale_price < priceRange[0] || product.sale_price > priceRange[1]) return false
      }

      if (stockRange && typeof stockRange[0] === 'number' && typeof stockRange[1] === 'number') {
        if (product.stock_quantity < stockRange[0] || product.stock_quantity > stockRange[1]) return false
      }

      if (statusFilter.length > 0) {
        const derivedStatus = getStockDerivedStatus(product)
        if (!statusFilter.includes(derivedStatus) && !statusFilter.includes(product.status)) return false
      }

      if (dateAdded && !product.created_at?.startsWith(dateAdded)) return false
      if (hasImage && !product.image_url) return false

      return true
    })

    setSearchResults(
      filtered.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category?.name || '-',
        supplier: product.supplier?.name || '-',
        price: product.sale_price,
        stock: product.stock_quantity,
        status: getStockDerivedStatus(product),
        lastMovement: new Date(product.updated_at)
      }))
    )
  }

  const clearAdvancedSearch = () => {
    setSearchResults([])
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
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-background p-6 shadow-sm dark:border-blue-900/30 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-gray-900">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200/50 bg-white shadow-sm dark:border-blue-800 dark:bg-gray-800">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Gestión de Inventario
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Control inteligente, trazabilidad de stock y variantes del catálogo</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportProducts}
              className="h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/20"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button
              onClick={() => {
                setFormData({})
                setValidationErrors([])
                setActionError('')
                setIsAddDialogOpen(true)
              }}
              className="h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-100 dark:shadow-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total */}
        <Card className="group relative overflow-hidden border border-border/85 hover:border-blue-500/30 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 dark:bg-gray-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">Total Productos</p>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{totalCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-950/50">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Stock Bajo */}
        <Card className="group relative overflow-hidden border border-border/85 hover:border-yellow-500/30 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 dark:bg-gray-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-500" />
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">Stock Bajo / Crítico</p>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{stats.lowStock}</p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 transition-colors group-hover:bg-yellow-100 dark:group-hover:bg-yellow-950/50">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Valor */}
        <Card className="group relative overflow-hidden border border-border/85 hover:border-emerald-500/30 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 dark:bg-gray-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">Valor Estimado</p>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">Gs. {stats.totalValue.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/50">
              <GSIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Margen */}
        <Card className="group relative overflow-hidden border border-border/85 hover:border-purple-500/30 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 dark:bg-gray-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">Margen Promedio</p>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{stats.avgMargin.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 transition-colors group-hover:bg-purple-100 dark:group-hover:bg-purple-950/50">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="flex h-10 w-max min-w-full justify-start gap-1 bg-muted/50 dark:bg-gray-900/50 p-1 rounded-lg border dark:border-gray-700">
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="categories">Categorías</TabsTrigger>
            <TabsTrigger value="variants">Variantes</TabsTrigger>
            <TabsTrigger value="promotions">Promociones</TabsTrigger>
            <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
            <TabsTrigger value="search">Búsqueda</TabsTrigger>
            <TabsTrigger value="stock-control">Control Stock</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="reports">Reportes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="space-y-6">
          {/* Filtros */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    placeholder="Buscar..." 
                    className="pl-10 dark:bg-gray-900 dark:border-gray-700"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <Select value={filters.category} onValueChange={(val) => setFilters(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger className="w-full sm:w-48 dark:bg-gray-900 dark:border-gray-700">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.stockStatus} onValueChange={(val) => setFilters(prev => ({ ...prev, stockStatus: val }))}>
                  <SelectTrigger className="w-full sm:w-48 dark:bg-gray-900 dark:border-gray-700">
                    <SelectValue placeholder="Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="low">Bajo</SelectItem>
                    <SelectItem value="out">Agotado</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card className="dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                  <tr>
                    <th className="p-4 font-semibold text-gray-900 dark:text-gray-100">Producto</th>
                    <th className="p-4 font-semibold text-gray-900 dark:text-gray-100">SKU</th>
                    <th className="p-4 font-semibold text-gray-900 dark:text-gray-100">Categoría</th>
                    <th className="p-4 font-semibold text-gray-900 dark:text-gray-100">Precio</th>
                    <th className="p-4 font-semibold text-gray-900 dark:text-gray-100">Stock</th>
                    <th className="p-4 font-semibold text-gray-900 dark:text-gray-100">Estado</th>
                    <th className="p-4 text-right font-semibold text-gray-900 dark:text-gray-100">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        Cargando productos...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No se encontraron productos.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const stockInfo = getStockStatus(product)
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="p-4">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                            {product.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{product.description}</p>}
                          </td>
                          <td className="p-4"><Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{product.sku}</Badge></td>
                          <td className="p-4"><Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300">{product.category?.name || '-'}</Badge></td>
                          <td className="p-4">
                            <p className="font-medium dark:text-gray-200">${product.sale_price.toLocaleString()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Costo: ${product.purchase_price.toLocaleString()}</p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium dark:text-gray-200">{product.stock_quantity}</span>
                              <Badge className={`text-xs ${stockInfo.color}`}>{stockInfo.text}</Badge>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusBadge(product)}>
                              {product.status === 'active' ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setIsVariantDialogOpen(true)
                                }}
                                title="Gestionar Variantes"
                              >
                                <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} title="Editar Producto">
                                <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(product); setIsDeleteDialogOpen(true); }} title="Eliminar Producto">
                                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
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
            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {rangeStart} - {rangeEnd} de {totalCount}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!hasNextPage || loading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          {/* Reutilizar Categories visualmente pero con datos reales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.map(cat => (
              <Card key={cat.id} className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader className="border-b dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10">
                  <CardTitle className="text-blue-800 dark:text-blue-300 flex items-center">
                    <Tag className="h-5 w-5 mr-2" />
                    {cat.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-2xl font-bold dark:text-gray-100">{cat.productCount || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Productos</p>
                </CardContent>
              </Card>
            ))}
          </div>
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
          <AdvancedSearch onSearch={handleAdvancedSearch} onClearFilters={clearAdvancedSearch} results={searchResults} />
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
      </Tabs>

      {/* Dialogs: Create/Edit Product */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">{isEditDialogOpen ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            <DialogDescription className="dark:text-gray-400">Complete la información del producto.</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <h4 className="font-semibold dark:text-gray-200 border-b dark:border-gray-700 pb-2">Información Básica</h4>
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Nombre *</Label>
                <Input 
                  value={formData.name || ''} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`dark:bg-gray-900 dark:border-gray-600 ${getFieldError('name') ? 'border-red-500' : ''}`}
                />
                {getFieldError('name') && <p className="text-xs text-red-500">{getFieldError('name')}</p>}
              </div>
              <div className="space-y-2">
                <Label className="dark:text-gray-300">SKU *</Label>
                <Input 
                  value={formData.sku || ''} 
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  className={`dark:bg-gray-900 dark:border-gray-600 ${getFieldError('sku') ? 'border-red-500' : ''}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Categoría *</Label>
                <Select value={formData.category_id} onValueChange={val => setFormData({ ...formData, category_id: val })}>
                  <SelectTrigger className="dark:bg-gray-900 dark:border-gray-600"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Proveedor *</Label>
                <Select value={formData.supplier_id} onValueChange={val => setFormData({ ...formData, supplier_id: val })}>
                  <SelectTrigger className="dark:bg-gray-900 dark:border-gray-600"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold dark:text-gray-200 border-b dark:border-gray-700 pb-2">Precios y Stock</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-gray-300">Costo *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price ?? ''}
                    onChange={e => setFormData({ ...formData, purchase_price: parseNumberInput(e.target.value, parseFloat) })}
                    className={`dark:bg-gray-900 dark:border-gray-600 ${getFieldError('purchase_price') ? 'border-red-500' : ''}`}
                  />
                  {getFieldError('purchase_price') && <p className="text-xs text-red-500">{getFieldError('purchase_price')}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-gray-300">Precio Venta *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sale_price ?? ''}
                    onChange={e => setFormData({ ...formData, sale_price: parseNumberInput(e.target.value, parseFloat) })}
                    className={`dark:bg-gray-900 dark:border-gray-600 ${getFieldError('sale_price') ? 'border-red-500' : ''}`}
                  />
                  {getFieldError('sale_price') && <p className="text-xs text-red-500">{getFieldError('sale_price')}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-gray-300">Stock *</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity ?? ''}
                    onChange={e => setFormData({ ...formData, stock_quantity: parseNumberInput(e.target.value, parseInt) })}
                    className={`dark:bg-gray-900 dark:border-gray-600 ${getFieldError('stock_quantity') ? 'border-red-500' : ''}`}
                  />
                  {getFieldError('stock_quantity') && <p className="text-xs text-red-500">{getFieldError('stock_quantity')}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-gray-300">Min</Label>
                  <Input
                    type="number"
                    value={formData.min_stock ?? ''}
                    onChange={e => setFormData({ ...formData, min_stock: parseNumberInput(e.target.value, parseInt) })}
                    className="dark:bg-gray-900 dark:border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-gray-300">Max</Label>
                  <Input
                    type="number"
                    value={formData.max_stock ?? ''}
                    onChange={e => setFormData({ ...formData, max_stock: parseNumberInput(e.target.value, parseInt) })}
                    className="dark:bg-gray-900 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }}>Cancelar</Button>
            <Button onClick={isEditDialogOpen ? handleEditProduct : handleAddProduct} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {isEditDialogOpen ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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


