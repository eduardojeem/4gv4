'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CornerDownRight, FolderTree, Link2, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Taxonomía global de categorías.
 *
 * Cada empresa nombra sus categorías como quiere; el marketplace las agrupa por
 * la global. Acá se define esa taxonomía y se vinculan las que están sueltas.
 */

type GlobalCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  level: number | null
  aliases: string[] | null
  icon: string | null
  sort_order: number | null
  is_active: boolean
  linked_count?: number
}

type Draft = {
  id?: string
  name: string
  parent_id: string
  aliases: string
  description: string
  sort_order: string
  is_active: boolean
}

const EMPTY_DRAFT: Draft = { name: '', parent_id: '', aliases: '', description: '', sort_order: '0', is_active: true }

export function GlobalCategoriesManager() {
  const [categories, setCategories] = useState<GlobalCategory[]>([])
  const [summary, setSummary] = useState({ tenantTotal: 0, tenantLinked: 0, pendingLinks: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/global-categories', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo cargar la taxonomía.')
      setCategories(payload.data ?? [])
      setSummary({
        tenantTotal: payload.tenantTotal ?? 0,
        tenantLinked: payload.tenantLinked ?? 0,
        pendingLinks: payload.pendingLinks ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la taxonomía.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const parents = useMemo(() => categories.filter((category) => !category.parent_id), [categories])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return categories
    return categories.filter((category) =>
      category.name.toLowerCase().includes(needle) ||
      (category.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle))
    )
  }, [categories, search])

  const save = async () => {
    if (!draft) return
    const body = {
      ...(draft.id ? { id: draft.id } : {}),
      name: draft.name.trim(),
      parent_id: draft.parent_id || null,
      aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
      description: draft.description.trim() || null,
      sort_order: Number(draft.sort_order) || 0,
      is_active: draft.is_active,
    }

    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/global-categories', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo guardar.')
      toast.success(draft.id ? 'Categoría actualizada' : 'Categoría agregada')
      setDraft(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const linkExisting = async () => {
    setLinking(true)
    try {
      const response = await fetch('/api/superadmin/global-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link-existing' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo vincular.')
      toast.success(payload.linked > 0
        ? `${payload.linked} categoría${payload.linked === 1 ? '' : 's'} de empresas vinculada${payload.linked === 1 ? '' : 's'}`
        : 'No había categorías para vincular por nombre')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo vincular.')
    } finally {
      setLinking(false)
    }
  }

  const deactivate = async (category: GlobalCategory) => {
    try {
      const response = await fetch(`/api/superadmin/global-categories?id=${category.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo dar de baja.')
      toast.success(`${category.name} queda fuera de la taxonomía`)
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
            <FolderTree className="h-6 w-6 text-sky-400" />
            Categorías globales
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            La taxonomía con la que el marketplace agrupa las categorías de todas las empresas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button variant="outline" onClick={() => void linkExisting()} disabled={linking || summary.pendingLinks === 0} className="gap-1.5">
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular por nombre ({summary.pendingLinks})
          </Button>
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva categoría
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'En la taxonomía', value: categories.length },
          { label: 'Activas', value: categories.filter((c) => c.is_active).length },
          { label: 'Categorías de empresas', value: summary.tenantTotal },
          { label: 'Vinculadas', value: summary.tenantLinked },
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
        <div role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">{error}</div>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando taxonomía…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center">
          <p className="font-medium text-slate-200">
            {categories.length === 0 ? 'La taxonomía está vacía' : 'Ninguna categoría coincide'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          {visible.map((category) => (
            <li key={category.id} className="flex flex-wrap items-center gap-3 bg-slate-900/40 px-4 py-3">
              {category.parent_id && <CornerDownRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />}
              <div className={cn('min-w-0 flex-1', category.parent_id && 'pl-1')}>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-100">
                  {category.name}
                  {!category.is_active && (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">De baja</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {category.slug}
                  {(category.aliases?.length ?? 0) > 0 && ` · alias: ${category.aliases!.join(', ')}`}
                  {` · ${category.linked_count ?? 0} categoría${(category.linked_count ?? 0) === 1 ? '' : 's'} de empresas`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft({
                    id: category.id,
                    name: category.name,
                    parent_id: category.parent_id ?? '',
                    aliases: (category.aliases ?? []).join(', '),
                    description: category.description ?? '',
                    sort_order: String(category.sort_order ?? 0),
                    is_active: category.is_active,
                  })}
                >
                  Editar
                </Button>
                {category.is_active && (
                  <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300" onClick={() => void deactivate(category)}>
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
            <DialogTitle>{draft?.id ? 'Editar categoría global' : 'Nueva categoría global'}</DialogTitle>
            <DialogDescription>
              Con estas categorías el marketplace agrupa las de todas las empresas.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gc-name">Nombre *</Label>
                <Input id="gc-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Celulares" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gc-parent">Categoría madre</Label>
                <select
                  id="gc-parent"
                  value={draft.parent_id}
                  onChange={(e) => setDraft({ ...draft, parent_id: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sin madre (categoría principal)</option>
                  {parents.filter((parent) => parent.id !== draft.id).map((parent) => (
                    <option key={parent.id} value={parent.id}>{parent.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gc-aliases">Alias</Label>
                <Input
                  id="gc-aliases"
                  value={draft.aliases}
                  onChange={(e) => setDraft({ ...draft, aliases: e.target.value })}
                  placeholder="Telefonía, Teléfonos, Smartphones"
                />
                <p className="text-xs text-muted-foreground">
                  Separados por coma. Con esto se vinculan las categorías que las empresas nombran distinto.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gc-order">Orden</Label>
                  <Input id="gc-order" type="number" min={0} value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4" />
                  Activa
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gc-desc">Descripción</Label>
                <Textarea id="gc-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
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
