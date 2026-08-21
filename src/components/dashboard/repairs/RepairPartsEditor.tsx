'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PackagePlus, Plus, Search, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import type { RepairTaxRate } from '@/lib/repairs/cost-breakdown'

export type EditableRepairPart = {
  key: string
  productId?: string | null
  name: string
  partNumber?: string | null
  supplier?: string | null
  quantity: number
  unitPrice: number
  unitCost: number
  discountAmount: number
  taxRate: RepairTaxRate
  availableStock?: number | null
}

type InventorySuggestion = {
  productId: string
  sku: string
  name: string
  availableStock: number
  unitCost: number
  unitPrice: number
  taxRate: RepairTaxRate
  version: string
  retailPrice?: number
  wholesalePriceApplied?: boolean
}

function NumericField({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (value: number) => void; disabled?: boolean
}) {
  return <Input aria-label={label} type="number" min={0} value={value} disabled={disabled}
    onChange={(event) => onChange(Number(event.target.value) || 0)} className="h-9 tabular-nums" />
}

export function RepairPartsEditor({ parts, onChange, onAddService, repairId, customerIsWholesale = false, disabled, invalidPartKeys = new Set() }: {
  parts: EditableRepairPart[]
  onChange: (parts: EditableRepairPart[]) => void
  onAddService: () => void
  repairId: string
  customerIsWholesale?: boolean
  disabled?: boolean
  invalidPartKeys?: ReadonlySet<string>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<InventorySuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/repairs/inventory/search?q=${encodeURIComponent(query)}&repairId=${encodeURIComponent(repairId)}`, { signal: controller.signal })
        const body = await response.json().catch(() => ({}))
        setResults(response.ok && Array.isArray(body.items) ? body.items : [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, repairId])

  const update = (index: number, patch: Partial<EditableRepairPart>) => {
    onChange(parts.map((part, current) => current === index ? { ...part, ...patch } : part))
  }
  const addSuggestion = (suggestion: InventorySuggestion) => {
    const existing = parts.findIndex((part) => part.productId === suggestion.productId)
    if (existing >= 0) update(existing, { quantity: parts[existing].quantity + 1 })
    else onChange([...parts, {
      key: `${suggestion.productId}-${Date.now()}`, productId: suggestion.productId,
      name: suggestion.name, partNumber: suggestion.sku, supplier: 'Inventario local',
      quantity: 1, unitPrice: suggestion.unitPrice, unitCost: suggestion.unitCost,
      discountAmount: 0, taxRate: suggestion.taxRate, availableStock: suggestion.availableStock,
    }])
    setQuery('')
    setResults([])
  }
  const addManualPart = () => {
    onChange([...parts, {
      key: `manual-${crypto.randomUUID()}`, productId: null, name: 'Repuesto manual',
      supplier: 'Carga manual', quantity: 1, unitPrice: 0, unitCost: 0,
      discountAmount: 0, taxRate: 10, availableStock: null,
    }])
  }

  return <div className="space-y-3">
    <div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="repair-part-search">Buscar en inventario</Label><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAddService}><Wrench className="mr-1.5 h-3.5 w-3.5" />Agregar servicio</Button><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addManualPart}><Plus className="mr-1.5 h-3.5 w-3.5" />Agregar repuesto</Button></div></div>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input id="repair-part-search" role="combobox" aria-expanded={results.length > 0}
          value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o SKU" className="pl-9" />
        {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />}
      </div>
      {results.length > 0 && <div role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
        {results.map((item) => <button key={item.productId} type="button" role="option" aria-selected="false"
          onClick={() => addSuggestion(item)} className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span><strong>{item.name}</strong><small className="block text-muted-foreground">{item.sku} · Stock {item.availableStock}</small>{item.wholesalePriceApplied && <small className="block font-medium text-sky-700 dark:text-sky-300">Precio mayorista aplicado</small>}</span>
          <span className="text-right tabular-nums"><strong>{formatCurrency(item.unitPrice)}</strong>{item.wholesalePriceApplied && item.retailPrice ? <small className="block text-muted-foreground line-through">{formatCurrency(item.retailPrice)}</small> : null}</span>
        </button>)}
      </div>}
      {customerIsWholesale && <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">La búsqueda utiliza la tarifa mayorista configurada para cada repuesto.</p>}
    </div>

    {parts.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <PackagePlus className="mx-auto mb-2 h-6 w-6" />No hay repuestos agregados.
    </div> : <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Repuesto</th><th>Cantidad</th><th>Costo</th><th>Precio cobrado</th><th>Descuento</th><th>IVA</th><th>Subtotal</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{parts.map((part, index) => <tr key={part.key} className={invalidPartKeys.has(part.key) ? 'border-t bg-destructive/5' : 'border-t'}>
            <td className="p-2 font-medium">{part.productId ? <>{part.name}<small className="block text-muted-foreground">{part.partNumber}</small></> : <><Input aria-label="Nombre del repuesto manual" value={part.name} disabled={disabled} onChange={(event) => update(index, { name: event.target.value })} className="h-9" /><small className="mt-1 block text-muted-foreground">Carga manual · no descuenta stock</small></>}</td>
            <td className="p-2"><NumericField label={`Cantidad de ${part.name}`} value={part.quantity} disabled={disabled} onChange={(quantity) => update(index, { quantity })} /></td>
            <td className="p-2 tabular-nums">{part.productId ? formatCurrency(part.unitCost) : <NumericField label={`Costo interno de ${part.name}`} value={part.unitCost} disabled={disabled} onChange={(unitCost) => update(index, { unitCost })} />}</td>
            <td className="p-2"><NumericField label={`Precio cobrado de ${part.name}`} value={part.unitPrice} disabled={disabled} onChange={(unitPrice) => update(index, { unitPrice })} />{invalidPartKeys.has(part.key) && <p className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />Revisar precio</p>}</td>
            <td className="p-2"><NumericField label={`Descuento de ${part.name}`} value={part.discountAmount} disabled={disabled} onChange={(discountAmount) => update(index, { discountAmount })} /></td>
            <td className="p-2 text-center">{part.taxRate}%</td>
            <td className="p-2 text-right font-semibold tabular-nums">{formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}</td>
            <td className="p-2"><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Eliminar ${part.name}`} onClick={() => onChange(parts.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></Button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{parts.map((part, index) => <section key={part.key} className={`rounded-lg border p-3 ${invalidPartKeys.has(part.key) ? 'border-destructive/50 bg-destructive/5' : ''}`}>
        <div className="flex justify-between gap-2"><div className="min-w-0 flex-1">{part.productId ? <h4 className="font-medium">{part.name}</h4> : <><Input aria-label="Nombre del repuesto manual" value={part.name} disabled={disabled} onChange={(event) => update(index, { name: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Carga manual · no descuenta stock</p></>}<p className="text-xs text-muted-foreground">Costo {formatCurrency(part.unitCost)} · IVA {part.taxRate}%</p></div><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Eliminar ${part.name}`} onClick={() => onChange(parts.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></Button></div>
        <div className="mt-3 grid grid-cols-2 gap-3"><div><p className="mb-1 text-xs text-muted-foreground">Cantidad</p><NumericField label={`Cantidad de ${part.name}`} value={part.quantity} disabled={disabled} onChange={(quantity) => update(index, { quantity })} /></div>{!part.productId && <div><p className="mb-1 text-xs text-muted-foreground">Costo interno</p><NumericField label={`Costo interno de ${part.name}`} value={part.unitCost} disabled={disabled} onChange={(unitCost) => update(index, { unitCost })} /></div>}<div><p className="mb-1 text-xs text-muted-foreground">Precio cobrado</p><NumericField label={`Precio cobrado de ${part.name}`} value={part.unitPrice} disabled={disabled} onChange={(unitPrice) => update(index, { unitPrice })} /></div><div className={part.productId ? 'col-span-2' : ''}><p className="mb-1 text-xs text-muted-foreground">Descuento</p><NumericField label={`Descuento de ${part.name}`} value={part.discountAmount} disabled={disabled} onChange={(discountAmount) => update(index, { discountAmount })} /></div></div>
        {invalidPartKeys.has(part.key) && <p className="mt-3 flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="h-3.5 w-3.5" />El precio queda debajo del costo de inventario.</p>}
        <div className="mt-3 flex justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Subtotal</span><strong className="tabular-nums">{formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}</strong></div>
      </section>)}</div>
    </div>}
  </div>
}
