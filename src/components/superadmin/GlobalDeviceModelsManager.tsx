'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Plus, RefreshCw, RotateCcw, Search, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { DEVICE_TYPES, DEVICE_TYPE_LABEL, type DeviceModelCandidate, type DeviceType, type GlobalDeviceModel } from '@/lib/devices/global-models'
import { CatalogDeactivateDialog, CatalogStats } from './CatalogDeactivateDialog'

/**
 * Catálogo global de modelos de equipos.
 *
 * Lo que se carga acá aparece como sugerencia de marca y modelo en los
 * productos y las reparaciones de todas las tiendas, después de lo que cada
 * tienda ya usa.
 */

type Row = GlobalDeviceModel & { stores: number }

type Draft = {
  id?: string
  global_brand_id: string
  brand: string
  model: string
  device_type: DeviceType
  aliases: string
  release_year: string
  is_active: boolean
}

const EMPTY_DRAFT: Draft = { global_brand_id: '', brand: '', model: '', device_type: 'smartphone', aliases: '', release_year: '', is_active: true }

type Filter = 'all' | 'used' | 'unused' | 'inactive'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'used', label: 'Usados' },
  { id: 'unused', label: 'Sin uso' },
  { id: 'inactive', label: 'De baja' },
]

function CandidatesPanel({
  candidates,
  total,
  busy,
  onImport,
}: {
  candidates: DeviceModelCandidate[]
  total: number
  busy: boolean
  onImport: (entries: DeviceModelCandidate[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const keyOf = (candidate: DeviceModelCandidate) => `${candidate.brand}|${candidate.model}`

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return candidates.filter((candidate) => !needle || `${candidate.brand} ${candidate.model}`.toLowerCase().includes(needle))
  }, [candidates, query])

  if (candidates.length === 0) return null

  const toggle = (candidate: DeviceModelCandidate) => setSelected((current) => {
    const next = new Set(current)
    const key = keyOf(candidate)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const chosen = candidates.filter((candidate) => selected.has(keyOf(candidate)))

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-sky-600" aria-hidden="true" />
            {total} modelo{total === 1 ? '' : 's'} que ya usan las tiendas y el catálogo no tiene
          </h2>
          <p className="text-xs text-muted-foreground">Salen de sus productos y reparaciones. Los más usados, primero.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? 'Ocultar' : 'Revisar'}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar marca o modelo" className="h-9 bg-background pl-9" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(visible.map(keyOf)))}>Elegir los {visible.length} visibles</Button>
            {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Quitar selección</Button>}
            <Button size="sm" className="ml-auto gap-1.5" disabled={busy || chosen.length === 0} onClick={() => onImport(chosen)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Sumar {chosen.length || ''} al catálogo
            </Button>
          </div>
          <ul className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((candidate) => (
              <li key={keyOf(candidate)}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted/50">
                  <input type="checkbox" className="h-4 w-4" checked={selected.has(keyOf(candidate))} onChange={() => toggle(candidate)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{candidate.brand} {candidate.model}</span>
                    <span className="text-xs text-muted-foreground">
                      {candidate.stores} tienda{candidate.stores === 1 ? '' : 's'} · {candidate.uses} uso{candidate.uses === 1 ? '' : 's'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {total > candidates.length && (
            <p className="text-xs text-muted-foreground">Se muestran los {candidates.length} más usados de {total}.</p>
          )}
        </div>
      )}
    </section>
  )
}

export function GlobalDeviceModelsManager() {
  const [models, setModels] = useState<Row[]>([])
  const [candidates, setCandidates] = useState<DeviceModelCandidate[]>([])
  const [candidatesTotal, setCandidatesTotal] = useState(0)
  const [storesUsing, setStoresUsing] = useState(0)
  // Marcas del catálogo de Marcas: la marca del equipo se elige de ahí.
  const [catalogBrands, setCatalogBrands] = useState<Array<{ id: string; name: string; logo_url: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toDeactivate, setToDeactivate] = useState<Row | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/global-device-models', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (payload?.missingTable) {
        setMissingTable(true)
        return
      }
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar el catálogo.')
      setMissingTable(false)
      setModels(payload.data ?? [])
      setCandidates(payload.candidates ?? [])
      setCandidatesTotal(payload.candidatesTotal ?? 0)
      setStoresUsing(payload.storesUsing ?? 0)
      setCatalogBrands(payload.brands ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const brands = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of models) if (model.is_active) counts.set(model.brand, (counts.get(model.brand) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [models])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return models.filter((model) => {
      if (brandFilter && model.brand !== brandFilter) return false
      if (needle && ![model.brand, model.model, ...(model.aliases ?? [])].some((value) => value.toLowerCase().includes(needle))
        && !`${model.brand} ${model.model}`.toLowerCase().includes(needle)) return false
      if (filter === 'used') return model.is_active && model.stores > 0
      if (filter === 'unused') return model.is_active && model.stores === 0
      if (filter === 'inactive') return !model.is_active
      return true
    })
  }, [models, search, brandFilter, filter])

  const catalogBrandByName = useMemo(
    () => new Map(catalogBrands.map((brand) => [brand.name.toLocaleLowerCase('es'), brand])),
    [catalogBrands],
  )

  const grouped = useMemo(() => {
    const groups = new Map<string, Row[]>()
    for (const model of visible) groups.set(model.brand, [...(groups.get(model.brand) ?? []), model])
    return [...groups.entries()]
  }, [visible])

  const save = async () => {
    if (!draft) return
    const year = draft.release_year.trim() ? Number(draft.release_year) : null
    const body = {
      ...(draft.id ? { id: draft.id } : {}),
      global_brand_id: draft.global_brand_id,
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      device_type: draft.device_type,
      aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
      release_year: Number.isFinite(year) ? year : null,
      is_active: draft.is_active,
    }
    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/global-device-models', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(draft.id ? 'Modelo actualizado' : 'Modelo agregado al catálogo')
      setDraft(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const importCandidates = async (entries: DeviceModelCandidate[]) => {
    setImporting(true)
    try {
      const response = await fetch('/api/superadmin/global-device-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', entries: entries.map(({ brand, model }) => ({ brand, model })) }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        const failed = Array.isArray(payload?.failed) ? payload.failed.length : 0
        throw new Error(failed > 0 ? `${failed} candidato${failed === 1 ? '' : 's'} no tiene una marca global activa; no se importó ninguno.` : payload?.error || 'No se pudo sumar.')
      }
      toast.success(`${payload.created} modelo${payload.created === 1 ? '' : 's'} sumado${payload.created === 1 ? '' : 's'} al catálogo`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo sumar.')
    } finally {
      setImporting(false)
    }
  }

  const setActive = async (model: Row, active: boolean) => {
    if (!active) setDeactivating(true)
    try {
      const response = active
        ? await fetch('/api/superadmin/global-device-models', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: model.id, is_active: true }),
        })
        : await fetch(`/api/superadmin/global-device-models?id=${model.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(active ? `${model.brand} ${model.model} vuelve al catálogo` : `${model.brand} ${model.model} deja de sugerirse`)
      setToDeactivate(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setDeactivating(false)
    }
  }

  const activeCount = models.filter((model) => model.is_active).length
  const usedCount = models.filter((model) => model.is_active && model.stores > 0).length

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/superadmin/catalogs" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:underline">Catálogos globales</Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Smartphone className="h-6 w-6 text-emerald-500" />
            Modelos de equipos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Marcas y modelos (iPhone 13, Galaxy A15…) que se sugieren en los productos y las reparaciones de todas las tiendas, después de los que cada tienda ya usa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button onClick={() => {
            const selectedBrand = catalogBrands.find((brand) => brand.name === brandFilter)
            setDraft({ ...EMPTY_DRAFT, global_brand_id: selectedBrand?.id ?? '', brand: selectedBrand?.name ?? '' })
          }} className="gap-1.5" disabled={missingTable}>
            <Plus className="h-4 w-4" />
            Nuevo modelo
          </Button>
        </div>
      </header>

      {missingTable ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          La tabla de modelos todavía no existe. Ejecutá en Supabase el SQL <code className="rounded bg-background/60 px-1">20261003120000_global_device_models.sql</code> y actualizá.
        </div>
      ) : (
        <>
          <CatalogStats
            cells={[
              { label: 'En el catálogo', value: activeCount, hint: `${brands.length} marca${brands.length === 1 ? '' : 's'}` },
              { label: 'Usados', value: usedCount, hint: 'por al menos una tienda' },
              { label: 'Tiendas', value: storesUsing, hint: 'cargan marca y modelo' },
              { label: 'Por sumar', value: candidatesTotal, hint: 'ya los usan las tiendas', warn: candidatesTotal > 0 },
            ]}
          />

          <CandidatesPanel candidates={candidates} total={candidatesTotal} busy={importing} onImport={(entries) => void importCandidates(entries)} />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar marca, modelo o alias" className="pl-9" />
              </div>
              <div role="tablist" aria-label="Filtrar modelos" className="flex flex-wrap gap-1.5">
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
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{visible.length} de {models.length}</span>
            </div>
            {brands.length > 1 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por marca">
                <button
                  type="button"
                  onClick={() => setBrandFilter(null)}
                  aria-pressed={brandFilter === null}
                  className={cn('rounded-md border px-2 py-0.5 text-xs', brandFilter === null ? 'border-foreground/40 bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted/60')}
                >
                  Todas las marcas
                </button>
                {brands.map(([brand, count]) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setBrandFilter(brandFilter === brand ? null : brand)}
                    aria-pressed={brandFilter === brand}
                    className={cn('rounded-md border px-2 py-0.5 text-xs', brandFilter === brand ? 'border-foreground/40 bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted/60')}
                  >
                    {brand} <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo…</p>
          ) : grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="font-medium text-foreground">{models.length === 0 ? 'El catálogo está vacío' : 'Ningún modelo coincide'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {models.length === 0
                  ? candidatesTotal > 0 ? 'Empezá sumando los que ya usan las tiendas, desde el cuadro de arriba.' : 'Agregá los modelos que más se venden y reparan.'
                  : 'Probá con otra búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([brand, rows]) => (
                <section key={brand} className="overflow-hidden rounded-xl border border-border">
                  <h2 className="flex items-center gap-2 bg-muted/40 px-4 py-2 text-sm font-bold text-foreground">
                    {catalogBrandByName.get(brand.toLocaleLowerCase('es'))?.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={catalogBrandByName.get(brand.toLocaleLowerCase('es'))!.logo_url!} alt="" className="h-5 w-5 rounded bg-white object-contain" />
                    )}
                    <span className="flex-1">{brand}</span>
                    {!catalogBrandByName.has(brand.toLocaleLowerCase('es')) && (
                      <Link href="/superadmin/brands" className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        No está en Marcas
                      </Link>
                    )}
                    <span className="text-xs font-normal text-muted-foreground">{rows.length} modelo{rows.length === 1 ? '' : 's'}</span>
                  </h2>
                  <ul className="divide-y divide-border">
                    {rows.map((model) => (
                      <li key={model.id} className="flex flex-wrap items-center gap-3 bg-card px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                            {model.model}
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{DEVICE_TYPE_LABEL[model.device_type] ?? model.device_type}</span>
                            {model.release_year && <span className="text-xs font-normal text-muted-foreground">{model.release_year}</span>}
                            {!model.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">De baja</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {model.stores > 0 ? `${model.stores} tienda${model.stores === 1 ? '' : 's'}` : 'Sin uso todavía'}
                            {(model.aliases?.length ?? 0) > 0 && ` · también: ${model.aliases!.join(', ')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDraft({
                              id: model.id,
                              global_brand_id: model.global_brand_id ?? '',
                              brand: model.brand,
                              model: model.model,
                              device_type: model.device_type,
                              aliases: (model.aliases ?? []).join(', '),
                              release_year: model.release_year ? String(model.release_year) : '',
                              is_active: model.is_active,
                            })}
                          >
                            Editar
                          </Button>
                          {model.is_active ? (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToDeactivate(model)} aria-label={`Dar de baja ${model.brand} ${model.model}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => void setActive(model, true)} aria-label={`Reactivar ${model.brand} ${model.model}`}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <CatalogDeactivateDialog
        item={toDeactivate ? {
          name: `${toDeactivate.brand} ${toDeactivate.model}`,
          consequence: toDeactivate.stores > 0
            ? `Deja de sugerirse. Las ${toDeactivate.stores} tienda${toDeactivate.stores === 1 ? '' : 's'} que ya lo usan lo siguen viendo porque está en sus productos o reparaciones.`
            : 'Deja de sugerirse en todas las tiendas.',
        } : null}
        busy={deactivating}
        onCancel={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && void setActive(toDeactivate, false)}
      />

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar modelo' : 'Nuevo modelo'}</DialogTitle>
            <DialogDescription>Se sugiere en productos y reparaciones de todas las tiendas.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dm-brand">Marca *</Label>
                  <select
                    id="dm-brand"
                    value={draft.global_brand_id}
                    onChange={(event) => {
                      const brand = catalogBrands.find((item) => item.id === event.target.value)
                      setDraft({ ...draft, global_brand_id: event.target.value, brand: brand?.name ?? '' })
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Elegí una marca</option>
                    {catalogBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dm-model">Modelo *</Label>
                  <Input id="dm-model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="Galaxy A15" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dm-type">Tipo</Label>
                  <select
                    id="dm-type"
                    value={draft.device_type}
                    onChange={(e) => setDraft({ ...draft, device_type: e.target.value as DeviceType })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DEVICE_TYPES.map((type) => <option key={type} value={type}>{DEVICE_TYPE_LABEL[type]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dm-year">Año de lanzamiento</Label>
                  <Input id="dm-year" type="number" min={1990} max={2100} value={draft.release_year} onChange={(e) => setDraft({ ...draft, release_year: e.target.value })} placeholder="2023" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dm-aliases">También se escribe</Label>
                <Input id="dm-aliases" value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} placeholder="A15, SM-A155" />
                <p className="text-xs text-muted-foreground">Separados por coma. Así se reconoce lo que ya cargaron las tiendas con otro nombre.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4" />
                Sugerir a las tiendas
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving || !draft?.global_brand_id || !draft?.model.trim()} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
