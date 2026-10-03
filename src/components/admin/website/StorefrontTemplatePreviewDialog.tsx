'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ExternalLink, Globe, Home, Laptop, Loader2, ShoppingBag, Smartphone, Sparkles, Tablet, Tag } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { BrandColorScope, StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import { BRAND_COLORS } from '@/lib/website/brand-colors'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import {
  STOREFRONT_HEADER_OPTIONS,
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  headerOptionFor,
  resolveStorefrontStyle,
  type StorefrontStylePreference,
} from '@/lib/website/storefront-style'
import {
  STOREFRONT_PREVIEW_READY,
  STOREFRONT_PREVIEW_UPDATE,
  type StorefrontPreviewDraft,
} from '@/lib/website/storefront-preview-message'
import type { CompanyInfo } from '@/types/website-settings'
import { cn } from '@/lib/utils'

type PreviewPage = 'inicio' | 'productos' | 'ofertas'
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'
type PanelTab = 'template' | 'look'

const PAGES: ReadonlyArray<{ value: PreviewPage; label: string; icon: typeof Home }> = [
  { value: 'inicio', label: 'Inicio', icon: Home },
  { value: 'productos', label: 'Catálogo', icon: ShoppingBag },
  { value: 'ofertas', label: 'Ofertas', icon: Tag },
]

const DEVICES: ReadonlyArray<{ value: PreviewDevice; label: string; icon: typeof Laptop; width: number }> = [
  { value: 'desktop', label: 'Computadora', icon: Laptop, width: 1280 },
  { value: 'tablet', label: 'Tablet', icon: Tablet, width: 820 },
  { value: 'mobile', label: 'Celular', icon: Smartphone, width: 390 },
]

/** Lo que el modal deja editar: plantilla, color, encabezado y barra de contacto. */
export interface StorefrontLook {
  storefrontStyle: StorefrontStylePreference
  brandColor: string
  customBrandColor?: string
  headerStyle: StorefrontPreviewDraft['headerStyle']
  showTopBar: boolean
}

interface StorefrontTemplatePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Lo elegido hoy en el formulario (puede no estar guardado). */
  initial: StorefrontLook
  /** Recibe solo lo que cambió, listo para sumar al borrador del formulario. */
  onApply: (changes: Partial<CompanyInfo>) => void
  businessVertical?: string | null
  suggestedStyle?: StorefrontStylePreference
  /** `/slug` de la tienda publicada; `null` si todavía no se puede abrir. */
  storePath: string | null
}

export function StorefrontTemplatePreviewDialog({
  open,
  onOpenChange,
  initial,
  onApply,
  businessVertical,
  suggestedStyle,
  storePath,
}: StorefrontTemplatePreviewDialogProps) {
  // Se monta al abrirse (ver StorefrontAppearanceEditor): arranca desde lo elegido en el formulario.
  const [look, setLook] = useState<StorefrontLook>(initial)
  const [tab, setTab] = useState<PanelTab>('template')
  const [page, setPage] = useState<PreviewPage>('inicio')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [isLoading, setIsLoading] = useState(true)
  const update = (patch: Partial<StorefrontLook>) => setLook((current) => ({ ...current, ...patch }))

  const candidateStyle = resolveStorefrontStyle(look.storefrontStyle, businessVertical)
  const meta = STOREFRONT_TEMPLATES_METADATA[candidateStyle]
  const templateLabel = look.storefrontStyle === 'auto' ? `Automático (${STOREFRONT_STYLE_LABELS[candidateStyle]})` : STOREFRONT_STYLE_LABELS[candidateStyle]
  const colorLabel = look.brandColor === 'custom' ? 'personalizado' : BRAND_COLORS.find((color) => color.key === look.brandColor)?.name ?? look.brandColor
  const headerLabel = STOREFRONT_HEADER_OPTIONS.find((option) => option.value === headerOptionFor(look.headerStyle))?.label ?? ''

  const changes = useMemo(() => {
    const diff: Partial<CompanyInfo> = {}
    if (look.storefrontStyle !== initial.storefrontStyle) diff.storefrontStyle = look.storefrontStyle
    if (look.brandColor !== initial.brandColor) diff.brandColor = look.brandColor as CompanyInfo['brandColor']
    if (look.headerStyle !== initial.headerStyle) diff.headerStyle = look.headerStyle
    if (look.showTopBar !== initial.showTopBar) diff.showTopBar = look.showTopBar
    return diff
  }, [look, initial])
  const hasChanges = Object.keys(changes).length > 0

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const postDraft = useCallback(() => {
    const draft: StorefrontPreviewDraft = {
      style: candidateStyle,
      brandColor: look.brandColor,
      customBrandColor: look.customBrandColor,
      headerStyle: look.headerStyle,
      showTopBar: look.showTopBar,
    }
    iframeRef.current?.contentWindow?.postMessage({ type: STOREFRONT_PREVIEW_UPDATE, ...draft }, window.location.origin)
  }, [candidateStyle, look.brandColor, look.customBrandColor, look.headerStyle, look.showTopBar])

  // La tienda avisa cuando está lista para recibir el borrador.
  useEffect(() => {
    if (!open || !storePath) return
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if ((event.data as { type?: string } | null)?.type !== STOREFRONT_PREVIEW_READY) return
      postDraft()
      setIsLoading(false)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [open, storePath, postDraft])

  // Cada cambio se repinta al instante, sin recargar la tienda.
  useEffect(() => {
    if (open && storePath) postDraft()
  }, [open, storePath, postDraft])

  // Si la tienda no responde (por ejemplo, una versión vieja en caché), no dejar el spinner para siempre.
  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => setIsLoading(false), 8000)
    return () => clearTimeout(timer)
  }, [isLoading])

  // El iframe se dibuja al ancho real del dispositivo y se escala para entrar en pantalla,
  // así la tienda muestra su diseño de escritorio aunque el modal sea más angosto.
  // Callback ref: el contenido del Dialog se monta en un portal después del primer efecto.
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)
  const stageRef = useCallback((stage: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!stage) return
    const { width, height } = stage.getBoundingClientRect()
    setStageSize({ width, height })
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(stage)
    observerRef.current = observer
  }, [])

  const deviceWidth = DEVICES.find((item) => item.value === device)?.width ?? 1280
  const scale = stageSize.width ? Math.min(1, stageSize.width / deviceWidth) : 1
  const frameHeight = stageSize.height ? stageSize.height / scale : 720
  const iframeSrc = storePath ? `${storePath}/${page}` : ''

  const apply = () => {
    onApply(changes)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[1400px] sm:rounded-2xl">
        <div className="shrink-0 border-b px-4 py-3 pr-12 sm:px-6">
          <DialogTitle className="text-base font-semibold">Diseñá tu tienda</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            {storePath
              ? 'Elegí la plantilla, el color y el encabezado: tu tienda real cambia al instante. Nada se publica hasta que guardes.'
              : 'Elegí la plantilla, el color y el encabezado. Nada se publica hasta que guardes.'}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Panel de edición */}
          <aside className="flex max-h-[45%] shrink-0 flex-col border-b lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
            <div role="tablist" aria-label="Qué editar" className="grid shrink-0 grid-cols-2 gap-1 border-b p-2">
              {([['template', 'Plantilla'], ['look', 'Color y encabezado']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tab === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'template' ? (
                <>
                  <BrandColorScope brandColor={look.brandColor} customBrandColor={look.customBrandColor}>
                    <div role="radiogroup" aria-label="Plantillas" className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1">
                      {STOREFRONT_STYLE_OPTIONS.map((option) => {
                        const optionStyle = resolveStorefrontStyle(option.value, businessVertical)
                        const selected = look.storefrontStyle === option.value
                        const label = option.value === 'auto' ? 'Automático' : option.label
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => update({ storefrontStyle: option.value })}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                            )}
                          >
                            <StorefrontTemplateThumbnail style={optionStyle} className="hidden h-16 w-20 shrink-0 rounded-md border lg:flex" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm font-semibold">
                                {label}
                                {selected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                              </span>{' '}
                              <span className="block truncate text-xs text-muted-foreground">
                                {option.value === 'auto'
                                  ? `Hoy: ${STOREFRONT_STYLE_LABELS[optionStyle]}`
                                  : STOREFRONT_TEMPLATES_METADATA[optionStyle].badge}
                              </span>
                              {(option.value === initial.storefrontStyle || option.value === suggestedStyle) && (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {option.value === initial.storefrontStyle && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Actual</span>
                                  )}
                                  {option.value === suggestedStyle && (
                                    <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                      <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
                                      Sugerida
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </BrandColorScope>

                  <div className="hidden border-t p-4 lg:block">
                    <p className="text-sm font-semibold">{meta.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                    <ul className="mt-3 space-y-1.5">
                      {meta.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs">
                          <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ideal para: <span className="text-foreground">{meta.recommendedVerticals.join(', ')}</span>
                    </p>
                  </div>
                </>
              ) : (
                <LookEditor look={look} onChange={update} recommendedColors={meta.recommendedColors} templateName={STOREFRONT_STYLE_LABELS[candidateStyle]} />
              )}
            </div>
          </aside>

          {/* Vista de la tienda */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
            {storePath && (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2 sm:px-4">
                <SegmentedControl<PreviewPage> label="Página" value={page} options={PAGES} onChange={(next) => { setPage(next); setIsLoading(true) }} />
                <div className="flex items-center gap-2">
                  <SegmentedControl<PreviewDevice> label="Dispositivo" value={device} options={DEVICES} onChange={setDevice} iconOnlyOnMobile />
                  <Button type="button" variant="ghost" size="sm" asChild className="hidden gap-1.5 sm:inline-flex">
                    <a href={iframeSrc} target="_blank" rel="noopener noreferrer">
                      Tienda publicada
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
              {storePath ? (
                <>
                  {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                      <span className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" />
                        Cargando tu tienda…
                      </span>
                    </div>
                  )}
                  <div className="flex h-full justify-center">
                    <div
                      className={cn('shrink-0 origin-top overflow-hidden bg-background shadow-sm', device !== 'desktop' && 'border-x')}
                      style={{ width: deviceWidth, height: frameHeight, transform: `scale(${scale})` }}
                    >
                      <iframe ref={iframeRef} key={page} src={iframeSrc} title="Vista previa de tu tienda" className="h-full w-full border-0" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center">
                  <BrandColorScope brandColor={look.brandColor} customBrandColor={look.customBrandColor} className="w-full max-w-md">
                    <StorefrontTemplateThumbnail style={candidateStyle} className="w-full rounded-xl border p-4 shadow-sm" />
                  </BrandColorScope>
                  <div className="max-w-md space-y-1.5">
                    <p className="flex items-center justify-center gap-1.5 text-sm font-semibold">
                      <Globe aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      Tu tienda todavía no está publicada
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Cuando la publiques en «Enlace y visibilidad», acá vas a ver tu tienda real con tus productos mientras la diseñás.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-6">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{templateLabel}</span>
            <span className="hidden sm:inline"> · color {colorLabel} · encabezado {headerLabel.toLowerCase()}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={apply} disabled={!hasChanges}>
              {hasChanges ? 'Aplicar cambios' : 'Sin cambios'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Color, encabezado y barra de contacto, editables sin salir del modal. */
function LookEditor({
  look,
  onChange,
  recommendedColors,
  templateName,
}: {
  look: StorefrontLook
  onChange: (patch: Partial<StorefrontLook>) => void
  recommendedColors: readonly string[]
  templateName: string
}) {
  const headerOption = headerOptionFor(look.headerStyle)
  const customValid = isValidBrandHexColor(look.customBrandColor)

  return (
    <div className="space-y-6 p-4">
      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold">Color de marca</h3>
        <div role="group" aria-label="Color de marca" className="flex flex-wrap gap-2">
          {BRAND_COLORS.map((color) => {
            const selected = look.brandColor === color.key
            const recommended = recommendedColors.includes(color.key)
            return (
              <button
                key={color.key}
                type="button"
                onClick={() => onChange({ brandColor: color.key })}
                aria-label={`Usar color ${color.name}${recommended ? ' (recomendado)' : ''}`}
                aria-pressed={selected}
                title={color.name}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full transition-transform',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  color.swatch,
                  selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110'
                )}
              >
                {selected && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
                {recommended && !selected && <span aria-hidden="true" className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-foreground/60" />}
              </button>
            )
          })}
          {customValid && (
            <button
              type="button"
              onClick={() => onChange({ brandColor: 'custom' })}
              aria-label="Usar mi color personalizado"
              aria-pressed={look.brandColor === 'custom'}
              title="Personalizado"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border transition-transform',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                look.brandColor === 'custom' ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110'
              )}
              style={{ backgroundColor: look.customBrandColor }}
            >
              {look.brandColor === 'custom' && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Los marcados con un punto combinan con {templateName}.</p>
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold">Encabezado</h3>
        <BrandColorScope brandColor={look.brandColor} customBrandColor={look.customBrandColor}>
          <div role="group" aria-label="Estilo del encabezado" className="space-y-2">
            {STOREFRONT_HEADER_OPTIONS.map((option) => {
              const selected = headerOption === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ headerStyle: option.value })}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-8 w-14 shrink-0 items-center justify-between rounded-md border px-1.5',
                      option.value === 'solid' && 'bg-background',
                      option.value === 'accent' && 'bg-primary',
                      option.value === 'dark' && 'bg-slate-950'
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-sm', option.value === 'accent' ? 'bg-white' : 'bg-primary')} />
                    <span className={cn('h-1 w-5 rounded-full', option.value === 'solid' ? 'bg-foreground/30' : 'bg-white/60')} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{option.label}</span>{' '}
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                  {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </BrandColorScope>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <div>
          <Label htmlFor="previewShowTopBar" className="text-sm font-semibold">Barra de contacto</Label>
          <p className="text-xs text-muted-foreground">Teléfono y horario arriba del menú.</p>
        </div>
        <Switch id="previewShowTopBar" checked={look.showTopBar} onCheckedChange={(checked) => onChange({ showTopBar: checked })} />
      </div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  iconOnlyOnMobile = false,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; icon: typeof Home }>
  onChange: (value: T) => void
  iconOnlyOnMobile?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-lg border bg-muted/50 p-0.5">
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          aria-pressed={value === optionValue}
          aria-label={iconOnlyOnMobile ? optionLabel : undefined}
          title={optionLabel}
          onClick={() => onChange(optionValue)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === optionValue ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          <span className={cn(iconOnlyOnMobile && 'hidden md:inline')}>{optionLabel}</span>
        </button>
      ))}
    </div>
  )
}
