'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, History, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SUPPORTED_CURRENCIES, formatCurrency } from '@/lib/currency'
import { ROUNDING_OPTIONS, convertWithRounding, type ExchangeRate } from '@/lib/products/foreign-price'

type HistoryRow = { id: string; currency: string; previous_rate: number | null; rate: number; products_updated: number; created_at: string }

export type ExchangeRatesState = {
  available: boolean
  canEdit: boolean
  localCurrency: string
  rates: ExchangeRate[]
  history: HistoryRow[]
  usage: Record<string, number>
}

/** Lee los tipos de cambio de la empresa. Lo usan esta pantalla y el formulario de productos. */
export function useExchangeRates() {
  const [state, setState] = useState<ExchangeRatesState | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/exchange-rates', { cache: 'no-store' })
      if (response.ok) setState(await response.json())
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { state, loading, reload }
}

function formatRate(rate: number, local: string) {
  return formatCurrency(rate, { currency: local, maximumFractionDigits: rate < 100 ? 4 : 2 })
}

function RateRow({
  rate,
  local,
  usage,
  canEdit,
  onSaved,
}: {
  rate: ExchangeRate
  local: string
  usage: number
  canEdit: boolean
  onSaved: () => void
}) {
  const [value, setValue] = useState(String(rate.rate))
  const [rounding, setRounding] = useState(String(rate.rounding))
  const [saving, setSaving] = useState(false)
  const parsed = Number(value.replace(',', '.'))
  const dirty = parsed !== rate.rate || Number(rounding) !== rate.rounding
  const valid = Number.isFinite(parsed) && parsed > 0

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: rate.currency, rate: parsed, rounding: Number(rounding) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar el tipo de cambio')
        return
      }
      const updated = Number(body.result?.products_updated ?? 0)
      toast.success(`Tipo de cambio de ${rate.currency} actualizado`, {
        description: updated ? `Se recalcularon los precios de ${updated} producto${updated === 1 ? '' : 's'}.` : undefined,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const response = await fetch(`/api/exchange-rates?currency=${rate.currency}`, { method: 'DELETE' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(body.error || 'No se pudo borrar la moneda')
      return
    }
    toast.success(`${rate.currency} eliminada`)
    onSaved()
  }

  return (
    <li className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-bold text-primary">{rate.currency}</span>
          <span className="text-sm">1 {rate.currency} = <b>{formatRate(rate.rate, local)}</b></span>
        </div>
        <Badge variant="outline" className="text-xs">{usage} producto{usage === 1 ? '' : 's'}</Badge>
      </div>
      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor={`rate-${rate.currency}`} className="text-xs">Nuevo tipo de cambio ({local})</Label>
            <Input id={`rate-${rate.currency}`} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Redondeo</Label>
            <Select value={rounding} onValueChange={setRounding}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUNDING_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            <Button onClick={save} disabled={!dirty || !valid || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
            </Button>
            {usage === 0 && (
              <Button variant="ghost" size="icon" onClick={remove} aria-label={`Borrar ${rate.currency}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
      {canEdit && dirty && valid && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          Ejemplo: {rate.currency} 100 <ArrowRight className="h-3 w-3" /> {formatCurrency(convertWithRounding(100, parsed, Number(rounding)), { currency: local })}
          {usage > 0 && <> · se recalculan {usage} producto{usage === 1 ? '' : 's'} al guardar</>}
        </p>
      )}
    </li>
  )
}

export function ExchangeRatesManager({ onChanged }: { onChanged?: () => void }) {
  const { state, loading, reload } = useExchangeRates()
  const [newCurrency, setNewCurrency] = useState('')
  const [newRate, setNewRate] = useState('')
  const [adding, setAdding] = useState(false)

  const refresh = () => {
    void reload()
    onChanged?.()
  }

  const available = useMemo(
    () => SUPPORTED_CURRENCIES.filter((currency) => currency.code !== state?.localCurrency && !state?.rates.some((rate) => rate.currency === currency.code)),
    [state],
  )

  const add = async () => {
    const rate = Number(newRate.replace(',', '.'))
    if (!newCurrency || !(rate > 0)) return
    setAdding(true)
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency, rate, rounding: state?.localCurrency === 'PYG' ? 100 : 1 }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo agregar la moneda')
        return
      }
      toast.success(`${newCurrency} agregada`)
      setNewCurrency('')
      setNewRate('')
      refresh()
    } finally {
      setAdding(false)
    }
  }

  if (loading && !state) {
    return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando monedas…</p>
  }
  if (!state) return <p className="py-6 text-sm text-muted-foreground">No se pudieron cargar las monedas.</p>
  if (!state.available) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        Falta activar los precios en otra moneda en la base de datos. Pedile al administrador de la plataforma que aplique la actualización.
      </p>
    )
  }

  const local = state.localCurrency

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tu moneda es <b>{local}</b>. Cargá el tipo de cambio de las monedas en las que comprás o ponés precio: los productos con precio en esa moneda se recalculan solos cada vez que lo actualizás, y el cambio queda en el historial de precios.
      </p>

      {state.rates.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no cargaste ninguna moneda.</p>
      ) : (
        <ul className="space-y-2">
          {state.rates.map((rate) => (
            <RateRow key={rate.currency} rate={rate} local={local} usage={state.usage[rate.currency] ?? 0} canEdit={state.canEdit} onSaved={refresh} />
          ))}
        </ul>
      )}

      {state.canEdit && available.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Agregar moneda</Label>
            <Select value={newCurrency} onValueChange={setNewCurrency}>
              <SelectTrigger><SelectValue placeholder="Elegí una moneda" /></SelectTrigger>
              <SelectContent>
                {available.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code} — {currency.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-rate" className="text-xs">1 {newCurrency || 'unidad'} = ¿cuántos {local}?</Label>
            <Input id="new-rate" inputMode="decimal" placeholder={local === 'PYG' ? '7450' : '1'} value={newRate} onChange={(event) => setNewRate(event.target.value)} />
          </div>
          <Button onClick={add} disabled={!newCurrency || !(Number(newRate.replace(',', '.')) > 0) || adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar
          </Button>
        </div>
      )}

      {!state.canEdit && <p className="text-xs text-muted-foreground">Solo el dueño o un administrador puede cambiar el tipo de cambio.</p>}

      {state.history.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History className="h-3.5 w-3.5" /> Últimos cambios</p>
          <ul className="divide-y rounded-lg border text-xs">
            {state.history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <b>{row.currency}</b> {row.previous_rate ? `${formatRate(Number(row.previous_rate), local)} → ` : ''}{formatRate(Number(row.rate), local)}
                  {row.products_updated > 0 && <span className="text-muted-foreground"> · {row.products_updated} productos</span>}
                </span>
                <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
