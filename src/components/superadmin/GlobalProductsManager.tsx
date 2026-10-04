'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Barcode,
  Check,
  ChevronDown,
  Copy,
  Download,
  FolderTree,
  ImageOff,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Store,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { GlobalProductCandidate } from '@/lib/products/barcode-catalog'
import { groupGlobalProducts, type ProductGroupView } from '@/lib/products/global-product-groups'
import { CatalogDeactivateDialog } from './CatalogDeactivateDialog'
import { GlobalProductStats } from './global-products/GlobalProductStats'
import { BarcodeSimulatorDialog } from './global-products/BarcodeSimulatorDialog'
import { GlobalProductCandidates } from './global-products/GlobalProductCandidates'
import { GlobalProductFormDialog, type GlobalProductDraft } from './global-products/GlobalProductFormDialog'
import { CATALOG_STATUS_LABEL, type CatalogStatus } from '@/lib/catalog/editorial-status'

/**
 * Catálogo global de productos por código de barras. Sirve a todos los rubros:
 * cuando una tienda escanea un código que está acá, el formulario de producto
 * se completa solo y usa esta foto en vez de subir otra.
 */

type GlobalProduct = {
  id: string
  gtin: string
  name: string
  brand_name: string | null
  global_brand_id: string | null
  global_category_id: string | null
  description: string | null
  image_url: string | null
  is_active: boolean
  catalog_status?: CatalogStatus
  stores: number
}

type Option = { id: string; name: string; parent_id?: string | null; sort_order?: number | null }

type ExtendedView = ProductGroupView | 'grid'

const VIEWS: Array<{ id: ExtendedView; label: string; icon: React.ElementType }> = [
  { id: 'category', label: 'Por categoría', icon: FolderTree },
  { id: 'brand', label: 'Por marca', icon: Tag },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'grid', label: 'Cuadrícula', icon: LayoutGrid },
]

/** «Accesorios › Cargadores»: el nombre de la categoría con su madre. */
function categoryLabels(categories: Option[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return new Map(
    categories.map((category) => {
      const parent = category.parent_id ? byId.get(category.parent_id) : undefined
      return [category.id, parent ? `${parent.name} › ${category.name}` : category.name]
    }),
  )
}

const EMPTY_DRAFT: GlobalProductDraft = {
  gtin: '',
  name: '',
  brand_name: '',
  global_brand_id: '',
  global_category_id: '',
  description: '',
  image_url: '',
  is_active: true,
}

type Filter = 'all' | 'no-category' | 'no-brand' | 'no-image' | 'used' | 'inactive' | 'candidate' | 'review' | 'published'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'candidate', label: 'Candidatos' },
  { id: 'review', label: 'En revisión' },
  { id: 'published', label: 'Publicados' },
  { id: 'used', label: 'Usados en tiendas' },
  { id: 'no-category', label: 'Sin categoría' },
  { id: 'no-brand', label: 'Sin marca' },
  { id: 'no-image', label: 'Sin foto' },
  { id: 'inactive', label: 'De baja' },
]

type SortOption = 'stores-desc' | 'name-asc' | 'name-desc' | 'gtin-asc'

function Thumb({ url, className }: { url: string | null; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn('h-11 w-11 shrink-0 rounded-xl bg-white border object-contain p-1 shadow-xs', className)}
    />
  ) : (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground/60 border border-dashed',
        className,
      )}
      title="Sin foto"
    >
      <ImageOff className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

export function GlobalProductsManager() {
  const [products, setProducts] = useState<GlobalProduct[]>([])
  const [candidates, setCandidates] = useState<GlobalProductCandidate[]>([])
  const [candidatesTotal, setCandidatesTotal] = useState(0)
  const [productsWithBarcode, setProductsWithBarcode] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [metrics, setMetrics] = useState({ active: 0, used: 0, uncategorized: 0, unbranded: 0, withoutImage: 0, inactive: 0 })
  const [brands, setBrands] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('stores-desc')
  const [draft, setDraft] = useState<GlobalProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toDeactivate, setToDeactivate] = useState<GlobalProduct | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [view, setView] = useState<ExtendedView>('category')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkBrand, setBulkBrand] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [simulatorOpen, setSimulatorOpen] = useState(false)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('status')
    if (FILTERS.some((item) => item.id === requested)) setFilter(requested as Filter)
  }, [])

  // La vista elegida se recuerda en este navegador.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('superadmin:global-products:view') as ExtendedView | null
      if (stored === 'category' || stored === 'brand' || stored === 'list' || stored === 'grid') {
        setView(stored)
      }
    } catch {
      /* sin almacenamiento: queda la vista por defecto */
    }
  }, [])

  const chooseView = (next: ExtendedView) => {
    setView(next)
    setCollapsed(new Set())
    try {
      localStorage.setItem('superadmin:global-products:view', next)
    } catch {
      /* no pasa nada */
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        q: search,
        status: selectedBrandFilter === 'none' ? 'no-brand' : selectedCategoryFilter === 'none' ? 'no-category' : filter,
        sort: sortBy === 'stores-desc' ? 'usage_desc' : sortBy === 'name-desc' ? 'name_desc' : 'name',
        page: String(page),
        pageSize: '50',
      })
      if (selectedBrandFilter !== 'all' && selectedBrandFilter !== 'none') params.set('brand', selectedBrandFilter)
      if (selectedCategoryFilter !== 'all' && selectedCategoryFilter !== 'none') params.set('category', selectedCategoryFilter)
      const response = await fetch(`/api/superadmin/global-products?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (payload?.missingTable) {
        setMissingTable(true)
        return
      }
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar el catálogo.')
      setMissingTable(false)
      setProducts(payload.data ?? [])
      setCandidates(payload.candidates ?? [])
      setCandidatesTotal(payload.candidatesTotal ?? 0)
      setProductsWithBarcode(payload.productsWithBarcode ?? 0)
      setTotal(payload.total ?? 0)
      setMetrics((current) => ({ ...current, ...(payload.metrics ?? {}) }))
      setBrands(payload.brands ?? [])
      setCategories(payload.categories ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setLoading(false)
    }
  }, [filter, page, search, selectedBrandFilter, selectedCategoryFilter, sortBy])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => { setPage(1) }, [filter, search, selectedBrandFilter, selectedCategoryFilter, sortBy])

  const brandName = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands])
  const categoryName = useMemo(() => categoryLabels(categories), [categories])

  const optionName = useCallback(
    (kind: 'brand' | 'category', id: string | null) =>
      id ? (kind === 'brand' ? brandName : categoryName).get(id) ?? null : null,
    [brandName, categoryName],
  )

  const categoryOptions = useMemo(
    () =>
      [...categories].sort((a, b) =>
        (categoryName.get(a.id) ?? a.name).localeCompare(categoryName.get(b.id) ?? b.name, 'es'),
      ),
    [categories, categoryName],
  )

  const active = useMemo(() => products.filter((p) => p.is_active), [products])
  const used = useMemo(() => active.filter((p) => p.stores > 0), [active])
  const noCat = useMemo(() => active.filter((p) => !p.global_category_id), [active])
  const noBrand = useMemo(() => active.filter((p) => !p.global_brand_id), [active])

  // Filtrado y búsqueda
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const result = products.filter((product) => {
      // Búsqueda por texto libre
      if (needle) {
        const brandStr = optionName('brand', product.global_brand_id) ?? product.brand_name ?? ''
        const categoryStr = optionName('category', product.global_category_id) ?? ''
        const matches = [product.name, product.gtin, brandStr, categoryStr].some((v) =>
          v.toLowerCase().includes(needle),
        )
        if (!matches) return false
      }

      // Filtro de estado / clasificación
      if (filter === 'no-category' && (!product.is_active || product.global_category_id)) return false
      if (filter === 'no-brand' && (!product.is_active || product.global_brand_id)) return false
      if (filter === 'no-image' && (!product.is_active || product.image_url)) return false
      if (filter === 'used' && (!product.is_active || product.stores <= 0)) return false
      if (filter === 'inactive' && product.is_active) return false
      if (filter === 'candidate' && product.catalog_status !== 'candidate') return false
      if (filter === 'review' && product.catalog_status !== 'review') return false
      if (filter === 'published' && (product.catalog_status ?? (product.is_active ? 'published' : 'inactive')) !== 'published') return false

      // Filtro por marca específica
      if (selectedBrandFilter !== 'all') {
        if (selectedBrandFilter === 'none') {
          if (product.global_brand_id) return false
        } else if (product.global_brand_id !== selectedBrandFilter) {
          return false
        }
      }

      // Filtro por categoría específica
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'none') {
          if (product.global_category_id) return false
        } else if (product.global_category_id !== selectedCategoryFilter) {
          return false
        }
      }

      return true
    })

    // Ordenamiento
    return result.sort((a, b) => {
      if (sortBy === 'stores-desc') return b.stores - a.stores || a.name.localeCompare(b.name, 'es')
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'es')
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'es')
      if (sortBy === 'gtin-asc') return a.gtin.localeCompare(b.gtin)
      return 0
    })
  }, [products, search, filter, selectedBrandFilter, selectedCategoryFilter, sortBy, optionName])

  // Agrupamiento
  const groupViewMode: ProductGroupView = view === 'grid' ? 'list' : view
  const groups = useMemo(
    () => groupGlobalProducts(visible, groupViewMode, categories, brands),
    [visible, groupViewMode, categories, brands],
  )

  const toggleSelected = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const toggleCollapsed = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const selectAllVisible = () => setSelected(new Set(visible.map((p) => p.id)))

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado al portapapeles`)
  }

  /** Exportar catálogo actual a CSV */
  const exportCsv = () => {
    if (visible.length === 0) {
      toast.error('No hay productos para exportar.')
      return
    }

    const headers = [
      'Código GTIN',
      'Nombre',
      'Marca Catálogo',
      'Marca Libre',
      'Categoría',
      'Tiendas que lo usan',
      'Estado',
      'Foto URL',
      'Descripción',
    ]

    const rows = visible.map((p) => [
      `"${p.gtin}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(optionName('brand', p.global_brand_id) ?? '').replace(/"/g, '""')}"`,
      `"${(p.brand_name ?? '').replace(/"/g, '""')}"`,
      `"${(optionName('category', p.global_category_id) ?? '').replace(/"/g, '""')}"`,
      p.stores,
      p.is_active ? 'Activo' : 'De baja',
      `"${(p.image_url ?? '').replace(/"/g, '""')}"`,
      `"${(p.description ?? '').replace(/"/g, '""')}"`,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `catalogo-global-productos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Se exportaron ${visible.length} productos a CSV`)
  }

  /** Asigna la categoría y/o la marca elegidas a todos los seleccionados. */
  const applyBulk = async () => {
    if (selected.size === 0 || (!bulkCategory && !bulkBrand)) return
    setBulkSaving(true)
    try {
      const response = await fetch('/api/superadmin/global-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-update',
          ids: [...selected],
          ...(bulkCategory ? { global_category_id: bulkCategory } : {}),
          ...(bulkBrand ? { global_brand_id: bulkBrand } : {}),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo asignar.')
      const what = [
        bulkCategory && `categoría «${categoryName.get(bulkCategory)}»`,
        bulkBrand && `marca «${brandName.get(bulkBrand)}»`,
      ]
        .filter(Boolean)
        .join(' y ')
      toast.success(`${payload.updated} producto${payload.updated === 1 ? '' : 's'} con ${what}`)
      setSelected(new Set())
      setBulkCategory('')
      setBulkBrand('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo asignar.')
    } finally {
      setBulkSaving(false)
    }
  }

  const saveProduct = async (productDraft: GlobalProductDraft) => {
    const body = {
      ...(productDraft.id ? { id: productDraft.id } : {}),
      gtin: productDraft.gtin.trim(),
      name: productDraft.name.trim(),
      brand_name: productDraft.brand_name.trim() || null,
      global_brand_id: productDraft.global_brand_id || null,
      global_category_id: productDraft.global_category_id || null,
      description: productDraft.description.trim() || null,
      image_url: productDraft.image_url.trim() || null,
      is_active: productDraft.is_active,
    }
    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/global-products', {
        method: productDraft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(productDraft.id ? 'Producto actualizado' : 'Producto agregado al catálogo')
      setDraft(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const importCandidates = async (entries: GlobalProductCandidate[]) => {
    setImporting(true)
    try {
      const response = await fetch('/api/superadmin/global-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', entries }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        const failed = Array.isArray(payload?.failed) ? payload.failed.length : 0
        throw new Error(failed > 0 ? `${failed} candidato${failed === 1 ? '' : 's'} no pasó la validación; no se importó ninguno.` : payload?.error || 'No se pudo sumar.')
      }
      toast.success(
        `${payload.created} producto${payload.created === 1 ? '' : 's'} sumado${payload.created === 1 ? '' : 's'} al catálogo`,
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo sumar.')
    } finally {
      setImporting(false)
    }
  }

  const setStatus = async (product: GlobalProduct, status: CatalogStatus) => {
    if (status === 'inactive') setDeactivating(true)
    try {
      const response = status !== 'inactive'
        ? await fetch('/api/superadmin/global-products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: product.id, catalog_status: status }),
          })
        : await fetch(`/api/superadmin/global-products?id=${product.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(status === 'published' ? `${product.name} fue publicado` : status === 'review' ? `${product.name} quedó listo para revisión` : `${product.name} deja de ofrecerse`)
      setToDeactivate(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Encabezado Principal ── */}
      <header className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 py-0.5 px-2.5 text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                <Barcode className="h-3.5 w-3.5" />
                Catálogo Global EAN/GTIN
              </Badge>
              <span className="text-xs text-muted-foreground">• Todas las tiendas</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              Productos por Código de Barras
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Base oficial de productos empaquetados. Cuando una tienda escanea un código de barras en su POS o inventario, el sistema autocompleta instantáneamente nombre, marca, categoría e imagen oficial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSimulatorOpen(true)}
              className="gap-1.5 rounded-xl border-sky-300 dark:border-sky-800 bg-sky-50/50 hover:bg-sky-100 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300"
            >
              <ScanLine className="h-4 w-4" />
              Probar Escaneo
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={visible.length === 0}
              className="gap-1.5 rounded-xl"
              title="Exportar a archivo CSV (compatible con Excel)"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5 rounded-xl"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>

            <Button
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
              className="gap-1.5 rounded-xl shadow-sm font-semibold"
              disabled={missingTable}
            >
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </header>

      {missingTable ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <h3 className="font-bold text-base mb-1">Tabla del catálogo no encontrada</h3>
          <p>
            La tabla <code className="rounded bg-background/60 px-1 font-mono">global_products</code> todavía no existe. Ejecutá en Supabase el SQL{' '}
            <code className="rounded bg-background/60 px-1 font-mono">20261004120000_global_products.sql</code> y actualizá esta página.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tarjetas de Métricas Interactivas (KPIs) ── */}
          <GlobalProductStats
            activeCount={metrics.active}
            usedCount={metrics.used}
            uncategorizedCount={metrics.uncategorized}
            unbrandedCount={metrics.unbranded}
            candidatesCount={candidatesTotal}
            currentFilter={filter}
            onSelectFilter={(filterId) => setFilter(filterId as Filter)}
          />

          {/* ── Sugerencias de Tiendas (Candidatos) ── */}
          <GlobalProductCandidates
            candidates={candidates}
            total={candidatesTotal}
            busy={importing}
            optionName={optionName}
            onImport={(entries) => void importCandidates(entries)}
          />

          {/* ── Barra de Búsqueda, Filtros y Vistas ── */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Buscador inteligente */}
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, código GTIN, marca o categoría..."
                  className="h-10 pl-10 pr-9 rounded-xl text-sm bg-background border-input"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Selector de Vistas */}
              <div
                role="group"
                aria-label="Cómo ver el catálogo"
                className="flex rounded-xl border bg-muted/50 p-1"
              >
                {VIEWS.map((item) => {
                  const Icon = item.icon
                  const isCurrent = view === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => chooseView(item.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                        isCurrent
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Píldoras de Filtro Rápido */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-border/60">
              <div role="tablist" aria-label="Filtrar productos" className="flex flex-wrap gap-1.5">
                {FILTERS.map((item) => {
                  const isSelected = filter === item.id
                  let count = metrics.active
                  if (item.id === 'used') count = metrics.used
                  else if (item.id === 'no-category') count = metrics.uncategorized
                  else if (item.id === 'no-brand') count = metrics.unbranded
                  else if (item.id === 'no-image') count = metrics.withoutImage
                  else if (item.id === 'inactive') count = metrics.inactive

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setFilter(item.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground border-border/70',
                      )}
                    >
                      <span>{item.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums',
                          isSelected
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Filtros secundarios: marcas / categorías / orden */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filtrar por marca"
                  value={selectedBrandFilter}
                  onChange={(e) => setSelectedBrandFilter(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium text-muted-foreground focus:text-foreground"
                >
                  <option value="all">Todas las marcas</option>
                  <option value="none">Sin marca oficial</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por categoría"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium text-muted-foreground focus:text-foreground"
                >
                  <option value="all">Todas las categorías</option>
                  <option value="none">Sin categoría</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryName.get(c.id) || c.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Ordenar productos"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium text-muted-foreground focus:text-foreground"
                >
                  <option value="stores-desc">Más adoptados</option>
                  <option value="name-asc">Nombre (A-Z)</option>
                  <option value="name-desc">Nombre (Z-A)</option>
                  <option value="gtin-asc">Código GTIN</option>
                </select>

                <span className="text-xs font-bold tabular-nums text-muted-foreground pl-1">
                  {visible.length} en esta página · {total} total
                </span>
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
                <span className="text-xs text-muted-foreground">Página {page}</span>
                <Button variant="outline" size="sm" disabled={page * 50 >= total || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</Button>
              </div>
            </div>
          </div>

          {/* ── Contenido Principal / Listado ── */}
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive"
            >
              {error}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center p-14 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Cargando catálogo global de productos...</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 p-12 text-center bg-card/40">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground/60 mx-auto flex items-center justify-center mb-3">
                <Barcode className="h-6 w-6" />
              </div>
              <p className="font-bold text-base text-foreground">
                {products.length === 0 ? 'El catálogo está vacío' : 'Ningún producto coincide con los filtros'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                {products.length === 0
                  ? candidatesTotal > 0
                    ? 'Podés empezar sumando los productos que ya cargaron las tiendas desde el panel de sugerencias arriba.'
                    : 'Hacé clic en «Nuevo Producto» para registrar la primera ficha oficial por código de barras.'
                  : 'Intentá cambiar los términos de búsqueda o limpiar los filtros seleccionados.'}
              </p>
              {search && (
                <Button variant="outline" size="sm" onClick={() => setSearch('')} className="mt-4 rounded-xl text-xs">
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Barra Flotante de Acciones Masivas ── */}
              {selected.size > 0 && (
                <div className="sticky top-4 z-30 flex flex-wrap items-center gap-2.5 rounded-2xl border border-primary/40 bg-background/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
                  <Badge variant="default" className="text-xs font-bold px-2.5 py-1">
                    {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
                  </Badge>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllVisible}
                    className="h-8 text-xs rounded-lg"
                  >
                    Elegir visibles ({visible.length})
                  </Button>

                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Categoría a asignar"
                      value={bulkCategory}
                      onChange={(event) => setBulkCategory(event.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs max-w-[200px]"
                    >
                      <option value="">Categoría: sin cambios</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {categoryName.get(category.id)}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Marca a asignar"
                      value={bulkBrand}
                      onChange={(event) => setBulkBrand(event.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs max-w-[180px]"
                    >
                      <option value="">Marca: sin cambios</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>

                    <Button
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg font-semibold"
                      disabled={bulkSaving || (!bulkCategory && !bulkBrand)}
                      onClick={() => void applyBulk()}
                    >
                      {bulkSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Asignar
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-8 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSelected(new Set())}
                  >
                    <X className="h-3.5 w-3.5" />
                    Quitar selección
                  </Button>
                </div>
              )}

              {/* ── VISTA CUADRÍCULA (GRID) ── */}
              {view === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {visible.map((product) => {
                    const brand = optionName('brand', product.global_brand_id) ?? product.brand_name
                    const category = optionName('category', product.global_category_id)
                    const isChecked = selected.has(product.id)

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'group relative flex flex-col justify-between rounded-2xl border p-4 bg-card transition-all duration-200 hover:shadow-md hover:border-primary/40',
                          isChecked ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border/80',
                          !product.is_active && 'opacity-65',
                        )}
                      >
                        <div>
                          {/* Image & Badges Stage */}
                          <div className="relative h-40 w-full rounded-xl bg-white border p-2 flex items-center justify-center overflow-hidden mb-3">
                            <input
                              type="checkbox"
                              className="absolute top-2 left-2 z-10 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              aria-label={`Elegir ${product.name}`}
                              checked={isChecked}
                              onChange={(e) => toggleSelected([product.id], e.target.checked)}
                            />

                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full object-contain transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <ImageOff className="h-10 w-10 text-muted-foreground/30" />
                            )}

                            {product.stores > 0 && (
                              <Badge
                                variant="secondary"
                                className="absolute bottom-2 right-2 text-[10px] gap-1 bg-background/90 backdrop-blur-sm shadow-xs border"
                              >
                                <Store className="h-2.5 w-2.5 text-emerald-600" />
                                {product.stores} tienda{product.stores === 1 ? '' : 's'}
                              </Badge>
                            )}
                          </div>

                          {/* Info */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(product.gtin, 'GTIN')}
                                className="font-mono text-[11px] font-bold text-muted-foreground hover:text-foreground bg-muted/60 px-1.5 py-0.5 rounded flex items-center gap-1 group/btn"
                                title="Hacé clic para copiar el código"
                              >
                                {product.gtin}
                                <Copy className="h-2.5 w-2.5 opacity-50 group-hover/btn:opacity-100" />
                              </button>
                              <Badge variant={product.catalog_status === 'inactive' || (!product.catalog_status && !product.is_active) ? 'destructive' : 'outline'} className="text-[10px] py-0 px-1.5 h-4">
                                {CATALOG_STATUS_LABEL[product.catalog_status ?? (product.is_active ? 'published' : 'inactive')]}
                              </Badge>
                            </div>

                            <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug">
                              {product.name}
                            </h3>

                            <div className="flex flex-wrap gap-1 text-[11px]">
                              {brand ? (
                                <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 font-medium text-foreground">
                                  {brand}
                                </span>
                              ) : (
                                <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-medium">
                                  sin marca
                                </span>
                              )}
                              {category ? (
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground truncate max-w-[150px]">
                                  {category}
                                </span>
                              ) : (
                                <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-medium">
                                  sin categoría
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-end gap-1 pt-3 mt-3 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                            onClick={() =>
                              setDraft({
                                id: product.id,
                                gtin: product.gtin,
                                name: product.name,
                                brand_name: product.brand_name ?? '',
                                global_brand_id: product.global_brand_id ?? '',
                                global_category_id: product.global_category_id ?? '',
                                description: product.description ?? '',
                                image_url: product.image_url ?? '',
                                is_active: product.is_active,
                              })
                            }
                          >
                            Editar
                          </Button>
                          {(product.catalog_status ?? (product.is_active ? 'published' : 'inactive')) === 'published' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setToDeactivate(product)}
                              aria-label={`Dar de baja ${product.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => void setStatus(product, (product.catalog_status ?? 'inactive') === 'review' ? 'published' : 'review')}
                              aria-label={(product.catalog_status ?? 'inactive') === 'review' ? `Publicar ${product.name}` : `Enviar ${product.name} a revisión`}
                            >
                              {(product.catalog_status ?? 'inactive') === 'review' ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* ── VISTAS AGRUPADAS (Categoría, Marca, Lista) ── */
                groups.map((group) => {
                  const ids = group.items.map((item) => item.id)
                  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
                  const isCollapsed = collapsed.has(group.key)
                  const showHeader = view !== 'list'

                  return (
                    <section
                      key={group.key}
                      className={cn(
                        'overflow-hidden rounded-2xl border transition-all',
                        group.pending
                          ? 'border-amber-300/80 bg-amber-50/20 dark:border-amber-900/60 dark:bg-amber-950/10'
                          : 'border-border/80 bg-card shadow-xs',
                      )}
                    >
                      {showHeader && (
                        <div
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 border-b transition-colors',
                            group.pending
                              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50'
                              : 'bg-muted/40 border-border/60',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            aria-label={`Elegir todos los de ${group.label}`}
                            checked={allSelected}
                            onChange={(event) => toggleSelected(ids, event.target.checked)}
                          />

                          <button
                            type="button"
                            onClick={() => toggleCollapsed(group.key)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left group"
                            aria-expanded={!isCollapsed}
                          >
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                isCollapsed && '-rotate-90',
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {group.parentLabel && (
                                <span className="font-normal text-muted-foreground">{group.parentLabel} › </span>
                              )}
                              {group.label}
                            </span>
                            <Badge variant="secondary" className="shrink-0 text-xs tabular-nums h-5 px-1.5 font-bold">
                              {group.items.length}
                            </Badge>
                          </button>

                          {group.pending && (
                            <span className="hidden shrink-0 text-xs font-semibold text-amber-700 sm:inline dark:text-amber-400">
                              Pendiente de asignar {view === 'category' ? 'categoría' : 'marca oficial'}
                            </span>
                          )}
                        </div>
                      )}

                      {!isCollapsed && (
                        <ul className="divide-y divide-border/60">
                          {group.items.map((product) => {
                            const brand = optionName('brand', product.global_brand_id) ?? product.brand_name
                            const category = optionName('category', product.global_category_id)
                            const isChecked = selected.has(product.id)

                            return (
                              <li
                                key={product.id}
                                className={cn(
                                  'flex flex-wrap sm:flex-nowrap items-center gap-3.5 px-4 py-3 transition-colors',
                                  isChecked
                                    ? 'bg-primary/5'
                                    : 'bg-card hover:bg-muted/30',
                                  !product.is_active && 'opacity-60',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                                  aria-label={`Elegir ${product.name}`}
                                  checked={isChecked}
                                  onChange={(event) => toggleSelected([product.id], event.target.checked)}
                                />

                                <Thumb url={product.image_url} />

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold text-sm text-foreground truncate max-w-xl">
                                      {product.name}
                                    </p>
                                    <Badge variant={product.catalog_status === 'inactive' || (!product.catalog_status && !product.is_active) ? 'destructive' : 'outline'} className="text-[10px] py-0 px-1.5 h-4">
                                      {CATALOG_STATUS_LABEL[product.catalog_status ?? (product.is_active ? 'published' : 'inactive')]}
                                    </Badge>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(product.gtin, 'Código GTIN')}
                                      className="font-mono text-[11px] bg-muted/70 hover:bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold flex items-center gap-1 group/btn"
                                      title="Hacé clic para copiar el código"
                                    >
                                      {product.gtin}
                                      <Copy className="h-2.5 w-2.5 opacity-50 group-hover/btn:opacity-100" />
                                    </button>

                                    {view !== 'brand' &&
                                      (brand ? (
                                        <span className="font-medium text-foreground/80">• {brand}</span>
                                      ) : (
                                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                                          • sin marca
                                        </span>
                                      ))}

                                    {view !== 'category' &&
                                      (category ? (
                                        <span className="text-muted-foreground">• {category}</span>
                                      ) : (
                                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                                          • sin categoría
                                        </span>
                                      ))}

                                    {!product.image_url && (
                                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                                        • sin foto
                                      </span>
                                    )}

                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal gap-1">
                                      <Store className="h-2.5 w-2.5" />
                                      {product.stores > 0
                                        ? `${product.stores} tienda${product.stores === 1 ? '' : 's'}`
                                        : 'sin uso todavía'}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs font-semibold rounded-lg"
                                    onClick={() =>
                                      setDraft({
                                        id: product.id,
                                        gtin: product.gtin,
                                        name: product.name,
                                        brand_name: product.brand_name ?? '',
                                        global_brand_id: product.global_brand_id ?? '',
                                        global_category_id: product.global_category_id ?? '',
                                        description: product.description ?? '',
                                        image_url: product.image_url ?? '',
                                        is_active: product.is_active,
                                      })
                                    }
                                  >
                                    Editar
                                  </Button>
                                  {(product.catalog_status ?? (product.is_active ? 'published' : 'inactive')) === 'published' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                                      onClick={() => setToDeactivate(product)}
                                      aria-label={`Dar de baja ${product.name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                                      onClick={() => void setStatus(product, (product.catalog_status ?? 'inactive') === 'review' ? 'published' : 'review')}
                                      aria-label={(product.catalog_status ?? 'inactive') === 'review' ? `Publicar ${product.name}` : `Enviar ${product.name} a revisión`}
                                    >
                                      {(product.catalog_status ?? 'inactive') === 'review' ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                                    </Button>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </section>
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      {/* ── Dialogo de Confirmación para dar de baja ── */}
      <CatalogDeactivateDialog
        item={
          toDeactivate
            ? {
                name: toDeactivate.name,
                consequence:
                  'Deja de ofrecerse al escanear su código. Los productos que las tiendas ya cargaron no cambian.',
              }
            : null
        }
        busy={deactivating}
        onCancel={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && void setStatus(toDeactivate, 'inactive')}
      />

      {/* ── Modal Moderno de Alta / Edición de Producto ── */}
      <GlobalProductFormDialog
        open={draft !== null}
        draft={draft}
        saving={saving}
        brands={brands}
        categoryOptions={categoryOptions}
        categoryName={categoryName}
        onClose={() => setDraft(null)}
        onSave={saveProduct}
      />

      {/* ── Simulador de Escaneo y Comprobación de Códigos ── */}
      <BarcodeSimulatorDialog
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        products={products}
        brandName={brandName}
        categoryName={categoryName}
        onEditProduct={(p) =>
          setDraft({
            id: p.id,
            gtin: p.gtin,
            name: p.name,
            brand_name: p.brand_name ?? '',
            global_brand_id: p.global_brand_id ?? '',
            global_category_id: p.global_category_id ?? '',
            description: p.description ?? '',
            image_url: p.image_url ?? '',
            is_active: p.is_active,
          })
        }
      />
    </div>
  )
}
