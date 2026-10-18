'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Link2, Loader2, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { normalizeCategoryName, type GlobalCategory } from '@/lib/categories/global-catalog'
import { planGlobalImport, withAncestors, type LocalCategory } from '@/lib/categories/global-import'
import { cn } from '@/lib/utils'

interface GlobalCategoryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: GlobalCategory[]
  catalogLoading: boolean
  localCategories: LocalCategory[]
  onImported: () => void
}

/** Profundidad de cada categoría en el árbol global, para sangrarla. */
function depthOf(category: GlobalCategory, byId: Map<string, GlobalCategory>): number {
  let depth = 0
  let current = category.parent_id ? byId.get(category.parent_id) : undefined
  const seen = new Set<string>()
  while (current && !seen.has(current.id) && depth < 6) {
    seen.add(current.id)
    depth += 1
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return depth
}

/**
 * Elegir categorías del catálogo global y agregarlas a la tienda, ya vinculadas
 * al marketplace y con su misma estructura.
 */
export function GlobalCategoryImportDialog({
  open,
  onOpenChange,
  catalog,
  catalogLoading,
  localCategories,
  onImported,
}: GlobalCategoryImportDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const byId = useMemo(() => new Map(catalog.map((category) => [category.id, category])), [catalog])
  const linkedGlobalIds = useMemo(
    () => new Set(localCategories.map((category) => category.global_category_id).filter(Boolean) as string[]),
    [localCategories]
  )
  const localNames = useMemo(
    () => new Map(localCategories.map((category) => [normalizeCategoryName(category.name), category])),
    [localCategories]
  )

  // Al buscar se muestran las que coinciden y sus padres, para no perder el contexto.
  const visible = useMemo(() => {
    const term = normalizeCategoryName(search)
    if (!term) return catalog
    const matches = catalog.filter((category) =>
      [category.name, ...(category.aliases ?? [])].some((value) => normalizeCategoryName(value).includes(term))
    )
    const keep = new Set(withAncestors(matches.map((category) => category.id), catalog).map((category) => category.id))
    return catalog.filter((category) => keep.has(category.id))
  }, [catalog, search])

  const plan = useMemo(
    () => (selected.size > 0 ? planGlobalImport([...selected], catalog, localCategories) : []),
    [selected, catalog, localCategories]
  )
  const toCreate = plan.filter((step) => step.kind === 'create').length
  const toLink = plan.filter((step) => step.kind === 'link').length
  const addedParents = plan.filter((step) => step.kind !== 'present' && !selected.has(step.globalId)).length

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const close = (next: boolean) => {
    if (saving) return
    if (!next) {
      setSelected(new Set())
      setSearch('')
    }
    onOpenChange(next)
  }

  const handleImport = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/categories/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalCategoryIds: [...selected] }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudieron agregar las categorías.')
      const parts = [
        payload.created ? `${payload.created} creada${payload.created === 1 ? '' : 's'}` : '',
        payload.linked ? `${payload.linked} vinculada${payload.linked === 1 ? '' : 's'}` : '',
      ].filter(Boolean)
      toast.success('Categorías agregadas del catálogo', { description: parts.join(' · ') || 'Ya estaban todas en tu tienda.' })
      setSelected(new Set())
      setSearch('')
      onImported()
      onOpenChange(false)
    } catch (error) {
      toast.error('No se pudieron agregar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Agregar desde el catálogo
          </DialogTitle>
          <DialogDescription>
            Categorías del catálogo de tu rubro. Se crean en tu tienda con la misma estructura y ya vinculadas al marketplace. Después podés renombrarlas.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en el catálogo…"
            className="pl-9"
            aria-label="Buscar en el catálogo"
          />
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto rounded-lg border">
          {catalogLoading ? (
            <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando el catálogo…
            </p>
          ) : catalog.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Todavía no hay categorías en el catálogo para tu rubro.
            </p>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Ninguna categoría coincide con la búsqueda.</p>
          ) : (
            <ul className="divide-y" role="list">
              {visible.map((category) => {
                const present = linkedGlobalIds.has(category.id)
                const sameName = !present ? localNames.get(normalizeCategoryName(category.name)) : undefined
                const willLink = sameName && !sameName.global_category_id
                const checkboxId = `global-cat-${category.id}`
                return (
                  <li key={category.id}>
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50',
                        present && 'cursor-default opacity-70'
                      )}
                      style={{ paddingLeft: `${12 + depthOf(category, byId) * 20}px` }}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={present || selected.has(category.id)}
                        disabled={present || saving}
                        onCheckedChange={(checked) => toggle(category.id, checked === true)}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                      {present ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Ya en tu tienda
                        </Badge>
                      ) : willLink ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Link2 className="h-3 w-3" aria-hidden="true" />
                          Se vincula «{sameName.name}»
                        </Badge>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground" role="status">
          {selected.size === 0
            ? 'Elegí las categorías que querés agregar.'
            : [
                toCreate ? `Se crean ${toCreate}` : '',
                toLink ? `se vinculan ${toLink} que ya tenías` : '',
                addedParents ? `incluye ${addedParents} categoría${addedParents === 1 ? '' : 's'} padre` : '',
              ].filter(Boolean).join(' · ') + '.'}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleImport()} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Agregar {selected.size > 0 ? selected.size : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
