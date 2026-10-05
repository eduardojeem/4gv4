'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  CornerDownRight,
  Edit,
  Eye,
  EyeOff,
  FolderTree,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCategories, type Category } from '@/hooks/useCategories'
import { CategoryModal } from '@/components/categories/CategoryModal'
import type { InventoryIssueSample } from '@/lib/inventory/inventory-health'

type CategoryNode = { category: Category; children: Category[] }

/** Raíces y sus subcategorías, cada nivel por nombre. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'es')
  const ids = new Set(categories.map((category) => category.id))
  // Una subcategoría cuyo padre no está (borrado o filtrado) se muestra como raíz.
  const roots = categories.filter((category) => !category.parent_id || !ids.has(category.parent_id)).sort(byName)
  return roots.map((category) => ({
    category,
    children: categories.filter((child) => child.parent_id === category.id).sort(byName),
  }))
}

/**
 * Categorías dentro de Inventario, con el mismo hook y el mismo formulario que
 * /dashboard/categories: crear, renombrar, ocultar o borrar acá se ve igual
 * allá, en el catálogo y en la tienda.
 */
export function InventoryCategoriesPanel({
  uncategorized,
  onShowProducts,
  onOpenSample,
  onChanged,
}: {
  /** Productos sin categoría, del diagnóstico del inventario. */
  uncategorized?: { count: number; samples: InventoryIssueSample[] } | null
  onShowProducts: (categoryId: string) => void
  onOpenSample: (sample: InventoryIssueSample) => void
  /** Avisa al catálogo para que recargue sus filtros de categoría. */
  onChanged: () => void
}) {
  const { categories, loading, capabilities, createCategory, updateCategory, deleteCategory } = useCategories()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ category?: Category; parentId: string | null } | null>(null)
  const [saving, setSaving] = useState(false)

  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tree
    return tree
      .map(({ category, children }) => {
        const matchesParent = category.name.toLowerCase().includes(term)
        const matchingChildren = children.filter((child) => child.name.toLowerCase().includes(term))
        return matchesParent ? { category, children } : { category, children: matchingChildren }
      })
      .filter(({ category, children }) => category.name.toLowerCase().includes(term) || children.length > 0)
  }, [tree, search])

  const totalProducts = categories.reduce((sum, category) => sum + Number(category.products_count ?? 0), 0)
  const emptyCategories = categories.filter((category) => !Number(category.products_count ?? 0)).length

  const submit = async (data: { name: string; description: string; parent_id: string | null; global_category_id: string | null; is_active: boolean }) => {
    setSaving(true)
    try {
      const result = modal?.category ? await updateCategory(modal.category.id, data) : await createCategory(data)
      if (!result.success) {
        toast.error(result.error || 'No se pudo guardar la categoría')
        return
      }
      toast.success(modal?.category ? 'Categoría actualizada' : 'Categoría creada')
      setModal(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (category: Category) => {
    const result = await updateCategory(category.id, { is_active: !category.is_active })
    if (!result.success) toast.error(result.error || 'No se pudo cambiar la visibilidad')
    else {
      toast.success(category.is_active ? 'Categoría oculta en la tienda' : 'Categoría visible')
      onChanged()
    }
  }

  const remove = async (category: Category) => {
    if (!window.confirm(`¿Eliminar «${category.name}»?`)) return
    const result = await deleteCategory(category.id)
    if (!result.success) toast.error(result.error || 'No se pudo eliminar')
    else {
      toast.success('Categoría eliminada')
      onChanged()
    }
  }

  const row = (category: Category, child = false) => {
    const count = Number(category.products_count ?? 0)
    const hidden = category.is_active === false
    return (
      <div key={category.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5', child && 'bg-muted/20 pl-10')}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {child ? (
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FolderTree className="h-4 w-4" /></span>
          )}
          <div className="min-w-0">
            <p className={cn('truncate text-sm', hidden ? 'text-muted-foreground line-through' : 'text-foreground')}>{category.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {count === 0 ? 'Sin productos' : `${count} ${count === 1 ? 'producto' : 'productos'}`}
              {hidden && ' · oculta en la tienda'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onShowProducts(category.id)}>
              <Package className="h-3.5 w-3.5" /> Ver productos
            </Button>
          )}
          {!child && capabilities.canCreate && (
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Agregar subcategoría" aria-label={`Agregar subcategoría a ${category.name}`} onClick={() => setModal({ parentId: category.id })}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          {capabilities.canUpdate && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" title={hidden ? 'Mostrar en la tienda' : 'Ocultar en la tienda'} aria-label={`${hidden ? 'Mostrar' : 'Ocultar'} ${category.name}`} onClick={() => void toggleActive(category)}>
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" aria-label={`Editar ${category.name}`} onClick={() => setModal({ category, parentId: category.parent_id ?? null })}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {capabilities.canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title={count > 0 ? 'Tiene productos: movelos antes de eliminarla' : 'Eliminar'}
              aria-label={`Eliminar ${category.name}`}
              disabled={count > 0}
              onClick={() => void remove(category)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FolderTree className="h-4 w-4 text-primary" /> Categorías
            </h3>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              Ordenan el catálogo, los filtros, los reportes y las secciones de tu tienda. Podés anidar una subcategoría
              («Fundas» dentro de «Accesorios»). Ocultar una categoría la saca de la tienda sin tocar sus productos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/dashboard/categories">Vista avanzada <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Button>
            {capabilities.canCreate && (
              <Button size="sm" className="gap-1.5" onClick={() => setModal({ parentId: null })}>
                <Plus className="h-3.5 w-3.5" /> Nueva categoría
              </Button>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Categorías', value: categories.length },
            { label: 'Productos clasificados', value: totalProducts },
            { label: 'Sin productos', value: emptyCategories },
            { label: 'Productos sin categoría', value: uncategorized?.count ?? '—', warn: Boolean(uncategorized?.count) },
          ].map(({ label, value, warn }) => (
            <div key={label} className={cn('rounded-xl bg-muted/40 p-3', warn && 'bg-amber-500/10')}>
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className={cn('text-lg font-semibold tabular-nums', warn ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>{value}</dd>
            </div>
          ))}
        </dl>

        {uncategorized && uncategorized.count > 0 && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs text-foreground">
              Estos productos no aparecen en los filtros por categoría ni en las secciones de la tienda. Abrilos y asignales una:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {uncategorized.samples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onOpenSample(sample)}
                  className="max-w-52 truncate rounded-full border bg-background px-2.5 py-0.5 text-[11px] text-foreground hover:border-primary/40"
                >
                  {sample.name}
                </button>
              ))}
              {uncategorized.count > uncategorized.samples.length && (
                <span className="px-1 py-0.5 text-[11px] text-muted-foreground">y {uncategorized.count - uncategorized.samples.length} más</span>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-3">
          <div className="relative sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar categoría" className="h-9 pl-9 text-sm" />
          </div>
        </div>
        {loading && categories.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando categorías…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center">
            <FolderTree className="mx-auto h-7 w-7 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-foreground">{search ? 'Ninguna categoría coincide' : 'Todavía no hay categorías'}</p>
            {!search && capabilities.canCreate && (
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => setModal({ parentId: null })}>
                <Plus className="h-3.5 w-3.5" /> Crear la primera
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {visible.map(({ category, children }) => (
              <div key={category.id}>
                {row(category)}
                {children.map((child) => row(child, true))}
              </div>
            ))}
          </div>
        )}
      </section>

      {modal && (
        <CategoryModal
          isOpen
          onClose={() => setModal(null)}
          onSubmit={submit}
          category={modal.category}
          categories={categories}
          loading={saving}
          initialParentId={modal.parentId}
        />
      )}
    </div>
  )
}

export default InventoryCategoriesPanel
