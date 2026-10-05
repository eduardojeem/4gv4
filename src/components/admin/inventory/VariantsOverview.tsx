'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Layers, Loader2, Package, RefreshCw, Search, ShoppingCart, Tag, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import type { VariantIssue, VariantProductSummary } from '@/lib/inventory/variant-sync'
import { VariantManager } from '@/components/admin/inventory/VariantManager'

const ISSUE_TEXT: Record<VariantIssue, string> = {
  not_in_branch: 'Sin stock cargado en esta sucursal: el POS no la deja cobrar',
  price_mismatch: 'Precio distinto al del producto: el POS bloquea la venta',
  out_of_stock: 'Agotada en esta sucursal',
  inactive: 'Inactiva',
}

/**
 * Variantes de todo el catálogo y si se pueden vender. Se editan desde la ficha
 * del producto, que es la que crea su stock por sucursal y su movimiento inicial.
 */
export function VariantsOverview({
  onEditVariants,
  refreshKey = 0,
}: {
  onEditVariants: (productId: string) => void
  /** Cambia cuando se guardó un producto, para volver a revisar. */
  refreshKey?: number
}) {
  const { selectedBranchId, selectedBranch } = useBranch()
  const [state, setState] = useState<{ key: string; products: VariantProductSummary[]; error: string | null } | null>(null)
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const requestKey = `${selectedBranchId ?? 'default'}:${refreshKey}:${reload}`

  useEffect(() => {
    let cancelled = false
    fetch('/api/inventory/variants', { cache: 'no-store', headers: branchHeaders(selectedBranchId) })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || !body?.success) {
          setState({ key: requestKey, products: [], error: body?.error ?? 'No se pudieron revisar las variantes.' })
          return
        }
        setState({ key: requestKey, products: body.data.products ?? [], error: null })
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, products: [], error: 'No se pudieron revisar las variantes.' })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, selectedBranchId])

  const loading = state?.key !== requestKey
  const products = useMemo(() => state?.products ?? [], [state])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter(({ product, variants }) =>
      product.name.toLowerCase().includes(term)
      || (product.sku ?? '').toLowerCase().includes(term)
      || variants.some((variant) => variant.name.toLowerCase().includes(term) || (variant.sku ?? '').toLowerCase().includes(term)))
  }, [products, search])

  const blocked = products.reduce((sum, item) => sum + item.issues.not_in_branch + item.issues.price_mismatch, 0)
  const totalVariants = products.reduce((sum, item) => sum + item.variants.length, 0)
  const branchName = selectedBranch?.name || 'la sucursal principal'

  return (
    <div className="space-y-5">
      {/* Cómo funcionan */}
      <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="variants-how-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="variants-how-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Layers className="h-4 w-4 text-primary" /> Cómo funcionan las variantes
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Talle, color o capacidad de un mismo producto. Se crean y editan desde la ficha del producto, en el paso «Variantes».
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Revisar
          </Button>
        </div>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { icon: CheckCircle2, title: 'Activa', text: 'Solo las variantes activas aparecen en el punto de venta y la tienda.' },
            { icon: Warehouse, title: 'Con stock en la sucursal', text: `Cada variante lleva su stock en cada sucursal. Ahora estás viendo ${branchName}.` },
            { icon: Tag, title: 'Mismo precio que el producto', text: 'El POS cobra el precio del producto: si una variante tiene otro, bloquea la venta.' },
          ].map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="flex gap-2.5 rounded-xl bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs text-muted-foreground">{index + 1}</span>
              <div>
                <p className="flex items-center gap-1.5 text-sm text-foreground"><Icon className="h-3.5 w-3.5 text-primary" /> {title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Estado de las variantes */}
      <section className="rounded-2xl border bg-card" aria-labelledby="variants-status-title">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 id="variants-status-title" className="text-sm font-semibold text-foreground">Productos con variantes</h3>
            <p className="text-xs text-muted-foreground">
              {loading
                ? 'Revisando…'
                : `${products.length} productos · ${totalVariants} variantes${blocked > 0 ? ` · ${blocked} no se pueden cobrar en ${branchName}` : ''}`}
            </p>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o variante" className="h-9 pl-9 text-sm" />
          </div>
        </div>

        {state?.error && !loading && (
          <p className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Revisando variantes…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center">
            <Layers className="mx-auto h-7 w-7 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-foreground">{search ? 'Nada coincide con la búsqueda' : 'Todavía no hay productos con variantes'}</p>
            {!search && (
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Abrí un producto desde el Catálogo y activá «Tiene variantes» en el paso Variantes. Abajo podés guardar atributos como «Talle» o «Color» para reutilizarlos.
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map(({ product, variants, sellable, branchStock, issues }) => {
              const blockedHere = issues.not_in_branch + issues.price_mismatch
              return (
                <li key={product.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 gap-3">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Package className="h-5 w-5" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{product.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {sellable} de {variants.length} para vender</span>
                        <span>{branchStock} u. en {branchName}</span>
                        {blockedHere > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3" /> {blockedHere} {blockedHere === 1 ? 'necesita' : 'necesitan'} atención
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {variants.map((variant) => {
                          const problem = variant.issues.find((issue) => issue !== 'out_of_stock')
                          return (
                            <span
                              key={variant.id}
                              title={variant.issues.map((issue) => ISSUE_TEXT[issue]).join(' · ') || 'Lista para vender'}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                                problem === 'inactive' && 'border-dashed text-muted-foreground',
                                problem && problem !== 'inactive' && 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
                                !problem && 'bg-background text-foreground',
                              )}
                            >
                              {variant.name}
                              <span className="tabular-nums text-muted-foreground">{variant.stock ?? '—'}</span>
                            </span>
                          )
                        })}
                      </div>
                      {blockedHere > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-200">
                          {issues.not_in_branch > 0 && <li>• {issues.not_in_branch} sin stock cargado en {branchName}: abrilas y guardá el stock de cada una.</li>}
                          {issues.price_mismatch > 0 && <li>• {issues.price_mismatch} con un precio distinto al del producto: igualalo en la ficha.</li>}
                        </ul>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant={blockedHere > 0 ? 'default' : 'outline'} className="shrink-0 gap-1.5 self-start" onClick={() => onEditVariants(product.id)}>
                    <Layers className="h-3.5 w-3.5" /> {blockedHere > 0 ? 'Corregir variantes' : 'Editar variantes'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Biblioteca de atributos */}
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <VariantManager attributesOnly />
      </section>
    </div>
  )
}

export default VariantsOverview
