'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, Package } from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { filterDetailVariants, summarizeVariants, type DetailVariant } from './variant-detail-logic'

export interface VariantBranchStock { variantId: string; branchId: string; branchName: string; quantity: number }
interface Props {
  variants: DetailVariant[]; canViewCost: boolean; productImage?: string
  branchStock: VariantBranchStock[]; branchStockState: 'loading' | 'ready' | 'error'
  formatCurrency: (value: number) => string
}

export function VariantDetailList({ variants, canViewCost, productImage, branchStock, branchStockState, formatCurrency }: Props) {
  const [search, setSearch] = useState('')
  const [stock, setStock] = useState('all')
  const [status, setStatus] = useState('all')
  const [attributes, setAttributes] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const summary = summarizeVariants(variants)
  const options = useMemo(() => {
    const result: Record<string, Set<string>> = {}
    variants.forEach(v => Object.entries(v.attributes).forEach(([key, value]) => (result[key] ??= new Set()).add(value)))
    return result
  }, [variants])
  const filtered = filterDetailVariants(variants, { search, stock, status, attributes })
  const toggle = (id: string) => setExpanded(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const details = (variant: DetailVariant) => {
    const rows = branchStock.filter(row => row.variantId === variant.id)
    return <div className="grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-[80px_1fr_1fr]">
      {productImage ? <AppImage src={productImage} alt={`Imagen del producto: ${variant.name}`} width={80} height={80} className="h-20 w-20 rounded-lg object-contain" /> : <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted"><Package className="h-6 w-6 text-muted-foreground" aria-label="Sin imagen del producto" /></div>}
      <div className="min-w-0 space-y-2 text-sm"><p className="break-all">Código de barras: {variant.barcode || 'Sin código'}</p>
        {Object.entries(variant.attributes).map(([key, value]) => <p key={key} className="break-words"><span className="text-muted-foreground">{key}: </span>{value}</p>)}
        {canViewCost && <><p>Costo: {variant.purchasePrice == null ? 'Sin costo' : formatCurrency(variant.purchasePrice)}</p>
          <p>Margen: {variant.purchasePrice == null || variant.salePrice <= 0 ? 'No disponible' : `${(((variant.salePrice - variant.purchasePrice) / variant.salePrice) * 100).toFixed(1)}%`}</p></>}
      </div>
      <div className="space-y-2 text-sm"><p className="font-medium">Stock por sucursal</p>
        <p className="text-xs text-muted-foreground">Solo sucursales con acceso autorizado.</p>
        {branchStockState === 'loading' ? <p role="status">Cargando sucursales…</p> : branchStockState === 'error' ? <p>No se pudo consultar el desglose.</p> : rows.length ? rows.map(row => <p key={row.branchId} className="flex justify-between gap-3"><span className="break-words">{row.branchName}</span><span>{row.quantity} un.</span></p>) : <p className="text-muted-foreground">Sin registros visibles por sucursal.</p>}
      </div>
    </div>
  }
  const expandButton = (variant: DetailVariant) => <Button type="button" variant="ghost" size="sm" aria-expanded={expanded.has(variant.id)} aria-label={`${expanded.has(variant.id) ? 'Contraer' : 'Expandir'} ${variant.name}`} onClick={() => toggle(variant.id)}><ChevronDown className={`h-4 w-4 transition-transform ${expanded.has(variant.id) ? 'rotate-180' : ''}`} /></Button>
  const selectClass = 'h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return <Card className="min-w-0 rounded-2xl">
    <CardHeader><CardTitle>Variantes</CardTitle><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Resumen de variantes"><span>{summary.total} variantes</span><span>{summary.active} activas</span><span>{summary.outOfStock} sin stock</span><span>{summary.stock} unidades</span></div></CardHeader>
    <CardContent className="space-y-4">
      {!variants.length ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Este producto no tiene variantes.</div> : <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input aria-label="Buscar variantes por SKU o atributos" placeholder="Buscar SKU o atributos…" value={search} onChange={e => setSearch(e.target.value)} />
          <select aria-label="Filtrar stock" className={selectClass} value={stock} onChange={e => setStock(e.target.value)}><option value="all">Todas las existencias</option><option value="in_stock">Con stock</option><option value="out_of_stock">Sin stock</option></select>
          <select aria-label="Filtrar estado" className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select>
          {Object.entries(options).map(([key, values]) => <label key={key} className="grid gap-1 text-xs text-muted-foreground">{key}<select aria-label={`Filtrar ${key}`} className={selectClass} value={attributes[key] || ''} onChange={e => setAttributes(current => ({ ...current, [key]: e.target.value }))}><option value="">Todos</option>{Array.from(values).map(value => <option key={value}>{value}</option>)}</select></label>)}
        </div>
        <p className="text-xs text-muted-foreground" role="status">{filtered.length} de {variants.length} variantes</p>
        {!filtered.length ? <p className="rounded-xl bg-muted/40 p-6 text-center">No hay variantes que coincidan con los filtros.</p> : <>
          <div className="hidden lg:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="w-1/4 py-3">Variante</th><th>SKU</th><th>Precio</th>{canViewCost && <th>Costo</th>}<th>Stock</th><th>Estado</th><th className="w-12"><span className="sr-only">Detalles</span></th></tr></thead><tbody>{filtered.map(variant => <Fragment key={variant.id}><tr className="border-b"><td className="break-words py-3 pr-3 font-medium">{variant.name}</td><td className="break-all pr-3 font-mono text-xs">{variant.sku}</td><td>{formatCurrency(variant.salePrice)}</td>{canViewCost && <td>{variant.purchasePrice == null ? 'Sin costo' : formatCurrency(variant.purchasePrice)}</td>}<td>{variant.stockQuantity} un.</td><td><Badge variant={variant.isActive ? 'secondary' : 'outline'}>{variant.isActive ? 'Activa' : 'Inactiva'}</Badge></td><td>{expandButton(variant)}</td></tr>{expanded.has(variant.id) && <tr><td colSpan={canViewCost ? 7 : 6} className="py-3">{details(variant)}</td></tr>}</Fragment>)}</tbody></table></div>
          <div className="space-y-3 lg:hidden">{filtered.map(variant => <article key={variant.id} className="min-w-0 rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{variant.name}</h3><p className="mt-1 break-all text-xs text-muted-foreground">SKU: {variant.sku}</p></div>{expandButton(variant)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{formatCurrency(variant.salePrice)}</span><span>{variant.stockQuantity} un.</span><Badge variant="secondary">{variant.isActive ? 'Activa' : 'Inactiva'}</Badge></div>{expanded.has(variant.id) && <div className="mt-3">{details(variant)}</div>}</article>)}</div>
        </>}
      </>}
    </CardContent>
  </Card>
}
