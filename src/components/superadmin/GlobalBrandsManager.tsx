'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Loader2, Plus, RefreshCw, Search, Tag, Trash2 } from 'lucide-react'
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

export function GlobalBrandsManager() {
  const [brands, setBrands] = useState<GlobalBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/global-brands', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar el catálogo.')
      setBrands(payload.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return brands
    return brands.filter((brand) =>
      brand.name.toLowerCase().includes(needle) ||
      (brand.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle))
    )
  }, [brands, search])

  const stats = useMemo(() => ({
    total: brands.length,
    activas: brands.filter((b) => b.is_active).length,
    conLogo: brands.filter((b) => b.logo_url).length,
    vinculadas: brands.reduce((sum, b) => sum + (b.linked_count ?? 0), 0),
  }), [brands])

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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-50">
            <Tag className="h-6 w-6 text-violet-400" />
            Catálogo global de marcas
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            El logo oficial de cada marca. Las empresas eligen de esta lista; las marcas propias van sin logo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualizar
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
          { label: 'Activas', value: stats.activas },
          { label: 'Con logo oficial', value: stats.conLogo },
          { label: 'Usadas por empresas', value: stats.vinculadas },
        ].map((cell) => (
          <div key={cell.label} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">{cell.label}</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-slate-100">{cell.value}</dd>
          </div>
        ))}
      </dl>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o alias"
          className="border-slate-800 bg-slate-900/60 pl-9 text-slate-100"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center">
          <p className="font-medium text-slate-200">
            {brands.length === 0 ? 'El catálogo está vacío' : 'Ninguna marca coincide'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {brands.length === 0
              ? 'Agregá las marcas que venden las empresas, con su logo oficial.'
              : 'Probá con otro nombre.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          {visible.map((brand) => (
            <li key={brand.id} className="flex flex-wrap items-center gap-3 bg-slate-900/40 px-4 py-3">
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-1" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-slate-300">
                  {brand.name.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                  {brand.name}
                  {brand.logo_url && <BadgeCheck className="h-4 w-4 text-emerald-400" aria-label="Con logo oficial" />}
                  {!brand.is_active && (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">De baja</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
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
                {brand.is_active && (
                  <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300" onClick={() => void deactivate(brand)}>
                    <Trash2 className="h-4 w-4" />
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
                <Input id="gb-logo" value={draft.logo_url} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} placeholder="https://…" />
                <p className="text-xs text-muted-foreground">Tiene que estar alojado en un origen permitido por la plataforma.</p>
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
