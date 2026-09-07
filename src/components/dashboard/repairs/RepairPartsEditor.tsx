'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PackagePlus, Plus, Search, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import type { RepairTaxRate } from '@/lib/repairs/cost-breakdown'
import type { RepairLineType } from '@/lib/repairs/line-types'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

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
  lineType: RepairLineType
}

type InventorySuggestion = {
  productId: string
  sku: string
  name: string
  availableStock: number | null
  unitCost: number
  unitPrice: number
  taxRate: RepairTaxRate
  version: string
  retailPrice?: number
  wholesalePriceApplied?: boolean
  wholesalePriceFallback?: boolean
  lineType: 'service' | 'charged_part'
  includedMaterialCost?: number
}

function NumericField({
  label,
  value,
  onChange,
  disabled,
  isCurrency = false
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  isCurrency?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <Input
        aria-label={label}
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="h-9 tabular-nums text-right font-mono text-xs"
      />
      {isCurrency && value > 0 && (
        <span className="block text-right text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 tabular-nums">
          {formatCurrency(value)}
        </span>
      )}
    </div>
  )
}

export function RepairPartsEditor({
  parts,
  onChange,
  onAddService,
  repairId,
  customerIsWholesale = false,
  disabled,
  invalidPartKeys = new Set()
}: {
  parts: EditableRepairPart[]
  onChange: (parts: EditableRepairPart[]) => void
  onAddService: () => void
  repairId: string
  customerIsWholesale?: boolean
  disabled?: boolean
  invalidPartKeys?: ReadonlySet<string>
}) {
  const canViewCost = useCanViewCost()
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
        const response = await fetch(
          `/api/repairs/inventory/search?q=${encodeURIComponent(query)}&repairId=${encodeURIComponent(repairId)}`,
          { signal: controller.signal }
        )
        const body = await response.json().catch(() => ({}))
        setResults(response.ok && Array.isArray(body.items) ? body.items : [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, repairId])

  const update = (index: number, patch: Partial<EditableRepairPart>) => {
    onChange(parts.map((part, current) => (current === index ? { ...part, ...patch } : part)))
  }

  const addSuggestion = (suggestion: InventorySuggestion) => {
    const existing = parts.findIndex((part) => part.productId === suggestion.productId)
    if (existing >= 0) {
      update(existing, { quantity: parts[existing].quantity + 1 })
    } else {
      const selected: EditableRepairPart = {
        key: `${suggestion.productId}-${Date.now()}`,
        productId: suggestion.productId,
        name: suggestion.name,
        partNumber: suggestion.sku,
        supplier: 'Inventario local',
        quantity: 1,
        unitPrice: suggestion.unitPrice,
        unitCost: suggestion.unitCost,
        discountAmount: 0,
        taxRate: suggestion.taxRate,
        availableStock: suggestion.availableStock,
        lineType: suggestion.lineType,
      }
      const includedMaterial: EditableRepairPart[] =
        suggestion.lineType === 'service' && Number(suggestion.includedMaterialCost) > 0
          ? [
              {
                key: `included-${suggestion.productId}-${Date.now()}`,
                productId: null,
                name: `Material incluido · ${suggestion.name}`,
                partNumber: suggestion.sku,
                supplier: 'Incluido en el servicio',
                quantity: 1,
                unitPrice: 0,
                unitCost: Number(suggestion.includedMaterialCost),
                discountAmount: 0,
                taxRate: suggestion.taxRate,
                availableStock: null,
                lineType: 'included_material',
              },
            ]
          : []
      onChange([...parts, selected, ...includedMaterial])
    }
    setQuery('')
    setResults([])
  }

  const addManualPart = () => {
    onChange([
      ...parts,
      {
        key: `manual-${crypto.randomUUID()}`,
        productId: null,
        name: 'Repuesto manual',
        supplier: 'Carga manual',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        discountAmount: 0,
        taxRate: 10,
        availableStock: null,
        lineType: 'charged_part',
      },
    ])
  }

  return (
    <div className="space-y-3">
      {/* Buscador de repuestos y botones de alta rápida */}
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="repair-part-search" className="text-xs font-semibold">
            Buscar en inventario
          </Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAddService}>
              <Wrench className="mr-1.5 h-3.5 w-3.5 text-cyan-600" />
              Agregar servicio
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addManualPart}>
              <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              Agregar repuesto
            </Button>
          </div>
        </div>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="repair-part-search"
            role="combobox"
            aria-expanded={results.length > 0}
            value={query}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o SKU del repuesto..."
            className="pl-9 text-xs"
          />
          {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-cyan-600" />}
        </div>
        {results.length > 0 && (
          <div
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
          >
            {results.map((item) => (
              <button
                key={item.productId}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => addSuggestion(item)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  <strong>{item.name}</strong>
                  <small className="block text-muted-foreground">
                    {item.sku} · {item.lineType === 'service' ? 'Servicio · no descuenta stock' : `Stock: ${item.availableStock ?? 0}`}
                  </small>
                  {item.wholesalePriceApplied && (
                    <small className="block font-medium text-sky-700 dark:text-sky-300">
                      Precio mayorista aplicado
                    </small>
                  )}
                  {item.wholesalePriceFallback && (
                    <small className="block font-medium text-amber-700 dark:text-amber-300">
                      Sin tarifa mayorista configurada · se usará precio minorista
                    </small>
                  )}
                </span>
                <span className="text-right tabular-nums">
                  <strong className="text-foreground">{formatCurrency(item.unitPrice)}</strong>
                  {item.wholesalePriceApplied && item.retailPrice ? (
                    <small className="block text-muted-foreground line-through">
                      {formatCurrency(item.retailPrice)}
                    </small>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
        {customerIsWholesale && (
          <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
            Cliente mayorista: se aplica su tarifa cuando existe; si falta, verás el precio minorista claramente indicado.
          </p>
        )}
      </div>

      {/* Tabla o Lista de Repuestos */}
      {parts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground bg-slate-50/50 dark:bg-slate-900/20">
          <PackagePlus className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
          No hay repuestos ni servicios agregados a esta reparación.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Vista Escritorio: Tabla */}
          <div className="hidden overflow-x-auto rounded-xl border md:block bg-card">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="p-2.5 text-left">Concepto</th>
                  <th className="p-2.5 text-center w-24">Cantidad</th>
                  {canViewCost && <th className="p-2.5 text-right w-36">Costo interno</th>}
                  <th className="p-2.5 text-right w-40">Precio al cliente</th>
                  <th className="p-2.5 text-right w-32">Descuento</th>
                  <th className="p-2.5 text-center w-16">IVA</th>
                  <th className="p-2.5 text-right w-32">Subtotal</th>
                  <th className="p-2.5 w-12">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {parts.map((part, index) => (
                  <tr
                    key={part.key}
                    className={invalidPartKeys.has(part.key) ? 'bg-destructive/5' : 'hover:bg-muted/20'}
                  >
                    <td className="p-2.5 font-medium">
                      <span className="mb-1 inline-flex rounded-md border bg-muted px-1.5 py-0.5 text-[10px] uppercase font-semibold text-muted-foreground">
                        {part.lineType === 'service'
                          ? 'Servicio'
                          : part.lineType === 'included_material'
                          ? 'Material incluido'
                          : 'Repuesto cobrado'}
                      </span>
                      {part.productId ? (
                        <>
                          <div className="font-semibold text-foreground text-sm">{part.name}</div>
                          <small className="block font-mono text-muted-foreground">{part.partNumber}</small>
                        </>
                      ) : (
                        <>
                          <Input
                            aria-label="Nombre del concepto manual"
                            value={part.name}
                            disabled={disabled}
                            onChange={(event) => update(index, { name: event.target.value })}
                            className="h-8 text-xs font-medium"
                          />
                          <small className="mt-0.5 block text-[10px] text-muted-foreground">
                            Carga manual · no descuenta stock
                          </small>
                        </>
                      )}
                    </td>
                    <td className="p-2.5">
                      <NumericField
                        label={`Cantidad de ${part.name}`}
                        value={part.quantity}
                        disabled={disabled}
                        onChange={(quantity) => update(index, { quantity })}
                      />
                    </td>
                    {canViewCost && (
                      <td className="p-2.5 tabular-nums text-right">
                        {part.productId ? (
                          <div className="font-mono text-slate-700 dark:text-slate-300">
                            {formatCurrency(part.unitCost)}
                          </div>
                        ) : (
                          <NumericField
                            label={`Costo interno de ${part.name}`}
                            value={part.unitCost}
                            disabled={disabled}
                            onChange={(unitCost) => update(index, { unitCost })}
                            isCurrency
                          />
                        )}
                      </td>
                    )}
                    <td className="p-2.5 text-right">
                      {part.lineType === 'included_material' ? (
                        <div>
                          <strong className="tabular-nums font-mono text-xs">{formatCurrency(0)}</strong>
                          <small className="block text-[10px] text-muted-foreground">Incluido en servicio</small>
                        </div>
                      ) : (
                        <NumericField
                          label={`Precio al cliente de ${part.name}`}
                          value={part.unitPrice}
                          disabled={disabled}
                          onChange={(unitPrice) => update(index, { unitPrice })}
                          isCurrency
                        />
                      )}
                      {invalidPartKeys.has(part.key) && (
                        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-destructive font-medium">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Revisar precio
                        </p>
                      )}
                    </td>
                    <td className="p-2.5 text-right">
                      {part.lineType === 'included_material' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <NumericField
                          label={`Descuento de ${part.name}`}
                          value={part.discountAmount}
                          disabled={disabled}
                          onChange={(discountAmount) => update(index, { discountAmount })}
                          isCurrency
                        />
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono">{part.taxRate}%</td>
                    <td className="p-2.5 text-right font-bold tabular-nums text-sm">
                      {formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}
                    </td>
                    <td className="p-2.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        aria-label={`Eliminar ${part.name}`}
                        onClick={() => onChange(parts.filter((_, current) => current !== index))}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Tarjetas */}
          <div className="space-y-3 md:hidden">
            {parts.map((part, index) => (
              <section
                key={part.key}
                className={`rounded-xl border p-3 bg-card shadow-2xs ${
                  invalidPartKeys.has(part.key) ? 'border-destructive/50 bg-destructive/5' : ''
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-flex rounded-md border bg-muted px-1.5 py-0.5 text-[10px] uppercase font-semibold text-muted-foreground">
                      {part.lineType === 'service'
                        ? 'Servicio'
                        : part.lineType === 'included_material'
                        ? 'Material incluido'
                        : 'Repuesto cobrado'}
                    </span>
                    {part.productId ? (
                      <h4 className="font-bold text-sm text-foreground">{part.name}</h4>
                    ) : (
                      <>
                        <Input
                          aria-label="Nombre del concepto manual"
                          value={part.name}
                          disabled={disabled}
                          onChange={(event) => update(index, { name: event.target.value })}
                          className="text-xs h-8"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Carga manual · no descuenta stock
                        </p>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {canViewCost && `Costo: ${formatCurrency(part.unitCost)} · `}
                      IVA: {part.taxRate}%
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`Eliminar ${part.name}`}
                    onClick={() => onChange(parts.filter((_, current) => current !== index))}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground font-semibold">Cantidad</p>
                    <NumericField
                      label={`Cantidad de ${part.name}`}
                      value={part.quantity}
                      disabled={disabled}
                      onChange={(quantity) => update(index, { quantity })}
                    />
                  </div>
                  {canViewCost && !part.productId && (
                    <div>
                      <p className="mb-1 text-[11px] text-muted-foreground font-semibold">Costo interno</p>
                      <NumericField
                        label={`Costo interno de ${part.name}`}
                        value={part.unitCost}
                        disabled={disabled}
                        onChange={(unitCost) => update(index, { unitCost })}
                        isCurrency
                      />
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground font-semibold">Precio al cliente</p>
                    {part.lineType === 'included_material' ? (
                      <div className="rounded-lg border bg-muted/40 px-2 py-1.5 text-xs font-mono font-bold">
                        {formatCurrency(0)}
                        <small className="block text-[10px] text-muted-foreground font-normal">Incluido</small>
                      </div>
                    ) : (
                      <NumericField
                        label={`Precio al cliente de ${part.name}`}
                        value={part.unitPrice}
                        disabled={disabled}
                        onChange={(unitPrice) => update(index, { unitPrice })}
                        isCurrency
                      />
                    )}
                  </div>
                  {part.lineType !== 'included_material' && (
                    <div className={part.productId ? 'col-span-2' : ''}>
                      <p className="mb-1 text-[11px] text-muted-foreground font-semibold">Descuento</p>
                      <NumericField
                        label={`Descuento de ${part.name}`}
                        value={part.discountAmount}
                        disabled={disabled}
                        onChange={(discountAmount) => update(index, { discountAmount })}
                        isCurrency
                      />
                    </div>
                  )}
                </div>

                {invalidPartKeys.has(part.key) && (
                  <p className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    El precio queda debajo del costo de inventario.
                  </p>
                )}

                <div className="mt-3 flex justify-between items-center border-t pt-2 text-xs">
                  <span className="text-muted-foreground font-medium">Subtotal línea:</span>
                  <strong className="tabular-nums font-bold text-sm text-foreground">
                    {formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}
                  </strong>
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
