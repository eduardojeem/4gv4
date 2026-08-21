'use client'

import { useEffect, useState } from 'react'
import { Loader2, PackagePlus, Search, Trash2 } from 'lucide-react'
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
}

function NumericField({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (value: number) => void; disabled?: boolean
}) {
  return <Input aria-label={label} type="number" min={0} value={value} disabled={disabled}
    onChange={(event) => onChange(Number(event.target.value) || 0)} className="h-9 tabular-nums" />
}

export function RepairPartsEditor({ parts, onChange, disabled }: {
  parts: EditableRepairPart[]
  onChange: (parts: EditableRepairPart[]) => void
  disabled?: boolean
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
        const response = await fetch(`/api/repairs/inventory/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const body = await response.json().catch(() => ({}))
        setResults(response.ok && Array.isArray(body.items) ? body.items : [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

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

  return <div className="space-y-3">
    <div className="relative">
      <Label htmlFor="repair-part-search">Buscar en inventario</Label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input id="repair-part-search" role="combobox" aria-expanded={results.length > 0}
          value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o SKU" className="pl-9" />
        {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />}
      </div>
      {results.length > 0 && <div role="listbox" className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
        {results.map((item) => <button key={item.productId} type="button" role="option" aria-selected="false"
          onClick={() => addSuggestion(item)} className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-accent">
          <span><strong>{item.name}</strong><small className="block text-muted-foreground">{item.sku} · Stock {item.availableStock}</small></span>
          <span className="tabular-nums">{formatCurrency(item.unitPrice)}</span>
        </button>)}
      </div>}
    </div>

    {parts.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <PackagePlus className="mx-auto mb-2 h-6 w-6" />No hay repuestos agregados.
    </div> : <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Repuesto</th><th>Cantidad</th><th>Costo</th><th>Precio cobrado</th><th>Descuento</th><th>IVA</th><th>Subtotal</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{parts.map((part, index) => <tr key={part.key} className="border-t">
            <td className="p-2 font-medium">{part.name}<small className="block text-muted-foreground">{part.partNumber}</small></td>
            <td className="p-2"><NumericField label={`Cantidad de ${part.name}`} value={part.quantity} disabled={disabled} onChange={(quantity) => update(index, { quantity })} /></td>
            <td className="p-2 tabular-nums">{formatCurrency(part.unitCost)}</td>
            <td className="p-2"><NumericField label={`Precio cobrado de ${part.name}`} value={part.unitPrice} disabled={disabled} onChange={(unitPrice) => update(index, { unitPrice })} /></td>
            <td className="p-2"><NumericField label={`Descuento de ${part.name}`} value={part.discountAmount} disabled={disabled} onChange={(discountAmount) => update(index, { discountAmount })} /></td>
            <td className="p-2 text-center">{part.taxRate}%</td>
            <td className="p-2 text-right font-semibold tabular-nums">{formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}</td>
            <td className="p-2"><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Eliminar ${part.name}`} onClick={() => onChange(parts.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></Button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{parts.map((part, index) => <section key={part.key} className="rounded-lg border p-3">
        <div className="flex justify-between"><div><h4 className="font-medium">{part.name}</h4><p className="text-xs text-muted-foreground">Costo {formatCurrency(part.unitCost)} · IVA {part.taxRate}%</p></div><Button type="button" variant="ghost" size="icon" aria-label={`Eliminar ${part.name}`} onClick={() => onChange(parts.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></Button></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><NumericField label={`Cantidad de ${part.name}`} value={part.quantity} onChange={(quantity) => update(index, { quantity })} /><NumericField label={`Precio cobrado de ${part.name}`} value={part.unitPrice} onChange={(unitPrice) => update(index, { unitPrice })} /><div className="col-span-2"><NumericField label={`Descuento de ${part.name}`} value={part.discountAmount} onChange={(discountAmount) => update(index, { discountAmount })} /></div></div>
      </section>)}</div>
    </div>}
  </div>
}
