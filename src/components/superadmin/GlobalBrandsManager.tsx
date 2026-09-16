'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, ImageOff, Link2, Loader2, Plus, RefreshCw, RotateCcw, Search, Tag, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Catálogo global de marcas.
 *
 * El logo de una marca es un dato de la plataforma: el marketplace agrupa las
 * marcas por nombre y antes mostraba la primera imagen que cargara cualquier
 * empresa. Acá se define el logo oficial una sola vez.
 */

type GlobalBrand = {
  id: string
  name: string
  slug: string
  aliases: string[] | null
  logo_url: string | null
  website: string | null
  description: string | null
  is_active: boolean
  linked_count?: number
}

type Draft = {
  id?: string
  name: string
  aliases: string
  logo_url: string
  website: string
  description: string
  is_active: boolean
}

const EMPTY_DRAFT: Draft = { name: '', aliases: '', logo_url: '', website: '', description: '', is_active: true }

type Filter = 'all' | 'active' | 'no-logo' | 'inactive'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'no-logo', label: 'Sin logo' },
  { id: 'inactive', label: 'De baja' },
]

export function GlobalBrandsManager() {
  const [brands, setBrands] = useState<GlobalBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [linking, setLinking] = useState(false)
  const [summary, setSummary] = useState({ tenantTotal: 0, tenantLinked: 0, pendingLinks: 0 })
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/global-brands', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar el catálogo.')
      setBrands(payload.data ?? [])
      setSummary({
        tenantTotal: payload.tenantTotal ?? 0,
        tenantLinked: payload.tenantLinked ?? 0,
        pendingLinks: payload.pendingLinks ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return brands.filter((brand) => {
      const matchesSearch = !needle ||
        brand.name.toLowerCase().includes(needle) ||
        (brand.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle))
      if (!matchesSearch) return false
      if (filter === 'active') return brand.is_active
      if (filter === 'inactive') return !brand.is_active
      if (filter === 'no-logo') return !brand.logo_url
      return true
    })
  }, [brands, search, filter])

  const stats = useMemo(() => ({
    total: brands.length,
    sinLogo: brands.filter((b) => !b.logo_url).length,
    marcasEmpresas: summary.tenantTotal,
    vinculadas: summary.tenantLinked,
  }), [brands, summary])

  /**
   * Sube el logo al almacenamiento de la plataforma.
   *
   * Pegar una dirección dejaba el logo colgando de un servidor ajeno: si esa
   * imagen cambiaba, cambiaba el logo de la marca en todo el marketplace.
   */
  const uploadLogo = async (file: File) => {
    if (!draft) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('name', draft.name || 'marca')
      const response = await fetch('/api/superadmin/global-brands/logo', { method: 'POST', body })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo subir el logo.')
      setDraft((current) => (current ? { ...current, logo_url: payload.url } : current))
      toast.success('Logo subido')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir el logo.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const save = async () => {
    if (!draft) return
    const body = {
      ...(draft.id ? { id: draft.id } : {}),
      name: draft.name.trim(),
      aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
      logo_url: draft.logo_url.trim() || null,
      website: draft.website.trim() || null,
      description: draft.description.trim() || null,
      is_active: draft.is_active,
    }

    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/global-brands', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar la marca.')
      toast.success(draft.id ? 'Marca actualizada' : 'Marca agregada al catálogo')
      setDraft(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la marca.')
    } finally {
      setSaving(false)
    }
  }

  /** Vincula por nombre las marcas de empresas que hoy están sueltas. */
  const linkExisting = async () => {
    setLinking(true)
    try {
      const response = await fetch('/api/superadmin/global-brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link-existing' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo vincular.')
      toast.success(payload.linked > 0
        ? `${payload.linked} marca${payload.linked === 1 ? '' : 's'} de empresas vinculada${payload.linked === 1 ? '' : 's'}`
        : 'No había marcas para vincular por nombre')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo vincular.')
    } finally {
      setLinking(false)
    }
  }

  const reactivate = async (brand: GlobalBrand) => {
    try {
      const response = await fetch('/api/superadmin/global-brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: brand.id, is_active: true }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo reactivar.')
      toast.success(`${brand.name} vuelve al catálogo`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo reactivar.')
    }
  }

  const deactivate = async (brand: GlobalBrand) => {
    try {
      const response = await fetch(`/api/superadmin/global-brands?id=${brand.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo dar de baja.')
      toast.success(`${brand.name} queda fuera del catálogo`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo dar de baja.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Tag className="h-6 w-6 text-violet-400" />
            Catálogo global de marcas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            El logo oficial de cada marca. Las empresas eligen de esta lista; las marcas propias van sin logo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            onClick={() => void linkExisting()}
            disabled={linking || summary.pendingLinks === 0}
            className="gap-1.5"
            title="Vincula por nombre las marcas de empresas que todavía no están en el catálogo"
          >
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular por nombre ({summary.pendingLinks})
          </Button>
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva marca
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'En el catálogo', value: stats.total },
          { label: 'Sin logo oficial', value: stats.sinLogo, warn: stats.sinLogo > 0 },
          { label: 'Marcas de empresas', value: stats.marcasEmpresas },
          { label: 'Vinculadas', value: stats.vinculadas },
        ].map((cell) => (
          <div key={cell.label} className="rounded-xl border bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{cell.label}</dt>
            <dd className={cn('mt-0.5 text-xl font-bold tabular-nums', cell.warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o alias"
            className="pl-9"
          />
        </div>
        <div role="tablist" aria-label="Filtrar marcas" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === item.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{visible.length} de {brands.length}</span>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">
            {brands.length === 0 ? 'El catálogo está vacío' : 'Ninguna marca coincide'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {brands.length === 0
              ? 'Agregá las marcas que venden las empresas, con su logo oficial.'
              : 'Probá con otro nombre.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {visible.map((brand) => (
            <li key={brand.id} className="flex flex-wrap items-center gap-3 bg-card px-4 py-3">
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="" className="h-10 w-10 rounded-lg bg-background object-contain p-1" />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  title="Sin logo oficial: en el marketplace se muestra la inicial"
                >
                  <ImageOff className="h-4 w-4" aria-hidden="true" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {brand.name}
                  {brand.logo_url && <BadgeCheck className="h-4 w-4 text-emerald-400" aria-label="Con logo oficial" />}
                  {!brand.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">De baja</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {brand.slug}
                  {(brand.aliases?.length ?? 0) > 0 && ` · alias: ${brand.aliases!.join(', ')}`}
                  {` · ${brand.linked_count ?? 0} empresa${(brand.linked_count ?? 0) === 1 ? '' : 's'}`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft({
                    id: brand.id,
                    name: brand.name,
                    aliases: (brand.aliases ?? []).join(', '),
                    logo_url: brand.logo_url ?? '',
                    website: brand.website ?? '',
                    description: brand.description ?? '',
                    is_active: brand.is_active,
                  })}
                >
                  Editar
                </Button>
                {brand.is_active ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void deactivate(brand)}
                    aria-label={`Dar de baja ${brand.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => void reactivate(brand)} aria-label={`Reactivar ${brand.name}`}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar marca del catálogo' : 'Nueva marca del catálogo'}</DialogTitle>
            <DialogDescription>
              El nombre y el logo que se guardan acá son los que ven todas las empresas y el marketplace.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gb-name">Nombre *</Label>
                <Input id="gb-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Samsung" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gb-aliases">Alias</Label>
                <Input
                  id="gb-aliases"
                  value={draft.aliases}
                  onChange={(e) => setDraft({ ...draft, aliases: e.target.value })}
                  placeholder="Samsung Electronics, SAMSUNG"
                />
                <p className="text-xs text-muted-foreground">Separados por coma. Sirven para encontrarla al escribir.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gb-logo">Logo oficial (URL)</Label>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
                    {draft.logo_url.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.logo_url.trim()} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <Input id="gb-logo" value={draft.logo_url} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} placeholder="Subí un archivo o pegá una dirección" />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadLogo(file)
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading} className="gap-1.5">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploading ? 'Subiendo…' : 'Subir logo'}
                      </Button>
                      {draft.logo_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, logo_url: '' })}>
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP, AVIF o SVG, hasta 2 MB. Sin logo, la marca se muestra con su inicial.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gb-website">Sitio</Label>
                <Input id="gb-website" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://samsung.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gb-desc">Descripción</Label>
                <Textarea id="gb-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                Disponible para las empresas
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving || !draft?.name.trim()} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
