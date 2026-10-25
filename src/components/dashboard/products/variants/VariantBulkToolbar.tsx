'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { applyVariantBulkAction, type VariantBulkAction, variantSelectionKey } from '@/lib/products/variant-bulk'
import type { ProductVariantInput } from '@/lib/products/variant-contract'

export function VariantBulkToolbar({ variants, selected, onApply, onClear, canUpdateCost, branch, baseSku, disabled = false }: {
  variants: ProductVariantInput[]; selected: Set<string>; onApply: (next: ProductVariantInput[]) => void; onClear: () => void;
  canUpdateCost: boolean; branch?: { id: string; name: string } | null; baseSku: string; disabled?: boolean;
}) {
  const [kind, setKind] = useState<VariantBulkAction['type'] | null>(null)
  const [input, setInput] = useState('')
  const [active, setActive] = useState(true)
  const chosen = variants.filter(v => selected.has(variantSelectionKey(v)))
  if (!chosen.length) return null
  let next: ProductVariantInput[] | null = null
  let error = ''
  if (kind) {
    try {
      if (['price', 'cost', 'stock'].includes(kind) && input.trim() === '') throw new Error('Ingresá el valor antes de confirmar.')
      const action: VariantBulkAction = kind === 'sku' ? { type: 'sku', base: baseSku } : kind === 'clearCost' ? { type: kind } : kind === 'active' ? { type: kind, value: active } : { type: kind, value: Number(input) }
      next = applyVariantBulkAction(variants, selected, action, { canUpdateCost, branchId: branch?.id })
    } catch (e) { error = e instanceof Error ? e.message : 'Revisá la acción.' }
  }
  const title = kind === 'price' ? 'Establecer precio' : kind === 'cost' ? 'Establecer costo' : kind === 'clearCost' ? 'Limpiar costo' : kind === 'stock' ? 'Establecer stock' : kind === 'active' ? 'Cambiar estado' : 'Sugerir SKU'
  const open = (type: VariantBulkAction['type']) => { setInput(''); setKind(type) }
  const display = (v: ProductVariantInput) => kind === 'sku' ? v.sku : kind === 'active' ? v.isActive ? 'Activa' : 'Inactiva' : kind === 'stock' ? `${v.stockQuantity} unidades` : kind === 'price' ? formatCurrency(v.salePrice) : v.purchasePrice == null ? 'Sin costo' : formatCurrency(v.purchasePrice)
  return <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
    <div className="flex flex-wrap items-center gap-2"><strong className="mr-auto text-sm">{chosen.length} variantes seleccionadas</strong>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => open('price')}>Precio</Button>
      {canUpdateCost && <><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => open('cost')}>Costo</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => open('clearCost')}>Limpiar costo</Button></>}
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => open('active')}>Estado</Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled || !branch} onClick={() => open('stock')}>Stock</Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => open('sku')}>Generar SKU</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>Quitar selección</Button>
    </div>
    <p className="text-xs text-muted-foreground">{branch ? `Sucursal: ${branch.name}` : 'Seleccioná una sucursal para asignar stock.'} Los cambios se aplican al borrador hasta guardar el producto.</p>
    <Dialog open={kind !== null} onOpenChange={value => { if (!value) setKind(null) }}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Revisá el resultado para {chosen.length} variantes antes de aplicarlo al borrador.</DialogDescription></DialogHeader>
      {kind && ['price', 'cost', 'stock'].includes(kind) && <label className="space-y-2 text-sm">{kind === 'stock' ? `Stock · ${branch?.name ?? ''}` : 'Nuevo valor'}<Input autoFocus aria-label="Nuevo valor masivo" type="number" min={0} step={kind === 'stock' ? 1 : '0.01'} value={input} onChange={e => setInput(e.target.value)} /></label>}
      {kind === 'active' && <label className="text-sm">Estado<select aria-label="Estado masivo" value={active ? 'active' : 'inactive'} onChange={e => setActive(e.target.value === 'active')} className="ml-3 rounded-md border bg-background p-2"><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>}
      {kind === 'clearCost' && <p className="text-sm">El costo quedará sin informar (NULL). No se convertirá en cero.</p>}
      <ul className="max-h-48 space-y-2 overflow-auto text-sm">{chosen.slice(0, 10).map(v => { const after = next?.find(n => variantSelectionKey(n) === variantSelectionKey(v)); return <li key={variantSelectionKey(v)} className="flex flex-wrap justify-between gap-2"><span>{v.name}</span><span>{display(v)} → {after ? display(after) : '—'}</span></li> })}</ul>
      {chosen.length > 10 && <p className="text-xs text-muted-foreground">Vista previa de las primeras 10 de {chosen.length} variantes.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => setKind(null)}>Cancelar</Button><Button type="button" disabled={!next || disabled} onClick={() => { if (next) { onApply(next); setKind(null) } }}>Aplicar al borrador</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>
}
