'use client'

import { useId, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import type { ProductVariantInput } from '@/lib/products/variant-contract'

export interface VariantEditableGridProps {
  rows: Array<{ variant: ProductVariantInput; index: number; state: 'new' | 'modified' | 'unchanged' }>
  selectedKeys: Set<string>
  onToggle: (key: string) => void
  onToggleAll: () => void
  onUpdate: (index: number, patch: Partial<ProductVariantInput>) => void
  onRemove: (index: number) => void
  canViewCost: boolean
  canUpdateCost: boolean
  disabled?: boolean
  stockEditable: boolean
  branchName?: string
}

const stateLabels = { new: 'Nueva', modified: 'Modificada', unchanged: 'Sin cambios' }
const money = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 })

type Row = VariantEditableGridProps['rows'][number]
type RowProps = Omit<VariantEditableGridProps, 'rows' | 'onToggleAll'> & { row: Row }

function StateBadge({ state }: { state: Row['state'] }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${state === 'new' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : state === 'modified' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{stateLabels[state]}</span>
}

function VariantFields({ row, onUpdate, canViewCost, canUpdateCost, disabled, stockEditable, prefix, extended = false }: RowProps & { prefix: string; extended?: boolean }) {
  const { variant, index } = row
  const numberField = (label: string, field: 'salePrice' | 'purchasePrice' | 'stockQuantity' | 'wholesalePrice' | 'minStock', readOnly = false) => (
    <label className="grid min-w-0 gap-1 text-xs text-muted-foreground" key={field}>
      <span className={extended ? '' : 'sr-only'}>{label}</span>
      <Input aria-label={`${label} · ${variant.name} · ${prefix}`} className="h-8 min-w-20 text-right tabular-nums" type="number" min={0} step={field === 'stockQuantity' || field === 'minStock' ? 1 : 'any'} value={variant[field] ?? ''} placeholder={field === 'purchasePrice' ? 'Sin costo' : 'Sin definir'} disabled={disabled || (field === 'stockQuantity' && !stockEditable)} readOnly={readOnly} onChange={event => {
        if (readOnly) return
        const raw = event.target.value
        if (raw === '' && field === 'purchasePrice') onUpdate(index, { purchasePrice: null })
        else if (raw === '' && field === 'wholesalePrice') onUpdate(index, { wholesalePrice: undefined })
        else if (raw !== '' && Number.isFinite(Number(raw))) onUpdate(index, { [field]: Number(raw) })
      }} />
    </label>
  )
  if (extended) return <div className="grid grid-cols-2 gap-3">
    <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">SKU<Input aria-label={`SKU · ${variant.name} · ${prefix}`} value={variant.sku} disabled={disabled} onChange={e => onUpdate(index, { sku: e.target.value })} /></label>
    {numberField('Precio', 'salePrice')}
    {numberField('Stock', 'stockQuantity')}
    {canViewCost && numberField('Costo', 'purchasePrice', !canUpdateCost)}
    {numberField('Precio mayorista', 'wholesalePrice')}
    {numberField('Stock mínimo', 'minStock')}
    <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">Código de barras<Input aria-label={`Código de barras · ${variant.name} · ${prefix}`} value={variant.barcode ?? ''} disabled={disabled} onChange={e => onUpdate(index, { barcode: e.target.value })} /></label>
  </div>
  return <>
    <td className="p-2"><Input aria-label={`SKU · ${variant.name} · ${prefix}`} className="h-8 min-w-28" value={variant.sku} disabled={disabled} onChange={e => onUpdate(index, { sku: e.target.value })} /></td>
    <td className="p-2">{numberField('Precio', 'salePrice')}</td>
    {canViewCost && <td className="p-2">{numberField('Costo', 'purchasePrice', !canUpdateCost)}</td>}
    <td className="p-2">{numberField('Stock', 'stockQuantity')}</td>
  </>
}

function RowActions({ row, disabled, onUpdate, onRemove, prefix }: RowProps & { prefix: string }) {
  return <div className="flex items-center justify-end gap-3">
    <Switch aria-label={`Activa · ${row.variant.name} · ${prefix}`} checked={row.variant.isActive} disabled={disabled} onCheckedChange={isActive => onUpdate(row.index, { isActive })} />
    <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" disabled={disabled} aria-label={`Eliminar ${row.variant.name} · ${prefix}`} onClick={() => onRemove(row.index)}><Trash2 className="size-4" /></Button>
  </div>
}

export function VariantMobileCard(props: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const { row, selectedKeys, onToggle, disabled } = props
  const { variant } = row
  return <article className="rounded-lg border bg-background p-3">
    <div className="flex items-start gap-3">
      <Checkbox className="mt-1" aria-label={`Seleccionar ${variant.name} · móvil`} disabled={disabled} checked={selectedKeys.has(variant.id ?? variant.clientKey)} onCheckedChange={() => onToggle(variant.id ?? variant.clientKey)} />
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="break-words text-sm font-medium">{variant.name}</h4><StateBadge state={row.state} /></div><p className="mt-1 break-all text-xs text-muted-foreground">{variant.sku || 'Sin SKU'} · {variant.isActive ? 'Activa' : 'Inactiva'}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2"><div className="text-sm font-semibold tabular-nums">Gs. {money.format(variant.salePrice)} <span className="ml-2 text-xs font-normal text-muted-foreground">Stock {variant.stockQuantity}</span></div><Button type="button" variant="ghost" size="sm" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>Editar<ChevronDown className={`ml-1 size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></Button></div>
    {expanded && <div id={detailsId} className="mt-3 space-y-3 border-t pt-3"><VariantFields {...props} prefix="móvil" extended /><RowActions {...props} prefix="móvil" /></div>}
  </article>
}

export function VariantEditableGrid(props: VariantEditableGridProps) {
  const { rows, selectedKeys, onToggle, onToggleAll, disabled, canViewCost, stockEditable, branchName } = props
  const selectedCount = rows.filter(({ variant }) => selectedKeys.has(variant.id ?? variant.clientKey)).length
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{stockEditable ? `Stock de sucursal: ${branchName || 'seleccionada'}` : 'Stock de solo lectura. Seleccioná una sucursal para editarlo.'}</p>
    <div className="hidden overflow-x-auto rounded-lg border md:block"><table className="w-full text-sm"><caption className="sr-only">Variantes del producto</caption><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="w-10 p-3"><Checkbox aria-label="Seleccionar todas las variantes" disabled={disabled || rows.length === 0} checked={rows.length > 0 && selectedCount === rows.length ? true : selectedCount > 0 ? 'indeterminate' : false} onCheckedChange={onToggleAll} /></th><th className="min-w-40 p-2 text-left font-medium">Variante</th><th className="p-2 text-left font-medium">SKU</th><th className="p-2 text-right font-medium">Precio</th>{canViewCost && <th className="p-2 text-right font-medium">Costo</th>}<th className="p-2 text-right font-medium">Stock</th><th className="p-2 text-right font-medium">Estado / acciones</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.variant.id ?? row.variant.clientKey} className="hover:bg-muted/20"><td className="p-3"><Checkbox aria-label={`Seleccionar ${row.variant.name} · tabla`} disabled={disabled} checked={selectedKeys.has(row.variant.id ?? row.variant.clientKey)} onCheckedChange={() => onToggle(row.variant.id ?? row.variant.clientKey)} /></td><td className="p-2"><div className="font-medium">{row.variant.name}</div><div className="my-1 text-xs text-muted-foreground">{Object.values(row.variant.attributes).join(' / ')}</div><StateBadge state={row.state} /></td><VariantFields {...props} row={row} prefix="tabla" /><td className="p-2"><RowActions {...props} row={row} prefix="tabla" /></td></tr>)}</tbody></table></div>
    <div className="space-y-2 md:hidden"><div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Checkbox aria-label="Seleccionar todas las variantes · móvil" disabled={disabled || rows.length === 0} checked={rows.length > 0 && selectedCount === rows.length ? true : selectedCount > 0 ? 'indeterminate' : false} onCheckedChange={onToggleAll} />Seleccionar todas</div>{rows.map(row => <VariantMobileCard key={row.variant.id ?? row.variant.clientKey} {...props} row={row} />)}</div>
  </div>
}
