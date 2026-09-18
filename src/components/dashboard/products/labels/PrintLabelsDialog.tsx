'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Layers,
  Loader2,
  Minus,
  Plus,
  Printer,
  Store,
  Tag,
  X,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import {
  DEFAULT_LABEL_LAYOUT_ID,
  LABEL_LAYOUTS,
  isSheetMedia,
  labelsPerPage,
  layoutOrDefault,
  mediaSizeMm,
  sheetsNeeded,
  type LabelLayout,
} from '@/lib/labels/label-layouts'
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
const QUICK_QUANTITIES = [1, 2, 5, 10]
/** Milímetro a píxel de pantalla: 96 dpi. */
const MM_TO_PX = 96 / 25.4

const DEFAULT_SETTINGS: Settings = {
  layoutId: DEFAULT_LABEL_LAYOUT_ID,
  fields: {
    showName: true,
    showPrice: true,
    showCode: true,
    showSku: false,
    showGuides: false,
    showStoreName: false,
  },
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

/** Cuántas etiquetas se dibujan en la muestra: una hoja, o unas pocas del rollo. */
function previewSize(layout: LabelLayout): number {
  if (isSheetMedia(layout)) return labelsPerPage(layout) ?? 3
  // En el rollo cada etiqueta es una página: se muestran tres para ver la tira.
  return 3
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
  const [preview, setPreview] = useState('')
  const [shown, setShown] = useState(0)
  const [building, setBuilding] = useState(false)
  const [printing, setPrinting] = useState<'all' | 'test' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const frameBox = useRef<HTMLDivElement | null>(null)

  const { user } = useAuth()
  // El nombre del negocio sale de la organización de la sesión: antes había que
  // pasarlo por prop desde cada pantalla, así que nunca se imprimía.
  const business = (storeName ?? user?.organization?.name ?? '').trim()

  const layout = layoutOrDefault(settings.layoutId)
  const fields = settings.fields

  const withoutCode = useMemo(() => products.filter((product) => !resolveLabelCode(product)), [products])
  const printable = useMemo(() => products.filter((product) => resolveLabelCode(product)), [products])

  const items = useMemo(
    () => printable.map((product) => ({ ...product, quantity: quantities[product.id] ?? 1 })),
    [printable, quantities],
  )

  const totalLabels = useMemo(
    () => items.reduce((total, item) => total + Math.max(0, item.quantity), 0),
    [items],
  )
  const included = items.filter((item) => item.quantity > 0).length

  const sheetMedia = isSheetMedia(layout)
  const sheets = sheetMedia ? sheetsNeeded(layout, Math.min(totalLabels, MAX_LABELS)) : 0
  const size = mediaSizeMm(layout)
  const nothingSelected = !fields.showName && !fields.showPrice && !fields.showCode && !fields.showSku

  const previewFields = useMemo(
    () => ({ ...fields, storeName: fields.showStoreName ? business : null }),
    [fields, business],
  )

  // La muestra se rearma sola, con un respiro: si no, cada tecla apretada en
  // las cantidades vuelve a dibujar todos los códigos.
  useEffect(() => {
    let vigente = true
    const timer = setTimeout(() => {
      void (async () => {
        if (!open || totalLabels === 0) {
          if (vigente) setPreview('')
          return
        }
        setBuilding(true)
        const result = await buildLabelPreview(items, settings.layoutId, previewFields, {
          maxLabels: previewSize(layout),
        })
        if (!vigente) return
        setPreview(result.html)
        setShown(result.shown)
        setBuilding(false)
      })()
    }, 250)

    return () => {
      vigente = false
      clearTimeout(timer)
    }
  }, [open, items, totalLabels, settings.layoutId, previewFields, layout])

  /**
   * La hoja se dibuja en milímetros reales, así que hay que escalarla para que
   * entre en el panel: sin esto, una A4 se mostraba cortada por la mitad.
   *
   * Se mide en la propia referencia —cuando el nodo ya tiene tamaño— y después
   * en cada cambio de tamaño del panel. Medirlo desde un efecto llegaba tarde:
   * el modal todavía se estaba animando y el ancho daba cero.
   */
  const attachFrame = useCallback((node: HTMLDivElement | null) => {
    frameBox.current = node
    if (node) setFrameWidth(node.clientWidth)
  }, [])

  useEffect(() => {
    const node = frameBox.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setFrameWidth(node.clientWidth))
    observer.observe(node)
    return () => observer.disconnect()
  }, [open, preview])

  const pageWidthPx = layout.pageWidthMm * MM_TO_PX
  const pageHeightPx = (layout.pageHeightMm ?? layout.labelHeightMm + layout.gapYMm) * MM_TO_PX
  const previewScale = frameWidth > 0 ? Math.min(1, (frameWidth - 24) / pageWidthPx) : 1
  // En la hoja se muestra una sola; en el rollo, una página por etiqueta.
  const framePages = sheetMedia ? 1 : Math.max(1, shown)
  const frameHeightPx = pageHeightPx * framePages + (sheetMedia ? 40 : 24 * framePages)

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

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.min(Math.max(Math.trunc(quantity) || 0, 0), 100),
    }))
  }, [])

  const applyToAll = (quantity: number) => {
    setQuantities(Object.fromEntries(printable.map((product) => [product.id, quantity])))
  }

  const applyStock = () => {
    setQuantities(
      Object.fromEntries(
        printable.map((product) => [product.id, Math.min(Math.max(Math.trunc(product.stock ?? 1), 1), 100)]),
      ),
    )
  }

  const runPrint = async (mode: 'all' | 'test') => {
    const toPrint = mode === 'test'
      ? items.filter((item) => item.quantity > 0).slice(0, 1).map((item) => ({ ...item, quantity: 1 }))
      : items

    setPrinting(mode)
    setError(null)
    const outcome = await printProductLabels(toPrint, settings.layoutId, previewFields)
    setPrinting(null)

    if (outcome.ok === false) {
      setError(
        outcome.reason === 'popup-blocked'
          ? 'El navegador bloqueó la ventana de impresión. Permitila para este sitio y probá de nuevo.'
          : 'Ninguno de los productos elegidos tiene código de barras ni SKU.',
      )
      return
    }

    // La prueba deja el diálogo abierto: casi siempre se ajusta algo y se
    // vuelve a imprimir.
    if (mode === 'all') onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:` es obligatorio: DialogContent trae `sm:max-w-lg`, y un
          `max-w-5xl` sin variante pierde contra el responsive. El modal venía
          rindiendo 512 px de ancho, y de ahí que todo se viera apretado. */}
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="h-[18px] w-[18px] text-primary" aria-hidden />
            Imprimir etiquetas
          </DialogTitle>
          <DialogDescription>
            {products.length === 1
              ? 'Una etiqueta con el código de barras, lista para pegar en el estante.'
              : `${products.length} productos elegidos. Elegí el formato, qué lleva la etiqueta y cuántas de cada uno.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="min-h-0 space-y-6 overflow-y-auto p-5 lg:border-r lg:border-border">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">1. Formato</h3>
                <span className="text-xs text-muted-foreground">{layout.hint}</span>
              </div>

              <LayoutGroup
                title="Impresora térmica"
                subtitle="El papel mide lo que la etiqueta"
                icon={Printer}
                layouts={LABEL_LAYOUTS.filter((item) => item.media === 'thermal')}
                selected={layout.id}
                onSelect={updateLayout}
              />

              <LayoutGroup
                title="Hoja de etiquetas"
                subtitle="Pliego A4 autoadhesivo"
                icon={Layers}
                layouts={LABEL_LAYOUTS.filter((item) => item.media === 'sheet')}
                selected={layout.id}
                onSelect={updateLayout}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">2. Qué lleva la etiqueta</h3>
              <div className="grid grid-cols-2 gap-2">
                <FieldToggle
                  id="label-name"
                  label="Nombre del producto"
                  checked={fields.showName}
                  onChange={(checked) => updateFields({ showName: checked })}
                />
                <FieldToggle
                  id="label-price"
                  label="Precio"
                  checked={fields.showPrice}
                  onChange={(checked) => updateFields({ showPrice: checked })}
                />
                <FieldToggle
                  id="label-code"
                  label="Número del código"
                  checked={fields.showCode}
                  onChange={(checked) => updateFields({ showCode: checked })}
                />
                <FieldToggle
                  id="label-sku"
                  label="SKU"
                  checked={fields.showSku}
                  onChange={(checked) => updateFields({ showSku: checked })}
                />
              </div>

              <FieldToggle
                id="label-store"
                label={business ? `Nombre del negocio (${business})` : 'Nombre del negocio'}
                hint={business ? undefined : 'Cargá el nombre en la configuración del negocio para usarlo.'}
                icon={Store}
                disabled={!business}
                checked={Boolean(fields.showStoreName) && Boolean(business)}
                onChange={(checked) => updateFields({ showStoreName: checked })}
              />
              <FieldToggle
                id="label-guides"
                label="Marcar el borde de cada etiqueta"
                hint="Para probar la alineación en papel común antes de gastar el pliego."
                checked={Boolean(fields.showGuides)}
                onChange={(checked) => updateFields({ showGuides: checked })}
              />

              {nothingSelected && (
                <Notice tone="warning">
                  Sin nombre, precio, código ni SKU la etiqueta sale con las barras solas.
                </Notice>
              )}
              {layout.compact && (fields.showStoreName || (fields.showName && fields.showSku)) && (
                <Notice tone="info">
                  En una etiqueta de {size.widthMm} × {size.heightMm} mm entra poco: si ves el texto
                  apretado en la muestra, dejá solo el precio y el código.
                </Notice>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">3. Cuántas de cada uno</h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_QUANTITIES.map((quantity) => (
                    <Button
                      key={quantity}
                      variant="outline"
                      size="sm"
                      className="h-7 w-9 px-0 text-xs tabular-nums"
                      onClick={() => applyToAll(quantity)}
                    >
                      {quantity}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={applyStock}>
                    <Layers className="h-3.5 w-3.5" />
                    Una por unidad
                  </Button>
                </div>
              </div>

              <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {printable.map((product) => {
                  const quantity = quantities[product.id] ?? 1
                  const code = resolveLabelCode(product)
                  return (
                    <li
                      key={product.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 transition-opacity',
                        quantity === 0 && 'opacity-50',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{product.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {code?.value}
                          {code?.format === 'CODE128' && !product.barcode?.trim() ? ' · SKU' : ''}
                          {typeof product.stock === 'number' ? ` · ${product.stock} en stock` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Una etiqueta menos de ${product.name}`}
                          onClick={() => setQuantity(product.id, quantity - 1)}
                          disabled={quantity <= 0}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Etiquetas de ${product.name}`}
                          value={quantity}
                          onChange={(event) => setQuantity(product.id, Number(event.target.value))}
                          className="h-7 w-14 text-center tabular-nums"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Una etiqueta más de ${product.name}`}
                          onClick={() => setQuantity(product.id, quantity + 1)}
                          disabled={quantity >= 100}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {products.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            aria-label={`Sacar ${product.name} de la tirada`}
                            onClick={() => setQuantity(product.id, 0)}
                            disabled={quantity === 0}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {withoutCode.length > 0 && (
                <Notice tone="warning">
                  {withoutCode.length === 1
                    ? `«${withoutCode[0].name}» no tiene código de barras ni SKU, así que queda afuera.`
                    : `${withoutCode.length} productos quedan afuera porque no tienen código de barras ni SKU.`}
                </Notice>
              )}
            </section>
          </div>

          <div className="flex min-h-64 flex-col overflow-hidden bg-muted/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Muestra</p>
                <Badge variant="secondary" className="tabular-nums text-[11px]">
                  {size.widthMm} × {size.heightMm} mm
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {building && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
                <span className="text-xs text-muted-foreground">
                  {sheetMedia
                    ? `Hoja 1 de ${Math.max(sheets, 1)}`
                    : totalLabels > shown
                      ? `Primeras ${shown} de ${totalLabels}`
                      : totalLabels === 1
                        ? 'La etiqueta completa'
                        : `Las ${totalLabels} etiquetas`}
                </span>
              </div>
            </div>

            <div ref={attachFrame} className="min-h-0 flex-1 overflow-auto p-3">
              {preview ? (
                <div
                  className="mx-auto"
                  style={{ width: pageWidthPx * previewScale, height: frameHeightPx * previewScale }}
                >
                  <iframe
                    title="Muestra de las etiquetas"
                    srcDoc={preview}
                    tabIndex={-1}
                    className="border-0 bg-white"
                    style={{
                      width: pageWidthPx,
                      height: frameHeightPx,
                      transform: `scale(${previewScale})`,
                      transformOrigin: 'top left',
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {printable.length === 0
                    ? 'Ninguno de los productos elegidos tiene código de barras ni SKU.'
                    : totalLabels === 0
                      ? 'Poné al menos una etiqueta para ver la muestra.'
                      : 'Preparando la muestra...'}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="border-t border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col items-stretch gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground tabular-nums">
              {totalLabels} {totalLabels === 1 ? 'etiqueta' : 'etiquetas'}
              {included > 1 ? ` · ${included} productos` : ''}
              {sheetMedia && sheets > 0 ? ` · ${sheets} ${sheets === 1 ? 'hoja' : 'hojas'}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalLabels > MAX_LABELS
                ? `Se imprimen las primeras ${MAX_LABELS}.`
                : layout.media === 'thermal'
                  ? 'Elegí tu impresora de etiquetas y dejá los márgenes en cero.'
                  : 'Imprimí al 100%: si el navegador ajusta la escala, se corren del adhesivo.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => void runPrint('test')}
              disabled={printing !== null || totalLabels === 0}
              className="gap-2"
              title="Imprime una sola etiqueta para revisar la alineación"
            >
              {printing === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Probar con una
            </Button>
            <Button
              onClick={() => void runPrint('all')}
              disabled={printing !== null || totalLabels === 0}
              className="gap-2"
            >
              {printing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir {totalLabels > 0 ? totalLabels : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LayoutGroup({
  title,
  subtitle,
  icon: Icon,
  layouts,
  selected,
  onSelect,
}: {
  title: string
  subtitle: string
  icon: typeof Printer
  layouts: LabelLayout[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <span className="text-xs text-muted-foreground/80">· {subtitle}</span>
      </div>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-2">
        {layouts.map((item) => (
          <LayoutOption
            key={item.id}
            layout={item}
            selected={selected === item.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * La tarjeta dibuja la etiqueta a escala: «50 × 25 mm» dice poco hasta que se
 * ve que es más ancha que alta.
 */
function LayoutOption({
  layout,
  selected,
  onSelect,
}: {
  layout: LabelLayout
  selected: boolean
  onSelect: (id: string) => void
}) {
  const size = mediaSizeMm(layout)
  const width = 34
  const height = Math.max(10, Math.min(30, (size.heightMm / size.widthMm) * width))

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={layout.label}
      onClick={() => onSelect(layout.id)}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:border-primary/40',
      )}
    >
      <span className="flex h-8 w-9 flex-shrink-0 items-center justify-center" aria-hidden>
        <span
          className={cn(
            'block rounded-[2px] border',
            selected ? 'border-primary bg-primary/20' : 'border-muted-foreground/50 bg-muted',
          )}
          style={{ width, height }}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{layout.short}</span>
        <span className="block text-[11px] text-muted-foreground">
          {layout.media === 'sheet'
            ? `${layout.columns} × ${layout.rows} · ${size.widthMm} × ${size.heightMm} mm`
            : layout.pageHeightMm === null
              ? 'Tira continua'
              : 'Una por vez'}
        </span>
      </span>
    </button>
  )
}

function FieldToggle({
  id,
  label,
  hint,
  icon: Icon,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  icon?: typeof Building2
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className={cn('flex items-start gap-2', disabled && 'opacity-60')}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-sm font-normal text-foreground">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'warning' | 'info'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex gap-2 rounded-xl border p-2.5 text-xs',
        tone === 'warning'
          ? 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
