'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form'
import { DollarSign, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { convertCost, convertWithRounding } from '@/lib/products/foreign-price'
import { useExchangeRates } from '@/components/dashboard/currency/ExchangeRatesManager'

type ForeignPriceFields = {
  price_currency?: string | null
  foreign_sale_price?: number | null
  foreign_wholesale_price?: number | null
  foreign_purchase_price?: number | null
  sale_price: number
  wholesale_price?: number | null
  purchase_price: number
}

const LOCAL = '__local__'

function toNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Precio en dólares (u otra moneda). Con moneda elegida, los precios en
 * moneda local se calculan con el tipo de cambio y se ven acá mismo; al
 * guardar, la base hace la misma cuenta y los mantiene al día cuando cambia
 * el tipo de cambio.
 */
export function ForeignPriceSection<T extends FieldValues & ForeignPriceFields>({
  form,
  canViewCost,
  hasVariants,
}: {
  form: UseFormReturn<T>
  canViewCost: boolean
  hasVariants: boolean
}) {
  const { state } = useExchangeRates()
  const set = <K extends Path<T>>(name: K, value: unknown) =>
    form.setValue(name, value as PathValue<T, K>, { shouldDirty: true, shouldValidate: true })

  const currency = (form.watch('price_currency' as Path<T>) as string | null) || ''
  const foreignSale = toNumber(form.watch('foreign_sale_price' as Path<T>))
  const foreignWholesale = toNumber(form.watch('foreign_wholesale_price' as Path<T>))
  const foreignPurchase = toNumber(form.watch('foreign_purchase_price' as Path<T>))
  const rate = state?.rates.find((item) => item.currency === currency) ?? null
  const local = state?.localCurrency ?? 'PYG'

  // Mientras se tipea, los precios locales siguen al tipo de cambio. Solo si
  // cambian: abrir un producto en dólares no lo marca como modificado.
  useEffect(() => {
    if (!rate) return
    const follow = (name: string, value: number) => {
      if (Number(form.getValues(name as Path<T>)) !== value) set(name as Path<T>, value)
    }
    if (foreignSale !== null) follow('sale_price', convertWithRounding(foreignSale, rate.rate, rate.rounding))
    if (foreignWholesale !== null) follow('wholesale_price', convertWithRounding(foreignWholesale, rate.rate, rate.rounding))
    if (canViewCost && foreignPurchase !== null) follow('purchase_price', convertCost(foreignPurchase, rate.rate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate?.rate, rate?.rounding, foreignSale, foreignWholesale, foreignPurchase, canViewCost])

  if (!state?.available) return null
  // El producto ya está en otra moneda pero ahora tiene variantes: se muestra igual para poder sacarlo.
  if (hasVariants && !currency) return null

  const chooseCurrency = (value: string) => {
    if (value === LOCAL) {
      set('price_currency' as Path<T>, null)
      set('foreign_sale_price' as Path<T>, null)
      set('foreign_wholesale_price' as Path<T>, null)
      set('foreign_purchase_price' as Path<T>, null)
      return
    }
    const next = state.rates.find((item) => item.currency === value)
    set('price_currency' as Path<T>, value)
    // Primera vez: se propone el precio actual convertido, para no arrancar en cero.
    if (next && foreignSale === null) {
      const current = Number(form.getValues('sale_price' as Path<T>)) || 0
      if (current > 0) set('foreign_sale_price' as Path<T>, Math.round((current / next.rate) * 100) / 100)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <DollarSign className="h-4 w-4 text-sky-600" /> Moneda del precio
        </Label>
        <Select value={currency || LOCAL} onValueChange={chooseCurrency}>
          <SelectTrigger className="h-9 w-[220px] bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={LOCAL}>{local} (moneda de la empresa)</SelectItem>
            {state.rates.map((item) => (
              <SelectItem key={item.currency} value={item.currency}>
                {item.currency} · 1 = {formatCurrency(item.rate, { currency: local })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.rates.length === 0 && !currency && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ¿Ponés precios en dólares? Cargá el tipo de cambio en <Link href="/admin/settings#monedas" className="font-medium text-primary underline">Configuración → Monedas</Link> y elegí la moneda acá.
        </p>
      )}

      {currency && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="foreign_sale_price" className="text-xs">Precio de venta ({currency})</Label>
              <Input
                id="foreign_sale_price"
                type="number"
                step="0.01"
                min="0"
                className="bg-background font-semibold"
                value={foreignSale ?? ''}
                onChange={(event) => set('foreign_sale_price' as Path<T>, toNumber(event.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="foreign_wholesale_price" className="text-xs">Mayorista ({currency}, opcional)</Label>
              <Input
                id="foreign_wholesale_price"
                type="number"
                step="0.01"
                min="0"
                className="bg-background"
                value={foreignWholesale ?? ''}
                onChange={(event) => set('foreign_wholesale_price' as Path<T>, toNumber(event.target.value))}
              />
            </div>
            {canViewCost && (
              <div className="space-y-1">
                <Label htmlFor="foreign_purchase_price" className="text-xs">Costo ({currency}, opcional)</Label>
                <Input
                  id="foreign_purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="bg-background"
                  value={foreignPurchase ?? ''}
                  onChange={(event) => set('foreign_purchase_price' as Path<T>, toNumber(event.target.value))}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-sky-800 dark:text-sky-300">
            {rate
              ? <>Con 1 {currency} = {formatCurrency(rate.rate, { currency: local })}, el precio queda en <b>{formatCurrency(convertWithRounding(foreignSale ?? 0, rate.rate, rate.rounding), { currency: local })}</b>. Se actualiza solo cada vez que cambiás el tipo de cambio.</>
              : <>No hay tipo de cambio cargado para {currency}. Cargalo en <Link href="/admin/settings#monedas" className="underline">Configuración → Monedas</Link>.</>}
          </p>
          {hasVariants && (
            <p className="text-xs text-amber-700 dark:text-amber-300">Las variantes mantienen su propio precio en {local}.</p>
          )}
        </>
      )}
    </div>
  )
}
