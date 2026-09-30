'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Barcode, ImageOff, Loader2, Plus, RefreshCw, RotateCcw, Search, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { GlobalProductCandidate } from '@/lib/products/barcode-catalog'
import { CatalogDeactivateDialog, CatalogStats } from './CatalogDeactivateDialog'

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
  stores: number
}

type Option = { id: string; name: string }

type Draft = {
  id?: string
  gtin: string
  name: string
  brand_name: string
  global_brand_id: string
  global_category_id: string
  description: string
  image_url: string
  is_active: boolean
}

const EMPTY_DRAFT: Draft = { gtin: '', name: '', brand_name: '', global_brand_id: '', global_category_id: '', description: '', image_url: '', is_active: true }

type Filter = 'all' | 'used' | 'no-image' | 'inactive'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'used', label: 'Usados' },
  { id: 'no-image', label: 'Sin foto' },
  { id: 'inactive', label: 'De baja' },
]

function Thumb({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" title="Sin foto">
      <ImageOff className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

function CandidatesPanel({
  candidates,
  total,
  busy,
  optionName,
  onImport,
}: {
  candidates: GlobalProductCandidate[]
  total: number
  busy: boolean
  optionName: (kind: 'brand' | 'category', id: string | null) => string | null
  onImport: (entries: GlobalProductCandidate[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  if (candidates.length === 0) return null

  const toggle = (gtin: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(gtin)) next.delete(gtin)
    else next.add(gtin)
    return next
  })
  const chosen = candidates.filter((candidate) => selected.has(candidate.gtin))

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-sky-600" aria-hidden="true" />
            {total} producto{total === 1 ? '' : 's'} con código del fabricante que el catálogo no tiene
          </h2>
          <p className="text-xs text-muted-foreground">
            Los cargaron las tiendas. Se propone el nombre, la marca y la categoría que más repiten; los que usan más tiendas, primero.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>{open ? 'Ocultar' : 'Revisar'}</Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(candidates.map((candidate) => candidate.gtin)))}>Elegir todos</Button>
            {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Quitar selección</Button>}
            <Button size="sm" className="ml-auto gap-1.5" disabled={busy || chosen.length === 0} onClick={() => onImport(chosen)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Sumar {chosen.length || ''} al catálogo
            </Button>
          </div>
          <ul className="max-h-96 space-y-1.5 overflow-y-auto">
            {candidates.map((candidate) => (
              <li key={candidate.gtin}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted/50">
                  <input type="checkbox" className="h-4 w-4" checked={selected.has(candidate.gtin)} onChange={() => toggle(candidate.gtin)} />
                  <Thumb url={candidate.imageUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {candidate.gtin}
                      {' · '}{[optionName('brand', candidate.globalBrandId) ?? candidate.brandName, optionName('category', candidate.globalCategoryId)].filter(Boolean).join(' · ') || 'sin marca ni categoría'}
                      {candidate.otherNames.length > 0 && ` · también: ${candidate.otherNames.join(', ')}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{candidate.stores} tienda{candidate.stores === 1 ? '' : 's'}</span>
                </label>
              </li>
            ))}
          </ul>
          {total > candidates.length && <p className="text-xs text-muted-foreground">Se muestran los {candidates.length} más usados de {total}.</p>}
        </div>
      )}
    </section>
  )
}

export function GlobalProductsManager() {
  const [products, setProducts] = useState<GlobalProduct[]>([])
  const [candidates, setCandidates] = useState<GlobalProductCandidate[]>([])
  const [candidatesTotal, setCandidatesTotal] = useState(0)
  const [productsWithBarcode, setProductsWithBarcode] = useState(0)
  const [brands, setBrands] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toDeactivate, setToDeactivate] = useState<GlobalProduct | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/global-products', { cache: 'no-store' })
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
      setBrands(payload.brands ?? [])
      setCategories(payload.categories ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const brandName = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands])
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  const optionName = (kind: 'brand' | 'category', id: string | null) => (id ? (kind === 'brand' ? brandName : categoryName).get(id) ?? null : null)

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products.filter((product) => {
      if (needle && ![product.name, product.gtin, product.brand_name ?? '', optionName('brand', product.global_brand_id) ?? ''].some((value) => value.toLowerCase().includes(needle))) return false
      if (filter === 'used') return product.is_active && product.stores > 0
      if (filter === 'no-image') return product.is_active && !product.image_url
      if (filter === 'inactive') return !product.is_active
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, filter, brandName])

  const save = async () => {
    if (!draft) return
    const body = {
      ...(draft.id ? { id: draft.id } : {}),
      gtin: draft.gtin.trim(),
      name: draft.name.trim(),
      brand_name: draft.brand_name.trim() || null,
      global_brand_id: draft.global_brand_id || null,
      global_category_id: draft.global_category_id || null,
      description: draft.description.trim() || null,
      image_url: draft.image_url.trim() || null,
      is_active: draft.is_active,
    }
    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/global-products', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(draft.id ? 'Producto actualizado' : 'Producto agregado al catálogo')
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
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo sumar.')
      toast.success(`${payload.created} producto${payload.created === 1 ? '' : 's'} sumado${payload.created === 1 ? '' : 's'} al catálogo`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo sumar.')
    } finally {
      setImporting(false)
    }
  }

  const setActive = async (product: GlobalProduct, active: boolean) => {
    if (!active) setDeactivating(true)
    try {
      const response = active
        ? await fetch('/api/superadmin/global-products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: product.id, is_active: true }) })
        : await fetch(`/api/superadmin/global-products?id=${product.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(active ? `${product.name} vuelve al catálogo` : `${product.name} deja de ofrecerse`)
      setToDeactivate(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setDeactivating(false)
    }
  }

  const active = products.filter((product) => product.is_active)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Catálogos globales</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Barcode className="h-6 w-6 text-sky-500" />
            Productos por código de barras
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Una ficha por código del fabricante, para todos los rubros. Cuando una tienda escanea un código que está acá, el formulario se completa solo (nombre, marca, categoría y foto) y la tienda solo carga precio y stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })} className="gap-1.5" disabled={missingTable}>
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        </div>
      </header>

      {missingTable ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          La tabla del catálogo todavía no existe. Ejecutá en Supabase el SQL <code className="rounded bg-background/60 px-1">20261004120000_global_products.sql</code> y actualizá. Mientras tanto, al escanear las tiendas igual reciben el aviso de código repetido.
        </div>
      ) : (
        <>
          <CatalogStats
            cells={[
              { label: 'En el catálogo', value: active.length, hint: 'fichas activas' },
              { label: 'Usados', value: active.filter((product) => product.stores > 0).length, hint: 'por al menos una tienda' },
              { label: 'Sin foto', value: active.filter((product) => !product.image_url).length, hint: 'se completan sin foto', warn: active.some((product) => !product.image_url) },
              { label: 'Por sumar', value: candidatesTotal, hint: `de ${productsWithBarcode} productos con código`, warn: candidatesTotal > 0 },
            ]}
          />

          <CandidatesPanel candidates={candidates} total={candidatesTotal} busy={importing} optionName={optionName} onImport={(entries) => void importCandidates(entries)} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, marca o código" className="pl-9" />
            </div>
            <div role="tablist" aria-label="Filtrar productos" className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    filter === item.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{visible.length} de {products.length}</span>
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo…</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="font-medium text-foreground">{products.length === 0 ? 'El catálogo está vacío' : 'Ningún producto coincide'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {products.length === 0
                  ? candidatesTotal > 0 ? 'Empezá sumando los que ya cargaron las tiendas, desde el cuadro de arriba.' : 'Agregá los productos envasados que más se venden.'
                  : 'Probá con otra búsqueda.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {visible.map((product) => (
                <li key={product.id} className="flex flex-wrap items-center gap-3 bg-card px-4 py-3">
                  <Thumb url={product.image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                      {product.name}
                      {!product.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">De baja</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{product.gtin}</span>
                      {[optionName('brand', product.global_brand_id) ?? product.brand_name, optionName('category', product.global_category_id)].filter(Boolean).map((value) => ` · ${value}`).join('')}
                      {` · ${product.stores > 0 ? `${product.stores} tienda${product.stores === 1 ? '' : 's'}` : 'sin uso todavía'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft({
                        id: product.id,
                        gtin: product.gtin,
                        name: product.name,
                        brand_name: product.brand_name ?? '',
                        global_brand_id: product.global_brand_id ?? '',
                        global_category_id: product.global_category_id ?? '',
                        description: product.description ?? '',
                        image_url: product.image_url ?? '',
                        is_active: product.is_active,
                      })}
                    >
                      Editar
                    </Button>
                    {product.is_active ? (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToDeactivate(product)} aria-label={`Dar de baja ${product.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => void setActive(product, true)} aria-label={`Reactivar ${product.name}`}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <CatalogDeactivateDialog
        item={toDeactivate ? {
          name: toDeactivate.name,
          consequence: 'Deja de ofrecerse al escanear su código. Los productos que las tiendas ya cargaron no cambian.',
        } : null}
        busy={deactivating}
        onCancel={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && void setActive(toDeactivate, false)}
      />

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar producto del catálogo' : 'Nuevo producto del catálogo'}</DialogTitle>
            <DialogDescription>Estos datos completan el formulario de cualquier tienda que escanee el código.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gp-gtin">Código *</Label>
                  <Input id="gp-gtin" inputMode="numeric" value={draft.gtin} onChange={(e) => setDraft({ ...draft, gtin: e.target.value })} placeholder="7891000315507" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gp-name">Nombre *</Label>
                  <Input id="gp-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nescafé Tradición 170 g" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gp-brand">Marca del catálogo</Label>
                  <select id="gp-brand" value={draft.global_brand_id} onChange={(e) => setDraft({ ...draft, global_brand_id: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Sin marca del catálogo</option>
                    {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gp-category">Categoría</Label>
                  <select id="gp-category" value={draft.global_category_id} onChange={(e) => setDraft({ ...draft, global_category_id: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Sin categoría</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
              </div>
              {!draft.global_brand_id && (
                <div className="space-y-1.5">
                  <Label htmlFor="gp-brand-name">Marca (texto)</Label>
                  <Input id="gp-brand-name" value={draft.brand_name} onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })} placeholder="Si la marca no está en el catálogo de marcas" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="gp-image">Foto (URL)</Label>
                <div className="flex items-center gap-3">
                  <Thumb url={draft.image_url.trim() || null} />
                  <Input id="gp-image" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…/storage/v1/object/public/…" />
                </div>
                <p className="text-xs text-muted-foreground">Tiene que estar alojada en la plataforma. Al sumar desde las tiendas se usa la foto que ya cargaron.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gp-desc">Descripción</Label>
                <Textarea id="gp-desc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4" />
                Ofrecer al escanear
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving || !draft?.gtin.trim() || !draft?.name.trim()} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
