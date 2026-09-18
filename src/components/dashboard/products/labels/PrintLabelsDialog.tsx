'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Layers, Loader2, Printer, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { LABEL_LAYOUTS, DEFAULT_LABEL_LAYOUT_ID, labelsPerPage, layoutOrDefault, sheetsNeeded } from '@/lib/labels/label-layouts'
import { MAX_LABELS, type LabelFields } from '@/lib/labels/label-sheet'
import { buildLabelPreview, printProductLabels } from '@/lib/labels/print-labels'
import { resolveLabelCode } from '@/lib/labels/barcode-format'
import { cn } from '@/lib/utils'

/**
 * Imprimir las etiquetas de los productos elegidos.
 *
 * El sistema generaba el número del código de barras y lo leía con la pistola,
 * pero no había forma de imprimirlo: la etiqueta del estante se hacía a mano.
 */

export type LabelDialogProduct = {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  price?: number | null
  stock?: number | null
}

type Settings = {
  layoutId: string
  fields: LabelFields
}

const SETTINGS_KEY = '4g-label-settings-v1'

const DEFAULT_SETTINGS: Settings = {
  layoutId: DEFAULT_LABEL_LAYOUT_ID,
  fields: { showName: true, showPrice: true, showCode: true, showSku: false, showGuides: false },
}

function readSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      layoutId: typeof parsed.layoutId === 'string' ? parsed.layoutId : DEFAULT_SETTINGS.layoutId,
      fields: { ...DEFAULT_SETTINGS.fields, ...(parsed.fields ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Que no se pueda recordar la impresora no impide imprimir.
  }
}

export function PrintLabelsDialog({
  open,
  onOpenChange,
  products,
  storeName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: LabelDialogProduct[]
  storeName?: string | null
}) {
  // La impresora no cambia todos los días: se recuerda la última elección.
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [bulkQuantity, setBulkQuantity] = useState(1)
  const [preview, setPreview] = useState<string>('')
  const [building, setBuilding] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const layout = layoutOrDefault(settings.layoutId)

  const withoutCode = useMemo(
    () => products.filter((product) => !resolveLabelCode(product)),
    [products],
  )

  const printable = useMemo(
    () => products.filter((product) => resolveLabelCode(product)),
    [products],
  )

  const items = useMemo(
    () => printable.map((product) => ({
      ...product,
      quantity: quantities[product.id] ?? 1,
    })),
    [printable, quantities],
  )

  const totalLabels = useMemo(
    () => items.reduce((total, item) => total + Math.max(0, item.quantity), 0),
    [items],
  )

  const perPage = labelsPerPage(layout)
  const pages = sheetsNeeded(layout, Math.min(totalLabels, MAX_LABELS))

  // La vista previa se rearma sola, pero con un respiro: si no, cada tecla
  // apretada en las cantidades vuelve a dibujar todos los códigos.
  useEffect(() => {
    let vigente = true
    const timer = setTimeout(() => {
      void (async () => {
        if (!open || items.length === 0) {
          if (vigente) setPreview('')
          return
        }
        setBuilding(true)
        const result = await buildLabelPreview(items, settings.layoutId, {
          ...settings.fields,
          storeName: storeName ?? null,
        })
        if (!vigente) return
        setPreview(result.html)
        setBuilding(false)
      })()
    }, 250)

    return () => {
      vigente = false
      clearTimeout(timer)
    }
  }, [open, items, settings.layoutId, settings.fields, storeName])

  const updateFields = (patch: Partial<LabelFields>) => {
    setSettings((current) => {
      const next = { ...current, fields: { ...current.fields, ...patch } }
      saveSettings(next)
      return next
    })
  }

  const updateLayout = (layoutId: string) => {
    setSettings((current) => {
      const next = { ...current, layoutId }
      saveSettings(next)
      return next
    })
  }

  const applyBulkQuantity = () => {
    const quantity = Math.min(Math.max(Math.trunc(bulkQuantity) || 1, 0), 100)
    setQuantities(Object.fromEntries(printable.map((product) => [product.id, quantity])))
  }

  const applyStockQuantity = () => {
    setQuantities(
      Object.fromEntries(
        printable.map((product) => [product.id, Math.min(Math.max(Math.trunc(product.stock ?? 1), 1), 100)]),
      ),
    )
  }

  const handlePrint = async () => {
    setPrinting(true)
    setError(null)
    const outcome = await printProductLabels(items, settings.layoutId, {
      ...settings.fields,
      storeName: storeName ?? null,
    })
    setPrinting(false)

    if (outcome.ok === false) {
      setError(
        outcome.reason === 'popup-blocked'
          ? 'El navegador bloqueó la ventana de impresión. Permitila para este sitio y probá de nuevo.'
          : 'Ninguno de los productos elegidos tiene código de barras ni SKU.',
      )
      return
    }

    onOpenChange(false)
  }

  const thermal = LABEL_LAYOUTS.filter((item) => item.media === 'thermal')
  const sheets = LABEL_LAYOUTS.filter((item) => item.media === 'sheet')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-[18px] w-[18px] text-primary" aria-hidden />
            Imprimir etiquetas
          </DialogTitle>
          <DialogDescription>
            {products.length === 1
              ? 'Una etiqueta con el código de barras del producto, lista para pegar en el estante.'
              : `${products.length} productos elegidos. Elegí el formato de tu impresora y cuántas etiquetas de cada uno.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(92vh-9.5rem)] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5 overflow-y-auto border-border p-6 lg:border-r">
            <section className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Formato</p>

              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Impresora térmica</p>
              <div className="grid gap-2">
                {thermal.map((item) => (
                  <LayoutOption
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    hint={item.hint}
                    selected={settings.layoutId === item.id}
                    onSelect={updateLayout}
                  />
                ))}
              </div>

              <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Hoja de etiquetas</p>
              <div className="grid gap-2">
                {sheets.map((item) => (
                  <LayoutOption
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    hint={item.hint}
                    selected={settings.layoutId === item.id}
                    onSelect={updateLayout}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Qué lleva la etiqueta</p>
              <div className="grid grid-cols-2 gap-2">
                <FieldToggle
                  id="label-name"
                  label="Nombre"
                  checked={settings.fields.showName}
                  onChange={(checked) => updateFields({ showName: checked })}
                />
                <FieldToggle
                  id="label-price"
                  label="Precio"
                  checked={settings.fields.showPrice}
                  onChange={(checked) => updateFields({ showPrice: checked })}
                />
                <FieldToggle
                  id="label-code"
                  label="Número del código"
                  checked={settings.fields.showCode}
                  onChange={(checked) => updateFields({ showCode: checked })}
                />
                <FieldToggle
                  id="label-sku"
                  label="SKU"
                  checked={settings.fields.showSku}
                  onChange={(checked) => updateFields({ showSku: checked })}
                />
              </div>
              <FieldToggle
                id="label-guides"
                label="Marcar el borde de cada etiqueta"
                hint="Para probar la alineación en papel común antes de gastar el pliego."
                checked={Boolean(settings.fields.showGuides)}
                onChange={(checked) => updateFields({ showGuides: checked })}
              />
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Cuántas de cada uno</p>
                <div className="flex items-end gap-2">
                  <div className="w-20">
                    <Label htmlFor="label-bulk" className="text-xs text-muted-foreground">
                      Todas
                    </Label>
                    <Input
                      id="label-bulk"
                      type="number"
                      min={0}
                      max={100}
                      value={bulkQuantity}
                      onChange={(event) => setBulkQuantity(Number(event.target.value))}
                      className="h-8"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-8" onClick={applyBulkQuantity}>
                    Aplicar
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={applyStockQuantity}>
                    <Layers className="h-3.5 w-3.5" />
                    Una por unidad
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-56 rounded-xl border border-border">
                <ul className="divide-y divide-border">
                  {printable.map((product) => (
                    <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{product.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {resolveLabelCode(product)?.value}
                          {typeof product.stock === 'number' ? ` · ${product.stock} en stock` : ''}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`Etiquetas de ${product.name}`}
                        value={quantities[product.id] ?? 1}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [product.id]: Math.min(Math.max(Number(event.target.value) || 0, 0), 100),
                          }))
                        }
                        className="h-8 w-16"
                      />
                    </li>
                  ))}
                </ul>
              </ScrollArea>

              {withoutCode.length > 0 && (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span>
                    {withoutCode.length === 1
                      ? `«${withoutCode[0].name}» no tiene código de barras ni SKU, así que queda afuera.`
                      : `${withoutCode.length} productos quedan afuera porque no tienen código de barras ni SKU.`}
                  </span>
                </p>
              )}
            </section>
          </div>

          <div className="flex min-h-64 flex-col overflow-hidden bg-muted/30">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vista previa</p>
              <div className="flex items-center gap-2">
                {building && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
                <Badge variant="outline" className="tabular-nums">
                  {totalLabels} {totalLabels === 1 ? 'etiqueta' : 'etiquetas'}
                  {perPage ? ` · ${pages} ${pages === 1 ? 'hoja' : 'hojas'}` : ''}
                </Badge>
              </div>
            </div>
            {preview ? (
              <iframe
                title="Vista previa de las etiquetas"
                srcDoc={preview}
                className="h-full w-full flex-1 border-0 bg-white"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {items.length === 0
                  ? 'Ninguno de los productos elegidos tiene código de barras ni SKU.'
                  : 'Preparando la vista previa...'}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {totalLabels > MAX_LABELS
              ? `Se imprimen las primeras ${MAX_LABELS} etiquetas.`
              : layout.media === 'thermal'
                ? 'En la ventana de impresión, elegí tu impresora de etiquetas y dejá los márgenes en cero.'
                : 'Imprimí al 100% de escala: si el navegador ajusta el tamaño, las etiquetas se corren del adhesivo.'}
          </p>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handlePrint()} disabled={printing || totalLabels === 0} className="gap-2">
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir
            </Button>
          </div>
        </DialogFooter>

        {error && (
          <p className="border-t border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LayoutOption({
  id,
  label,
  hint,
  selected,
  onSelect,
}: {
  id: string
  label: string
  hint: string
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border p-3 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
      )}
    >
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}

function FieldToggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-normal text-foreground">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
