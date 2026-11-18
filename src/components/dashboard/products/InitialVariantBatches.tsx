'use client'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { ProductVariantInput } from '@/lib/products/variant-contract'
import type { z } from 'zod'
import type { InitialVariantBatchSchema } from '@/lib/products/catalog-contract'
type Row = z.infer<typeof InitialVariantBatchSchema>

export function InitialVariantBatches({ variants, value, onChange, disabled, fallback }: { variants: ProductVariantInput[]; value: Row[]; onChange: (rows: Row[]) => void; disabled?: boolean; fallback?: { lot_code?: string | null; expires_on?: string | null } }) {
  const id = useId()
  const [date, setDate] = useState('')
  const [lot, setLot] = useState('')
  const eligible = variants.filter(v => v.isActive && v.stockQuantity > 0)
  const update = (key: string, patch: Partial<Row>) => {
    const current = value.find(row => row.variant_key === key) ?? { variant_key: key, ...fallback }
    onChange([...value.filter(row => row.variant_key !== key), { ...current, ...patch }])
  }
  return <section className="space-y-3 rounded-xl border bg-background p-4"><h3 className="text-sm font-semibold">Lotes iniciales por variante</h3><p className="text-xs leading-relaxed text-muted-foreground">Opcional. Cada presentación puede vencer en una fecha distinta. Se registra la cantidad inicial de esa variante en la sucursal seleccionada; no suma stock adicional.</p>
    {!eligible.length ? <p className="text-xs text-muted-foreground">Generá las variantes y cargá stock en las que recibiste para registrar sus lotes.</p> : <>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-medium">Aplicar la misma fecha y lote a todas las variantes con stock</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs">Vencimiento<Input type="date" value={date} disabled={disabled} onChange={e => setDate(e.target.value)} /></label><label className="text-xs">Código del lote (opcional)<Input value={lot} maxLength={60} disabled={disabled} onChange={e => setLot(e.target.value)} /></label><Button type="button" size="sm" variant="outline" disabled={disabled || !date} onClick={() => onChange(eligible.map(v => ({ variant_key: v.clientKey, expires_on: date, lot_code: lot })))}>Aplicar a {eligible.length} variantes</Button></div></details>
      <div className={eligible.length > 6 ? "max-h-80 space-y-3 overflow-y-auto overscroll-contain" : "space-y-3"}>{eligible.map((v, index) => { const batch = value.find(row => row.variant_key === v.clientKey) ?? fallback; return <fieldset disabled={disabled} key={v.clientKey} className="space-y-2 rounded-lg border p-3"><legend className="max-w-full break-words px-1 text-xs font-semibold">{v.name} · {v.stockQuantity} un.</legend><p className="break-all text-xs text-muted-foreground">SKU: {v.sku}</p><div className="grid gap-2 sm:grid-cols-2"><div><label htmlFor={`${id}-${index}-date`} className="text-xs">Vencimiento</label><Input id={`${id}-${index}-date`} type="date" value={batch?.expires_on ?? ''} onChange={e => update(v.clientKey, { expires_on: e.target.value })} /></div><div><label htmlFor={`${id}-${index}-lot`} className="text-xs">Lote (opcional)</label><Input id={`${id}-${index}-lot`} value={batch?.lot_code ?? ''} maxLength={60} onChange={e => update(v.clientKey, { lot_code: e.target.value })} /></div></div>{batch?.lot_code && !batch.expires_on && <p role="alert" className="text-xs text-destructive">Agregá una fecha de vencimiento para este lote.</p>}</fieldset> })}</div>
    </>}
  </section>
}
