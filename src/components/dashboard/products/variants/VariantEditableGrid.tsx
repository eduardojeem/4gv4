'use client'

import { Fragment, useId, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import type { ProductVariantInput } from '@/lib/products/variant-contract'
import { formatCurrency } from '@/lib/currency'
import { variantUnitPrice } from '@/lib/products/variant-pricing'
import type { VariantPriceDefaults } from '@/lib/products/variant-combinations'

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
  /** Precios del producto: definen el mayorista que hereda una variante sin el suyo. */
  basePrices?: VariantPriceDefaults
}

const stateLabels = { new: 'Nueva', modified: 'Modificada', unchanged: 'Sin cambios' }

type Row = VariantEditableGridProps['rows'][number]
type RowProps = Omit<VariantEditableGridProps, 'rows' | 'onToggleAll'> & { row: Row }

function StateBadge({ state }: { state: Row['state'] }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${state === 'new' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : state === 'modified' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{stateLabels[state]}</span>
}

function VariantFields({ row, onUpdate, canViewCost, canUpdateCost, disabled, stockEditable, basePrices, prefix, extended = false, primary = false }: RowProps & { prefix: string; extended?: boolean; primary?: boolean }) {
  const { variant, index } = row
  const product = basePrices ? { sale_price: basePrices.salePrice, wholesale_price: basePrices.wholesalePrice } : null
  const inheritedWholesale = variantUnitPrice(product, { sale_price: variant.salePrice, wholesale_price: null }, 'wholesale')
  const inheritedWholesaleLabel = inheritedWholesale > 0 ? `Usa ${formatCurrency(inheritedWholesale)}` : 'Sin definir'
  const wholesaleIssue = variant.wholesalePrice != null && variant.wholesalePrice > 0 && variant.wholesalePrice >= variant.salePrice
    ? { tone: 'error' as const, text: 'Tiene que ser menor que el precio de venta.' }
    : canViewCost && variant.wholesalePrice != null && variant.wholesalePrice > 0 && variant.purchasePrice != null && variant.wholesalePrice <= variant.purchasePrice
      ? { tone: 'warning' as const, text: 'No supera el costo.' }
      : null
  const saleIssue = canViewCost && variant.purchasePrice != null && variant.salePrice > 0 && variant.salePrice <= variant.purchasePrice
    ? { tone: 'warning' as const, text: 'No supera el costo.' }
    : null
  const numberField = (label: string, field: 'salePrice' | 'purchasePrice' | 'stockQuantity' | 'wholesalePrice' | 'minStock', readOnly = false) => {
    const fieldLabel = field === 'salePrice' ? 'Precio de venta' : field === 'stockQuantity' ? (variant.id ? 'Cantidad en sucursal' : 'Cantidad inicial') : label
    const placeholder = field === 'purchasePrice' ? 'Sin informar' : field === 'wholesalePrice' ? inheritedWholesaleLabel : 'Sin definir'
    const issue = field === 'wholesalePrice' ? wholesaleIssue : field === 'salePrice' ? saleIssue : null
    return (
    <label className="grid min-w-0 gap-1 text-xs text-muted-foreground" key={field}>
      <span className={extended || primary ? '' : 'sr-only'}>{fieldLabel}{readOnly && <span> · Solo lectura</span>}</span>
      <Input aria-label={`${fieldLabel} · ${variant.name} · ${prefix}`} className={`${primary ? 'h-11' : 'h-9'} w-full min-w-0 text-right text-base tabular-nums sm:text-sm`} type="number" inputMode={field === 'stockQuantity' || field === 'minStock' ? 'numeric' : 'decimal'} min={0} step={field === 'stockQuantity' || field === 'minStock' ? 1 : 'any'} value={variant[field] ?? ''} placeholder={placeholder} aria-invalid={issue?.tone === 'error' ? true : undefined} disabled={disabled || ((field === 'stockQuantity' || field === 'minStock') && !stockEditable)} readOnly={readOnly} onChange={event => {
        if (readOnly) return
        const raw = event.target.value
        if (raw === '' && field === 'purchasePrice') onUpdate(index, { purchasePrice: null })
        else if (raw === '' && field === 'wholesalePrice') onUpdate(index, { wholesalePrice: undefined })
        else if (raw !== '' && Number.isFinite(Number(raw))) onUpdate(index, { [field]: Number(raw) })
      }} />
      {primary && <span className="text-[11px]">{field === 'salePrice' ? formatCurrency(variant.salePrice) : 'Unidades de esta variante'}</span>}
      {issue && <span role={issue.tone === 'error' ? 'alert' : undefined} className={`text-[11px] leading-snug ${issue.tone === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>{issue.text}</span>}
    </label>
  )
  }
  if (primary) return <div className="grid grid-cols-2 gap-3">{numberField('Precio', 'salePrice')}{numberField('Stock', 'stockQuantity')}</div>
  if (extended) return <div className="grid grid-cols-2 gap-3">
    {prefix === 'móvil' && <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">SKU<Input aria-label={`SKU · ${variant.name} · ${prefix}`} value={variant.sku} disabled={disabled} onChange={e => onUpdate(index, { sku: e.target.value })} /></label>}
    {prefix === 'móvil' && canViewCost && numberField('Costo', 'purchasePrice', !canUpdateCost)}
    {prefix === 'móvil' && numberField('Precio mayorista', 'wholesalePrice')}
    {numberField('Stock mínimo', 'minStock')}
    <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">Código de barras<Input aria-label={`Código de barras · ${variant.name} · ${prefix}`} value={variant.barcode ?? ''} disabled={disabled} onChange={e => onUpdate(index, { barcode: e.target.value })} /></label>
  </div>
  return <>
    <td className="p-2"><Input aria-label={`SKU · ${variant.name} · ${prefix}`} className="h-8 min-w-28" value={variant.sku} disabled={disabled} onChange={e => onUpdate(index, { sku: e.target.value })} /></td>
    <td className="p-2">{numberField('Precio', 'salePrice')}</td>
    <td className="p-2">{numberField('Precio mayorista', 'wholesalePrice')}</td>
    {canViewCost && <td className="p-2">{numberField('Costo', 'purchasePrice', !canUpdateCost)}</td>}
    <td className="p-2">{numberField('Stock', 'stockQuantity')}</td>
  </>
}

function RowActions({ row, disabled, onUpdate, onRemove, prefix }: RowProps & { prefix: string }) {
  return <div className="flex items-center justify-end gap-3">
    <span className="text-xs text-muted-foreground">{row.variant.isActive ? 'Activa' : 'Inactiva'}</span>
    <Switch aria-label={`Activa · ${row.variant.name} · ${prefix}`} checked={row.variant.isActive} disabled={disabled} onCheckedChange={isActive => onUpdate(row.index, { isActive })} />
    <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" disabled={disabled} aria-label={`Eliminar ${row.variant.name} · ${prefix}`} onClick={() => onRemove(row.index)}><Trash2 className="size-4" /></Button>
  </div>
}

export function VariantMobileCard(props: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const { row, selectedKeys, onToggle, disabled } = props
  const { variant } = row
  return <article className={`min-w-0 space-y-4 rounded-xl border bg-background p-4 ${selectedKeys.has(variant.id ?? variant.clientKey) ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
    <div className="flex items-start gap-3">
      <Checkbox className="mt-1" aria-label={`Seleccionar ${variant.name} · móvil`} disabled={disabled} checked={selectedKeys.has(variant.id ?? variant.clientKey)} onCheckedChange={() => onToggle(variant.id ?? variant.clientKey)} />
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="break-words text-sm font-medium">{variant.name}</h4><StateBadge state={row.state} /></div><p className="mt-1 break-all text-xs text-muted-foreground">{variant.sku || 'Sin SKU'} · {variant.isActive ? 'Activa' : 'Inactiva'}</p></div>
    </div>
    <VariantFields {...props} prefix="móvil" primary />
    <Button type="button" variant="outline" size="sm" className="w-full justify-between" disabled={disabled} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>Más opciones<ChevronDown className={`ml-1 size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></Button>
    {expanded && <div id={detailsId} className="mt-3 space-y-3 border-t pt-3"><VariantFields {...props} prefix="móvil" extended /><RowActions {...props} prefix="móvil" /></div>}
  </article>
}

export function VariantEditableGrid(props: VariantEditableGridProps) {
  const { rows, selectedKeys, onToggle, onToggleAll, disabled, canViewCost, stockEditable, branchName } = props
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggleDetails = (key: string) => setExpanded(old => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const selectedCount = rows.filter(({ variant }) => selectedKeys.has(variant.id ?? variant.clientKey)).length
  return <div className="space-y-3">
    <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
      <p className="text-sm font-semibold">Precios y cantidades por variante</p>
      <p className="text-xs leading-relaxed text-muted-foreground">El precio de venta es por unidad y el POS cobra el de cada variante. Mayorista vacío: usa el del producto si la variante cuesta lo mismo; si no, su precio menos 10%. Si cambiás un precio del producto, las variantes que tenían ese mismo precio lo siguen.</p>
      <p className="text-xs leading-relaxed text-muted-foreground">Cada combinación tiene su propia cantidad; cambiarla no modifica las demás.</p>
      <p className={`text-xs ${stockEditable ? 'font-medium' : 'text-amber-700 dark:text-amber-400'}`}>{stockEditable ? `Sucursal: ${branchName || 'seleccionada'}. Las cantidades corresponden a esta sucursal.` : 'Cantidad de solo lectura. Seleccioná una sucursal para editarla.'}</p>
      <p className="text-xs text-muted-foreground">Los cambios quedan en el borrador hasta guardar el producto.</p>
    </div>
    <div className="hidden overflow-x-auto rounded-lg border md:block"><table className="w-full text-sm"><caption className="sr-only">Variantes del producto</caption><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="w-10 p-3"><Checkbox aria-label="Seleccionar todas las variantes" disabled={disabled || rows.length === 0} checked={rows.length > 0 && selectedCount === rows.length ? true : selectedCount > 0 ? 'indeterminate' : false} onCheckedChange={onToggleAll} /></th><th className="min-w-40 p-2 text-left font-medium">Variante</th><th className="p-2 text-left font-medium">SKU</th><th className="p-2 text-right font-medium">Precio de venta</th><th className="p-2 text-right font-medium">Mayorista</th>{canViewCost && <th className="p-2 text-right font-medium">Costo</th>}<th className="p-2 text-right font-medium">Cantidad</th><th className="p-2 text-right font-medium">Estado / acciones</th></tr></thead><tbody className="divide-y">{rows.map(row => <Fragment key={row.variant.id ?? row.variant.clientKey}><tr className="hover:bg-muted/20"><td className="p-3"><Checkbox aria-label={`Seleccionar ${row.variant.name} · tabla`} disabled={disabled} checked={selectedKeys.has(row.variant.id ?? row.variant.clientKey)} onCheckedChange={() => onToggle(row.variant.id ?? row.variant.clientKey)} /></td><td className="p-2"><div className="font-medium">{row.variant.name}</div><div className="my-1 text-xs text-muted-foreground">{Object.values(row.variant.attributes).join(' / ')}</div><StateBadge state={row.state} /></td><VariantFields {...props} row={row} prefix="tabla" /><td className="p-2"><div className="flex items-center justify-end gap-2"><Button type="button" variant="ghost" size="icon" aria-label={`Editar detalles de ${row.variant.name}`} aria-expanded={expanded.has(row.variant.id ?? row.variant.clientKey)} onClick={() => toggleDetails(row.variant.id ?? row.variant.clientKey)}><ChevronDown className={`size-4 ${expanded.has(row.variant.id ?? row.variant.clientKey) ? 'rotate-180' : ''}`} /></Button><RowActions {...props} row={row} prefix="tabla" /></div></td></tr>{expanded.has(row.variant.id ?? row.variant.clientKey) && <tr><td colSpan={canViewCost ? 8 : 7} className="bg-muted/20 p-4"><div className="max-w-2xl"><VariantFields {...props} row={row} prefix="tabla ampliada" extended /></div></td></tr>}</Fragment>)}</tbody></table></div>
    <div className="space-y-2 md:hidden"><div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Checkbox aria-label="Seleccionar todas las variantes · móvil" disabled={disabled || rows.length === 0} checked={rows.length > 0 && selectedCount === rows.length ? true : selectedCount > 0 ? 'indeterminate' : false} onCheckedChange={onToggleAll} />Seleccionar todas</div>{rows.map(row => <VariantMobileCard key={row.variant.id ?? row.variant.clientKey} {...props} row={row} />)}</div>
  </div>
}
