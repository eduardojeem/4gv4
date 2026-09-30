'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Barcode, BookOpenCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { classifyBarcode } from '@/lib/products/barcode-catalog'

export type GlobalProductMatch = {
  id: string
  gtin: string
  name: string
  description: string | null
  imageUrl: string | null
  brandName: string | null
  categoryName: string | null
  tenantBrandId: string | null
  tenantCategoryId: string | null
}

type LookupResult = {
  own: { id: string; name: string; variant: string | null } | null
  global: GlobalProductMatch | null
}

/**
 * Lo que dice el código de barras mientras se carga un producto: si la tienda
 * ya lo tiene cargado y, si es del fabricante y está en el catálogo global,
 * sus datos para completar el formulario de un toque.
 */
export function BarcodeAssist({
  code,
  excludeId,
  onApply,
}: {
  code: string
  /** El producto que se está editando: no cuenta como duplicado de sí mismo. */
  excludeId?: string | null
  onApply: (match: GlobalProductMatch) => void
}) {
  const { code: clean, kind } = classifyBarcode(code)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [appliedId, setAppliedId] = useState<string | null>(null)

  useEffect(() => {
    setResult(null)
    if (kind !== 'manufacturer' && kind !== 'internal') return
    const controller = new AbortController()
    // Espera a que termine de escribir (o de disparar el lector).
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ code: clean })
        if (excludeId) params.set('excludeId', excludeId)
        const response = await fetch(`/api/products/barcode-lookup?${params}`, { signal: controller.signal, cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (response.ok && payload?.success) setResult({ own: payload.data.own, global: payload.data.global })
      } catch {
        // Sin conexión o cancelado: el campo sigue funcionando igual.
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 350)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [clean, kind, excludeId])

  if (kind === 'empty') return null

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Barcode className="h-3.5 w-3.5" aria-hidden="true" />
        {kind === 'manufacturer' && 'Código del fabricante: se busca en el catálogo de la plataforma.'}
        {kind === 'internal' && 'Código interno de tu tienda (no se comparte con otras).'}
        {kind === 'invalid' && 'No es un EAN/UPC válido: revisá que no falte ni sobre un número.'}
        {loading && <Loader2 className="h-3 w-3 animate-spin" aria-label="Buscando" />}
      </p>

      {result?.own && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Ya tenés este código en <strong>{result.own.name}</strong>
            {result.own.variant ? ` (variante ${result.own.variant})` : ''}. Revisá que no lo estés cargando dos veces.
          </span>
        </div>
      )}

      {result?.global && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          {result.global.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.global.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md bg-white object-contain p-0.5" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-emerald-600 dark:bg-slate-900">
              <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-foreground">{result.global.name}</p>
            <p className="truncate text-muted-foreground">
              {[result.global.brandName, result.global.categoryName].filter(Boolean).join(' · ') || 'Catálogo de la plataforma'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={appliedId === result.global.id ? 'outline' : 'default'}
            onClick={() => { onApply(result.global!); setAppliedId(result.global!.id) }}
          >
            {appliedId === result.global.id ? 'Completado' : 'Completar datos'}
          </Button>
        </div>
      )}
    </div>
  )
}
