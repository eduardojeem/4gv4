'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import AdvancedSearch from '@/components/admin/advanced-search'
import StockControl, { type StockRestockRequest } from '@/components/admin/inventory/stock-control'
import { InventoryAssistant } from '@/components/admin/inventory/InventoryAssistant'
import { CatalogProductGrid } from '@/components/admin/inventory/CatalogProductGrid'
import { CatalogFirstSteps, CatalogGuide } from '@/components/admin/inventory/CatalogGuide'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { buildInventoryRecommendations, type InventoryIssueSample, type InventoryRecommendation } from '@/lib/inventory/inventory-health'
import { cn } from '@/lib/utils'
import StockMovements from '@/components/admin/inventory/stock-movements'
import InventoryReports from '@/components/admin/reports/inventory-reports'
import SupplierManagement from '@/components/admin/inventory/supplier-management'
import { PromotionManager } from '@/components/admin/inventory/PromotionManager'
import { VariantsOverview } from '@/components/admin/inventory/VariantsOverview'
import { InventoryCategoriesPanel } from '@/components/admin/inventory/InventoryCategoriesPanel'
import type { ProductModalTabId } from '@/components/dashboard/product-modal'
import { InventoryAlertsPanel } from '@/components/admin/inventory/InventoryAlertsPanel'
import { InventoryGuide } from '@/components/admin/inventory/InventoryGuide'
import { ProductModal } from '@/components/dashboard/product-modal'
import { useInventory, type Product, type InventorySort, type InventorySortColumn } from '@/hooks/use-inventory'
import { useBranch } from '@/contexts/branch-context'
import {
  Package,
  Plus,
  Download,
  CheckCircle,
  TrendingUp,
  Search,
  XCircle,
  AlertTriangle, Trash2,
  Edit,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
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
  ChevronsRight,
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  MoreHorizontal,
  PackagePlus,
  ScanBarcode,
  LayoutGrid,
  Rows3,
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

const CATALOG_VIEW_KEY = 'mipos:inventory:catalog-view'
type CatalogView = 'table' | 'grid'

/** Chips de stock del catálogo: más rápidos que un selector y muestran cuántos hay. */
const STOCK_FILTER_CHIPS = [
  { value: 'all', label: 'Todos' },
  { value: 'out', label: 'Agotados' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Sobre el máximo' },
] as const

const operationTabs = [
  { value: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { value: 'products', label: 'Catálogo', icon: Package },
  { value: 'stock-control', label: 'Stock por sucursal', icon: Warehouse },
  { value: 'movements', label: 'Movimientos', icon: History },
  { value: 'alerts', label: 'Alertas', icon: Bell },
] as const

const INVENTORY_TAB_VALUES = new Set([
  'overview', 'products', 'stock-control', 'movements', 'alerts',
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
    <th
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="p-0 text-[11px] font-bold uppercase tracking-wider text-slate-400"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Ordenar por ${label}`}
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
    refreshCategories,
    sort,
    setSort,
    setPageSize
  } = useInventory()

  // Estados de interfaz locales
  // La pestaña viaja en la URL: con diez secciones y `useState`, recargar,
  // volver desde el detalle de un producto o compartir un enlace te devolvia
  // siempre a «Catalogo».
  // Sin pestaña en la URL se arranca en «Resumen»: indicadores y el asistente
  // con lo que conviene hacer primero.
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview'
    const desdeUrl = new URLSearchParams(window.location.search).get('tab')
    return INVENTORY_TAB_VALUES.has(desdeUrl || '') ? (desdeUrl as string) : 'overview'
  })

  const changeTab = (value: string) => {
    setActiveTab(value)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (value === 'overview') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    window.history.replaceState(null, '', url)
  }
  const [guideOpen, setGuideOpen] = useState(false)
  const [catalogView, setCatalogView] = useState<CatalogView>(() => {
    try {
      return window.localStorage.getItem(CATALOG_VIEW_KEY) === 'grid' ? 'grid' : 'table'
    } catch {
      return 'table'
    }
  })
  const changeCatalogView = (view: CatalogView) => {
    setCatalogView(view)
    try {
      window.localStorage.setItem(CATALOG_VIEW_KEY, view)
    } catch {
      // Sin almacenamiento la vista elegida dura hasta recargar.
    }
  }
  // Pedido para «Stock por sucursal»: abre el registro de movimiento, con el
  // producto ya elegido cuando viene de una alerta o del catálogo.
  const [restock, setRestock] = useState<(StockRestockRequest & { nonce: number }) | null>(null)

  const openStockMovement = (product?: { id: string; name: string }) => {
    setRestock({ productId: product?.id, productName: product?.name, nonce: Date.now() })
    changeTab('stock-control')
  }
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  // Paso en que se abre la ficha: «variants» desde las acciones de variantes.
  const [modalTab, setModalTab] = useState<ProductModalTabId>('basic')
  // Sube cada vez que se guarda un producto, para que Variantes vuelva a revisar.
  const [productSaves, setProductSaves] = useState(0)
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
        stockStatus: 'all' as const,
      },
      {
        label: 'Sin stock',
        value: snapshot ? snapshot.outOfStock.toLocaleString() : null,
        hint: alcance,
        icon: XCircle,
        tone: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-100 dark:bg-rose-500/20',
        stockStatus: 'out' as const,
      },
      {
        label: 'Stock bajo',
        value: snapshot ? snapshot.lowStock.toLocaleString() : null,
        hint: alcance,
        icon: AlertTriangle,
        tone: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        stockStatus: 'low' as const,
      },
      {
        label: 'Valor a costo',
        value: snapshot ? formatCurrency(snapshot.stockCostValue) : null,
        hint: alcance,
        icon: GSIcon,
        tone: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-500/20',
        stockStatus: 'all' as const,
      },
    ]
  }, [snapshot, selectedBranch?.name])

  const recommendations = useMemo(
    () => buildInventoryRecommendations(snapshot?.health ?? null, {
      categories: categories.length,
      suppliers: suppliers.length,
      branchName: snapshot?.branchScoped ? selectedBranch?.name : null,
    }),
    [snapshot, categories.length, suppliers.length, selectedBranch?.name],
  )

  /** Lleva al catálogo con un filtro de stock ya aplicado. */
  const showCatalog = (stockStatus: 'all' | 'out' | 'low' | 'high' = 'all', search = '') => {
    setPage(1)
    setFilters((current) => ({ ...current, search, category: 'all', stockStatus }))
    changeTab('products')
  }

  const handleRecommendation = (recommendation: InventoryRecommendation) => {
    if ('href' in recommendation.action) return
    if (recommendation.action.tab === 'products') showCatalog(recommendation.action.stockStatus ?? 'all')
    else changeTab(recommendation.action.tab)
  }

  // Un ejemplo del asistente se abre buscándolo en el catálogo por su código o nombre.
  const openSample = (sample: InventoryIssueSample) => showCatalog('all', sample.sku || sample.name)

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

  const openEditDialog = (product: Product, tab: ProductModalTabId = 'basic') => {
    setSelectedProduct(product)
    setModalTab(tab)
    setActionError('')
    setIsEditDialogOpen(true)
  }

  /**
   * Las variantes se editan en la ficha del producto: guarda con la misma
   * función que el resto del sistema, que crea el stock de cada variante en la
   * sucursal. El editor viejo de esta pantalla no lo hacía y esas variantes no
   * se podían cobrar en el punto de venta.
   */
  const openVariantEditor = async (productId: string) => {
    const loaded = products.find((item) => item.id === productId)
    if (loaded) {
      openEditDialog(loaded, 'variants')
      return
    }
    try {
      const response = await fetch(`/api/products/${productId}`, { cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.data) throw new Error(body?.error || 'No se encontró el producto')
      openEditDialog(body.data as Product, 'variants')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo abrir el producto')
    }
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

      {/* Encabezado: título, sucursal, guía y lo demás en un menú */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Inventario</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Catálogo, existencias y movimientos</span>
            <Badge variant="outline" className="max-w-full gap-1.5 rounded-md">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                {branchLoading ? 'Cargando sucursal...' : `Stock: ${selectedBranch?.name || 'sin sucursal activa'}`}
              </span>
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGuideOpen(true)}>
            <BookOpen className="h-4 w-4" /> Guía
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setActionError('')
              setIsAddDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo producto
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Más opciones de inventario">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => openStockMovement()} className="gap-2">
                <PackagePlus className="h-4 w-4" /> Registrar movimiento
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/dashboard/inventory-count"><ScanBarcode className="h-4 w-4" /> Toma de inventario</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExportProducts()} disabled={isExporting} className="gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExporting ? 'Exportando...' : 'Exportar CSV'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/dashboard/products"><ArrowUpRight className="h-4 w-4" /> Productos en el panel</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/admin/branches"><Building2 className="h-4 w-4" /> Sucursales</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* La guía completa vive en un panel lateral: no empuja la pantalla hacia abajo. */}
      <Sheet open={guideOpen} onOpenChange={setGuideOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Cómo funciona el inventario
            </SheetTitle>
            <SheetDescription>El modelo de stock por sucursal, los movimientos y las situaciones más comunes.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <InventoryGuide embedded />
          </div>
        </SheetContent>
      </Sheet>

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

        {/* Escritorio: lo del día a día a la vista y la gestión en «Más». */}
        <nav className="hidden items-center gap-1 border-b border-border lg:flex" aria-label="Secciones de inventario">
          <TabsList className="h-auto gap-1 bg-transparent p-0">
            {operationTabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative h-10 gap-2 rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {value === 'alerts' && snapshot && snapshot.outOfStock + snapshot.lowStock > 0 && (
                  <span className="rounded-full bg-rose-500/15 px-1.5 text-[11px] tabular-nums text-rose-700 dark:text-rose-300">
                    {(snapshot.outOfStock + snapshot.lowStock).toLocaleString()}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors',
                  managementTabs.some((tab) => tab.value === activeTab)
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {managementTabs.find((tab) => tab.value === activeTab)?.label ?? 'Más'}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {managementTabs.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem key={value} onSelect={() => changeTab(value)} className="gap-2">
                  <Icon className="h-4 w-4" /> {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="min-w-0">

        <TabsContent value="overview" className="space-y-5">
          {/* KPIs: cada tarjeta lleva al catálogo con ese filtro. */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map(({ label, value, hint, icon: Icon, tone, bg, stockStatus }) => (
              <button
                key={label}
                type="button"
                onClick={() => showCatalog(stockStatus)}
                className="rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 space-y-1">
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                    {value === null ? (
                      <span className="block text-sm text-muted-foreground">Sin datos</span>
                    ) : (
                      <span className="block text-xl font-semibold tracking-tight tabular-nums text-foreground">{value}</span>
                    )}
                    {/* Cada cifra dice de que universo habla: eran cuatro tarjetas
                        identicas, una global y tres de la pagina que estabas viendo. */}
                    <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>
                  </span>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-5 w-5 ${tone}`} />
                  </span>
                </span>
              </button>
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

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <InventoryAssistant
              health={snapshot?.health ?? null}
              recommendations={recommendations}
              loading={loading && !snapshot}
              onAction={handleRecommendation}
              onOpenSample={openSample}
            />

            <section aria-labelledby="inventory-shortcuts-title" className="space-y-2 rounded-2xl border bg-card p-4 shadow-xs">
              <h3 id="inventory-shortcuts-title" className="text-sm font-semibold text-foreground">Accesos rápidos</h3>
              {[
                { label: 'Registrar entrada o ajuste', hint: 'Llegó mercadería o contaste distinto', icon: PackagePlus, onClick: () => openStockMovement() },
                { label: 'Nuevo producto', hint: 'Alta en el catálogo', icon: Plus, onClick: () => { setActionError(''); setIsAddDialogOpen(true) } },
                { label: 'Ver alertas', hint: 'Agotados y bajo mínimo', icon: Bell, onClick: () => changeTab('alerts') },
                { label: 'Historial de movimientos', hint: 'Ventas, entradas y ajustes', icon: History, onClick: () => changeTab('movements') },
              ].map(({ label, hint, icon: Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>
              ))}
              <Link
                href="/dashboard/inventory-count"
                className="flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ScanBarcode className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">Toma de inventario</span>
                  <span className="block truncate text-xs text-muted-foreground">Contar con el lector y ajustar diferencias</span>
                </span>
              </Link>
            </section>
          </div>
        </TabsContent>

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
                  <div className="flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Vista del catálogo">
                    {([
                      { value: 'table', label: 'Tabla', icon: Rows3 },
                      { value: 'grid', label: 'Tarjetas', icon: LayoutGrid },
                    ] as const).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={catalogView === value}
                        onClick={() => changeCatalogView(value)}
                        className={cn(
                          'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors',
                          catalogView === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <CatalogGuide
                  branchName={selectedBranch?.name || 'la sucursal activa'}
                  onOpenFullGuide={() => setGuideOpen(true)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_14rem]">
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
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar por stock">
                {STOCK_FILTER_CHIPS.map(({ value, label }) => {
                  const count = value === 'out' ? snapshot?.outOfStock : value === 'low' ? snapshot?.lowStock : undefined
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filters.stockStatus === value}
                      onClick={() => {
                        setPage(1)
                        setFilters((prev) => ({ ...prev, stockStatus: value }))
                      }}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                        filters.stockStatus === value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                      {count !== undefined && count > 0 && (
                        <span className={cn('tabular-nums', filters.stockStatus === value ? 'opacity-80' : 'text-foreground')}>{count.toLocaleString()}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

          {/* Tabla */}
            {/* La tabla de siete columnas resolvia el celular con scroll
                horizontal. En movil se cambia por tarjetas, que es el patron
                que ya usaba la pestaña de Alertas dentro de esta misma
                pantalla. */}
            {catalogView === 'grid' ? (
              !loading && products.length === 0 ? (
                hasCatalogFilters ? (
                  <EmptyState
                    icon={Package}
                    title="No hay resultados"
                    description="Probá con otros términos o quitá los filtros aplicados."
                    action={{ label: 'Limpiar filtros', onClick: clearCatalogFilters, icon: RotateCcw }}
                    className="py-14"
                  />
                ) : (
                  <CatalogFirstSteps
                    categories={categories.length}
                    suppliers={suppliers.length}
                    onAddSupplier={() => changeTab('suppliers')}
                    onAddProduct={() => {
                      setActionError('')
                      setIsAddDialogOpen(true)
                    }}
                  />
                )
              ) : (
                <CatalogProductGrid
                  products={products}
                  loading={loading}
                  onEdit={openEditDialog}
                  onStock={(product) => openStockMovement({ id: product.id, name: product.name })}
                  onVariants={(product) => openEditDialog(product, 'variants')}
                  onDelete={(product) => { setSelectedProduct(product); setIsDeleteDialogOpen(true) }}
                />
              )
            ) : (
            <>
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
                        {!hasCatalogFilters ? (
                          <CatalogFirstSteps
                            categories={categories.length}
                            suppliers={suppliers.length}
                            onAddSupplier={() => changeTab('suppliers')}
                            onAddProduct={() => {
                              setActionError('')
                              setIsAddDialogOpen(true)
                            }}
                          />
                        ) : (
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
                        )}
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
                                onClick={() => openEditDialog(product, 'variants')}
                                title="Gestionar variantes"
                                aria-label={`Gestionar variantes de ${product.name}`}
                              >
                                <Layers className="h-3.5 w-3.5 text-purple-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/20"
                                onClick={() => openStockMovement({ id: product.id, name: product.name })}
                                title="Registrar movimiento de stock"
                                aria-label={`Registrar movimiento de ${product.name}`}
                              >
                                <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
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
              {!loading && products.length === 0 && !hasCatalogFilters && (
                <CatalogFirstSteps
                  categories={categories.length}
                  suppliers={suppliers.length}
                  onAddSupplier={() => changeTab('suppliers')}
                  onAddProduct={() => {
                    setActionError('')
                    setIsAddDialogOpen(true)
                  }}
                />
              )}
              {!loading && products.length === 0 && hasCatalogFilters && (
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
                        className="h-8 flex-1 rounded-lg text-xs"
                        onClick={() => openStockMovement({ id: product.id, name: product.name })}
                      >
                        <PackagePlus className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Stock
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => openEditDialog(product, 'variants')}
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
            </>
            )}
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
          <InventoryCategoriesPanel
            uncategorized={snapshot?.health?.issues.missing_category ?? null}
            onShowProducts={(categoryId) => {
              setPage(1)
              setFilters((current) => ({ ...current, search: '', category: categoryId, stockStatus: 'all' }))
              changeTab('products')
            }}
            onOpenSample={openSample}
            onChanged={() => void refreshCategories()}
          />
        </TabsContent>

        <TabsContent value="variants">
          <VariantsOverview onEditVariants={(productId) => void openVariantEditor(productId)} refreshKey={productSaves} />
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
          <StockControl key={restock?.nonce ?? 'stock'} restock={restock} />
        </TabsContent>

        <TabsContent value="movements">
          <StockMovements />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <InventoryAlertsPanel
            branchName={snapshot?.branchScoped ? selectedBranch?.name : null}
            onRestock={(productId, productName) => {
              // Reponer es registrar una entrada de mercadería. Antes abría la
              // edición del producto, y si no estaba en la página cargada lo
              // buscaba por su id en el buscador, que no encontraba nada.
              openStockMovement({ id: productId, name: productName ?? '' })
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
        initialTab={modalTab}
        product={(selectedProduct as unknown as import('@/types/products').Product) || null}
        isOpen={isAddDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false)
          setIsEditDialogOpen(false)
          setSelectedProduct(null)
          setModalTab('basic')
        }}
        categories={categories as unknown as import('@/types/products').Category[]}
        brands={[]}
        suppliers={suppliers as unknown as import('@/types/products').Supplier[]}
        onSave={async (productData) => {
          if (isEditDialogOpen && selectedProduct) {
            const result = await updateProduct(selectedProduct.id, productData as unknown as Parameters<typeof updateProduct>[1])
            if (!result.success) throw new Error(result.error || 'No fue posible actualizar el producto')
            setSuccessMessage('Producto actualizado correctamente')
            setProductSaves((count) => count + 1)
          } else {
            const result = await createProduct(productData as unknown as Parameters<typeof createProduct>[0])
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

    </div>
  )
}


