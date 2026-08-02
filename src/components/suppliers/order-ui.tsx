'use client'

import Image from 'next/image'
import { Minus, Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl } from '@/lib/images'

/**
 * Piezas compartidas entre el modal de creacion y el de detalle de un pedido
 * de compra, para que ambos muestren los productos de la misma forma.
 */

/** Los importes de compra son en la moneda del catalogo; por defecto guaranies. */
export function formatMoney(value: number | null | undefined, currency = 'PYG') {
    try {
        return new Intl.NumberFormat('es-PY', {
            style: 'currency',
            currency: currency || 'PYG',
            maximumFractionDigits: 0,
        }).format(Number(value) || 0)
    } catch {
        return `${currency} ${(Number(value) || 0).toLocaleString('es-PY')}`
    }
}

export function ProductThumb({
    url,
    name,
    size = 56,
}: {
    url?: string | null
    name: string
    size?: number
}) {
    const src = url ? resolveProductImageUrl(url) : null

    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-md border bg-muted"
            style={{ width: size, height: size }}
        >
            {src ? (
                <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
                    <Package className="h-1/3 w-1/3 text-muted-foreground/50" />
                </div>
            )}
            <span className="sr-only">{name}</span>
        </div>
    )
}

/** Selector de cantidad accesible por teclado; permite tipear el numero. */
export function QuantityStepper({
    value,
    onChange,
    label,
    size = 'md',
    disabled = false,
}: {
    value: number
    onChange: (next: number) => void
    label: string
    size?: 'sm' | 'md'
    disabled?: boolean
}) {
    const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'

    return (
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={buttonSize}
                disabled={disabled}
                aria-label={`Quitar una unidad de ${label}`}
                onClick={() => onChange(value - 1)}
            >
                <Minus className="h-3.5 w-3.5" />
            </Button>
            <input
                type="number"
                min={1}
                value={value}
                disabled={disabled}
                aria-label={`Cantidad de ${label}`}
                onChange={(event) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next)) onChange(Math.max(1, Math.trunc(next)))
                }}
                className="w-10 border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] focus:ring-0 disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={buttonSize}
                disabled={disabled}
                aria-label={`Agregar una unidad de ${label}`}
                onClick={() => onChange(value + 1)}
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}
