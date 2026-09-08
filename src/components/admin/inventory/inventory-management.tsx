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
import { InventoryAlertsPanel } from '@/components/admin/inventory/InventoryAlertsPanel'
import { ProductModal } from '@/components/dashboard/product-modal'
import { useInventory, type Product, type InventorySort, type InventorySortColumn } from '@/hooks/use-inventory'
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
  RotateCcw,
  ArrowUpDown,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/currency'
import { resolveStockLevel } from '@/lib/inventory/stock-status'
import { exportInventoryCsvRows } from '@/lib/inventory/export'

// Excel en espanol necesita las dos cosas para abrir bien el archivo: BOM
// para las tildes y CRLF como fin de linea. Van como constantes con nombre
// para que no se pierdan en un reformateo.
const BOM_UTF8 = String.fromCharCode(0xfeff)
const LINE_BREAK_CRLF = String.fromCharCode(13, 10)

const operationTabs = [
  { value: 'products', label: 'Catálogo', icon: Package },
  { value: 'stock-control', label: 'Stock por sucursal', icon: Warehouse },
  { value: 'movements', label: 'Movimientos', icon: History },
  { value: 'alerts', label: 'Alertas', icon: Bell },
] as const

const INVENTORY_TAB_VALUES = new Set([
  'products', 'stock-control', 'movements', 'alerts',
  'suppliers', 'categories', 'variants', 'promotions', 'reports', 'search',
])

const managementTabs = [
  { value: 'suppliers', label: 'Proveedores', icon: Truck },
  { value: 'categories', label: 'Categorías', icon: FolderTree },
  { value: 'variants', label: 'Variantes', icon: Layers },
  { value: 'promotions', label: 'Promociones', icon: Percent },
  { value: 'reports', label: 'Reportes', icon: BarChart3 },
  { value: 'search', label: 'Búsqueda avanzada', icon: SlidersHorizontal },
] as const

interface AdvancedSearchFilter {
  id: string
  type: string
  value: unknown
}

/** Cabecera que ordena. Antes eran texto plano y el orden estaba fijo. */
function SortableHeader({
  column,
  label,
  sort,
  onSort,
}: {
  column: InventorySortColumn
  label: string
  sort: InventorySort
  onSort: (column: InventorySortColumn) => void
}) {
  const active = sort.column === column
  return (
    <th className="p-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Ordenar por ${label}`}
        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="flex w-full items-center gap-1 p-3.5 text-left transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-slate-200"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 shrink-0 transition-opacity ${active ? 'opacity-100 text-blue-500' : 'opacity-30'}`} />
      </button>
    </th>
  )
}

export default function InventoryManagement() {
  const { selectedBranch, selectedBranchId, loading: branchLoading } = useBranch()
  const {
    products,
    categories,
    suppliers,
    snapshot,
    listTruncated,
    referenceDataError,
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
    deleteProduct,
    refreshSuppliers,
    sort,
    setSort,
    setPageSize
  } = useInventory()

  // Estados de interfaz locales
  // La pestaña viaja en la URL: con diez secciones y `useState`, recargar,
  // volver desde el detalle de un producto o compartir un enlace te devolvia
  // siempre a «Catalogo».
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'products'
    const desdeUrl = new URLSearchParams(window.location.search).get('tab')
    return INVENTORY_TAB_VALUES.has(desdeUrl || '') ? (desdeUrl as string) : 'products'
  })

  const changeTab = (value: string) => {
    setActiveTab(value)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (value === 'products') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    window.history.replaceState(null, '', url)
  }
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Estados del formulario
  const [successMessage, setSuccessMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ label: category.name, value: category.id })),
    [categories]
  )
  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id })),
    [suppliers]
  )

  // Helpers UI
  // El nivel sale de `resolveStockLevel`, que trata `max_stock: 0` como «sin
  // maximo definido». La regla anterior era `stock >= max_stock`: con el 0 por
  // defecto del modal de producto, casi todo el catalogo decia «Stock alto».
  const STOCK_LEVEL_BADGE = {
    out: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', text: 'Agotado', icon: XCircle },
    low: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', text: 'Bajo', icon: AlertTriangle },
    high: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', text: 'Alto', icon: TrendingUp },
    normal: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', text: 'Normal', icon: CheckCircle },
  } as const

  const getStockStatus = (product: Product) => STOCK_LEVEL_BADGE[resolveStockLevel(product)]

  const getStatusBadge = (product: Product) => {
    const isActive = product.status === 'active'
    return isActive 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-muted text-muted-foreground'
  }

  // Los indicadores vienen del servidor, sobre toda la empresa y la sucursal
  // activa. Antes se calculaban sobre `products` —la pagina actual, diez
  // filas— y cambiaban al pasar de pagina, al lado de un «Total de productos»
  // que si era global.
  const kpiCards = useMemo(() => {
    const alcance = snapshot?.branchScoped
      ? `En ${selectedBranch?.name || 'la sucursal activa'}`
      : 'En toda la empresa'

    return [
      {
        label: 'Productos en catálogo',
        value: snapshot ? snapshot.totalProducts.toLocaleString() : null,
        hint: 'Compartido entre sucursales',
        icon: Package,
        tone: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-500/20',
      },
      {
        label: 'Sin stock',
        value: snapshot ? snapshot.outOfStock.toLocaleString() : null,
        hint: alcance,
        icon: XCircle,
        tone: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-100 dark:bg-rose-500/20',
      },
      {
        label: 'Stock bajo',
        value: snapshot ? snapshot.lowStock.toLocaleString() : null,
        hint: alcance,
        icon: AlertTriangle,
        tone: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
      },
      {
        label: 'Valor a costo',
        value: snapshot ? formatCurrency(snapshot.stockCostValue) : null,
        hint: alcance,
        icon: GSIcon,
        tone: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-500/20',
      },
    ]
  }, [snapshot, selectedBranch?.name])

  // Handlers CRUD
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
    setActionError('')
    setIsEditDialogOpen(true)
  }

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

    setPage(1)
    changeTab('products')
    setSuccessMessage('Filtros aplicados al catálogo')
    setTimeout(() => setSuccessMessage(''), 3000)
    setFilters(prev => ({
      ...prev,
      search,
      // La seleccion completa, no solo la primera: elegias tres categorias y se
      // usaba una mientras las tres fichas seguian en pantalla.
      category: categoriesFilter.length > 0 ? categoriesFilter.join(',') : 'all',
      supplier: suppliersFilter.length > 0 ? suppliersFilter.join(',') : 'all',
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

  // Exportaba `products`, o sea las filas de la pagina actual, en un archivo
  // llamado «inventario_<fecha>.csv». Quien lo abria creia tener el inventario.
  const handleExportProducts = async () => {
    if (isExporting) return
    setIsExporting(true)
    setActionError('')
    try {
      const rows = await exportInventoryCsvRows(filters, selectedBranchId)

      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join(LINE_BREAK_CRLF)

      // Separador `;` y BOM: es lo que Excel en español necesita para no meter
      // todo en una sola columna ni romper las tildes.
      const blob = new Blob([BOM_UTF8 + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setSuccessMessage(`Se exportaron ${rows.length - 1} productos`)
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo exportar el inventario.')
    } finally {
      setIsExporting(false)
    }
  }

  // Ordenar por stock es lo primero que se busca en una pantalla de inventario,
  // y la API ya lo soportaba.
  const toggleSort = (column: InventorySortColumn) => {
    setSort((current) => current.column === column
      ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { column, direction: column === 'stock' ? 'asc' : 'asc' })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasNextPage = page * pageSize < totalCount
  const rangeStart = totalCount === 0 ? 0 : ((page - 1) * pageSize) + 1
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount)
  // `filters.category` puede traer varios ids separados por coma desde la
  // busqueda avanzada.
  const multiCategoryCount = filters.category !== 'all' ? filters.category.split(',').length : 0

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
      {referenceDataError && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            {referenceDataError} Los selectores de categoría y proveedor van a quedar vacíos, y el
            formulario de producto los exige.
          </AlertDescription>
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
              disabled={isExporting}
              className="h-9 rounded-xl border-slate-200 bg-white text-xs dark:border-white/10 dark:bg-[#0d1117]"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
            <Button
              onClick={() => {
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
                  Cada venta, ajuste y transferencia queda registrada con el stock anterior y el nuevo.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpiCards.map(({ label, value, hint, icon: Icon, tone, bg }) => (
          <Card key={label} className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
                {value === null ? (
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Sin datos</p>
                ) : (
                  <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</p>
                )}
                {/* Cada cifra dice de que universo habla: eran cuatro tarjetas
                    identicas, una global y tres de la pagina que estabas viendo. */}
                <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${tone}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {snapshot?.truncated && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            El catálogo supera el máximo que se puede recorrer de una vez: los indicadores de arriba
            son parciales.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={changeTab} className="min-w-0 space-y-5">
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={changeTab}>
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
                    {/* La busqueda avanzada puede dejar varias categorias
                        aplicadas; el selector simple no puede representarlas,
                        pero tampoco puede mentir diciendo «Todas». */}
                    {multiCategoryCount > 1 && (
                      <SelectItem value={filters.category}>
                        {multiCategoryCount} categorías (desde búsqueda avanzada)
                      </SelectItem>
                    )}
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
            {/* La tabla de siete columnas resolvia el celular con scroll
                horizontal. En movil se cambia por tarjetas, que es el patron
                que ya usaba la pestaña de Alertas dentro de esta misma
                pantalla. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                  <tr>
                    <SortableHeader column="name" label="Producto" sort={sort} onSort={toggleSort} />
                    <SortableHeader column="sku" label="SKU" sort={sort} onSort={toggleSort} />
                    <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Categoría</th>
                    <SortableHeader column="price" label="Precio / Costo" sort={sort} onSort={toggleSort} />
                    <SortableHeader column="stock" label="Stock" sort={sort} onSort={toggleSort} />
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
                            {/* Lo comprometido por pedidos: la columna existia
                                en la base y no la leia nadie, asi que se
                                mostraba stock fisico donde se lee «disponible». */}
                            {Number(product.reserved_quantity || 0) > 0 && (
                              <p className="mt-1 text-[11px] tabular-nums text-amber-600 dark:text-amber-400">
                                {product.reserved_quantity} reservado{Number(product.reserved_quantity) === 1 ? '' : 's'}
                                {' · '}
                                {Math.max(0, product.stock_quantity - Number(product.reserved_quantity || 0))} disponible
                              </p>
                            )}
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

            {/* Misma informacion, apilada, para pantallas angostas. */}
            <div className="divide-y divide-slate-100 dark:divide-white/5 md:hidden">
              {loading && (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-500" />
                  Cargando catálogo...
                </div>
              )}
              {!loading && products.length === 0 && (
                <EmptyState
                  icon={Package}
                  title={hasCatalogFilters ? 'No hay resultados' : 'Todavía no hay productos'}
                  description={hasCatalogFilters
                    ? 'Probá con otros términos o quitá los filtros aplicados.'
                    : 'Creá el primer producto para comenzar a controlar existencias.'}
                  className="py-12"
                />
              )}
              {!loading && products.map((product) => {
                const stockInfo = getStockStatus(product)
                return (
                  <div key={product.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{product.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{product.sku}</p>
                      </div>
                      <Badge className={`shrink-0 border-0 px-2 py-0.5 text-[10px] ${stockInfo.color}`}>{stockInfo.text}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(product.sale_price)}</span>
                      <span className="tabular-nums">Stock {product.stock_quantity}</span>
                      {product.category?.name && <span className="truncate">{product.category.name}</span>}
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button variant="outline" size="sm" className="h-8 flex-1 rounded-lg text-xs" onClick={() => openEditDialog(product)}>
                        <Edit className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => { setSelectedProduct(product); setIsVariantDialogOpen(true) }}
                        aria-label={`Gestionar variantes de ${product.name}`}
                      >
                        <Layers className="h-3.5 w-3.5 text-purple-500" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => { setSelectedProduct(product); setIsDeleteDialogOpen(true) }}
                        aria-label={`Eliminar ${product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Paginación */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
              <span className="text-xs text-muted-foreground">
                Mostrando {rangeStart} - {rangeEnd} de {totalCount}
                {/* La API avisa cuando el filtro de stock barrió hasta su tope y
                    quedaron productos sin evaluar: el total es parcial. */}
                {listTruncated && (
                  <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
                    (parcial: quedaron productos sin evaluar por el filtro de stock)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-8 w-[112px] rounded-md text-xs" aria-label="Productos por página">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Con 10 filas fijas, revisar 400 productos eran 40 clics. */}
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size} por página</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setPage(1)} disabled={page === 1 || loading} aria-label="Primera página">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {/* Eran dos flechas sin numero: no habia forma de saber donde estabas. */}
                <span className="min-w-[86px] text-center text-xs tabular-nums text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setPage(p => p + 1)} disabled={!hasNextPage || loading} aria-label="Página siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setPage(totalPages)} disabled={!hasNextPage || loading} aria-label="Última página">
                  <ChevronsRight className="h-4 w-4" />
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
          <SupplierManagement onSuppliersChanged={refreshSuppliers} />
        </TabsContent>

        <TabsContent value="search">
          <AdvancedSearch
            onSearch={handleAdvancedSearch}
            onClearFilters={clearAdvancedSearch}
            isLoading={loading}
            categoryOptions={categoryOptions}
            supplierOptions={supplierOptions}
            priceCeiling={snapshot?.maxSalePrice}
            stockCeiling={snapshot?.maxStockQuantity}
          />
        </TabsContent>

        <TabsContent value="stock-control">
          <StockControl />
        </TabsContent>

        <TabsContent value="movements">
          <StockMovements />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <InventoryAlertsPanel
            branchName={snapshot?.branchScoped ? selectedBranch?.name : null}
            onRestock={(productId) => {
              const product = products.find((item) => item.id === productId)
              if (product) {
                openEditDialog(product)
                return
              }
              // La alerta puede ser de un producto que no esta en la pagina
              // cargada: se lo busca por su id en el catalogo.
              setFilters((current) => ({ ...current, search: productId }))
              changeTab('products')
            }}
          />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle >Confirmar Eliminación</DialogTitle>
            <DialogDescription >
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Variantes para: {selectedProduct?.name}
            </DialogTitle>
            <DialogDescription >
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


