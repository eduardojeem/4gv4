'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, Eye, Home, Laptop, Loader2, Lock, ShoppingBag, Smartphone, Sparkles, Tablet, Tag } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BrandColorScope, StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import { StorefrontAppearancePreview } from '@/components/admin/website/StorefrontAppearancePreview'
import { STOREFRONT_TEMPLATES_METADATA, type StorefrontStyle, type StorefrontStylePreference } from '@/lib/website/storefront-style'
import { STOREFRONT_PREVIEW_READY, STOREFRONT_PREVIEW_UPDATE, type StorefrontPreviewDraft } from '@/lib/website/storefront-preview-message'
import type { OrganizationStorefront, StorefrontTemplateItem } from '@/lib/superadmin/organization-storefront'
import type { CompanyInfo } from '@/types/website-settings'
import { cn } from '@/lib/utils'

type PreviewPage = 'inicio' | 'productos' | 'ofertas'
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

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

type Option = StorefrontTemplateItem & { locked: boolean; availableIn?: string | null }

/**
 * Ejemplo de cada plantilla sobre la tienda real de la organización, sin
 * guardar nada: la tienda embebida pinta el borrador que le manda esta ventana
 * (mismo protocolo que el editor de /admin/website). Si la tienda no está
 * publicada, se muestra una maqueta con su color y encabezado.
 */
export function OrganizationTemplatePreviewDialog({
  open,
  onOpenChange,
  storefront,
  initialStyle,
  slug,
  organizationName,
  businessVertical,
  storefrontPublic,
  planName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  storefront: OrganizationStorefront
  /** La plantilla que se muestra al abrir. */
  initialStyle: StorefrontStylePreference
  slug: string
  organizationName: string
  businessVertical?: string | null
  storefrontPublic: boolean
  planName: string
}) {
  const listed: Option[] = [
    ...(storefront.enabled ?? []).flatMap((group) => group.templates.map((template) => ({ ...template, locked: false }))),
    ...(storefront.notIncluded ?? []).map((template) => ({ ...template, locked: true })),
  ]
  // Sin catálogo, al menos la que usa.
  const options: Option[] = listed.length
    ? listed
    : [{ value: storefront.chosen, label: storefront.chosenLabel, current: true, preview: storefront.resolvedStyle, suggested: false, tagline: storefront.resolvedTagline, locked: false }]

  const [selected, setSelected] = useState<StorefrontStylePreference>(initialStyle)
  const [page, setPage] = useState<PreviewPage>('inicio')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [isLoading, setIsLoading] = useState(true)

  const option = options.find((item) => item.value === selected) ?? options[0]
  const style: StorefrontStyle = option.preview
  const meta = STOREFRONT_TEMPLATES_METADATA[style]
  const storePath = storefrontPublic ? `/${slug}` : null

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { brandColor, customBrandColor, headerStyle, showTopBar } = storefront.look

  useEffect(() => {
    if (!open || !storePath) return
    const draft: StorefrontPreviewDraft = { style, brandColor, customBrandColor, headerStyle, showTopBar }
    const send = () => iframeRef.current?.contentWindow?.postMessage({ type: STOREFRONT_PREVIEW_UPDATE, ...draft }, window.location.origin)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if ((event.data as { type?: string } | null)?.type !== STOREFRONT_PREVIEW_READY) return
      send()
      setIsLoading(false)
    }
    window.addEventListener('message', handleMessage)
    // Cambiar de plantilla repinta la tienda ya cargada, sin recargarla.
    send()
    return () => window.removeEventListener('message', handleMessage)
  }, [open, storePath, style, brandColor, customBrandColor, headerStyle, showTopBar])

  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => setIsLoading(false), 8000)
    return () => clearTimeout(timer)
  }, [isLoading])

  // El iframe se dibuja al ancho real del dispositivo y se escala para entrar.
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)
  const stageRef = useCallback((stage: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!stage) return
    const { width, height } = stage.getBoundingClientRect()
    setStageSize({ width, height })
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(stage)
    observerRef.current = observer
  }, [])

  const deviceWidth = DEVICES.find((item) => item.value === device)?.width ?? 1280
  const scale = stageSize.width ? Math.min(1, stageSize.width / deviceWidth) : 1
  const frameHeight = stageSize.height ? stageSize.height / scale : 720
  const iframeSrc = storePath ? `${storePath}/${page}` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[1400px] sm:rounded-2xl">
        <div className="shrink-0 border-b px-4 py-3 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold"><Eye aria-hidden className="size-4 text-primary" />Ejemplo de plantillas · {organizationName}</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            {storePath
              ? 'Su tienda real con la plantilla elegida, su color y su encabezado. Es solo una vista: no cambia nada de la tienda.'
              : 'La tienda no está publicada: se muestra una maqueta con su color y su encabezado. No cambia nada de la tienda.'}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex max-h-[42%] shrink-0 flex-col border-b lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
            <BrandColorScope brandColor={storefront.look.brandColor} customBrandColor={storefront.look.customBrandColor} className="min-h-0 flex-1 overflow-y-auto">
              <div role="radiogroup" aria-label="Plantillas" className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1">
                {options.map((item) => {
                  const isSelected = item.value === option.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => { setSelected(item.value); }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <StorefrontTemplateThumbnail style={item.preview} className={cn('hidden h-14 w-20 shrink-0 rounded-md border lg:flex', item.locked && 'opacity-60')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <span className="truncate">{item.label}</span>
                          {isSelected && <Check aria-hidden className="size-3.5 shrink-0 text-primary" />}
                          {item.locked && <Lock aria-label="No incluida en su plan" className="size-3 shrink-0 text-muted-foreground" />}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {item.current && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">En uso</span>}
                          {item.suggested && <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"><Sparkles aria-hidden className="size-2.5" />Para su rubro</span>}
                          {item.locked && <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.availableIn ? `Desde ${item.availableIn}` : 'Sin plan que la incluya'}</span>}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </BrandColorScope>
            {meta && (
              <div className="hidden shrink-0 border-t p-4 lg:block">
                <p className="text-sm font-semibold">{meta.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">Ideal para: <span className="text-foreground">{meta.recommendedVerticals.join(', ')}</span></p>
              </div>
            )}
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2 sm:px-4">
              {storePath ? <Segmented<PreviewPage> label="Página" value={page} options={PAGES} onChange={(next) => { setPage(next); setIsLoading(true) }} /> : <span className="text-xs text-muted-foreground">Maqueta de la portada</span>}
              <div className="flex items-center gap-2">
                <Segmented<PreviewDevice> label="Dispositivo" value={device} options={DEVICES} onChange={setDevice} iconOnlyOnMobile />
                {storePath && (
                  <Button variant="ghost" size="sm" asChild className="hidden gap-1.5 sm:inline-flex">
                    <a href={iframeSrc} target="_blank" rel="noopener noreferrer">Tienda publicada<ExternalLink aria-hidden className="size-3.5" /></a>
                  </Button>
                )}
              </div>
            </div>

            <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
              {storePath ? (
                <>
                  {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                      <span className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm"><Loader2 aria-hidden className="size-4 animate-spin text-primary" />Cargando la tienda…</span>
                    </div>
                  )}
                  <div className="flex h-full justify-center">
                    <div className={cn('shrink-0 origin-top overflow-hidden bg-background shadow-sm', device !== 'desktop' && 'border-x')} style={{ width: deviceWidth, height: frameHeight, transform: `scale(${scale})` }}>
                      <iframe ref={iframeRef} key={page} src={iframeSrc} title={`Ejemplo de ${option.label} en la tienda de ${organizationName}`} className="h-full w-full border-0" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center overflow-y-auto p-4 sm:p-6">
                  <div className={cn('w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-md', device === 'mobile' && 'max-w-xs', device === 'tablet' && 'max-w-md')}>
                    <StorefrontAppearancePreview
                      value={{ name: organizationName, brandColor: storefront.look.brandColor as CompanyInfo['brandColor'], customBrandColor: storefront.look.customBrandColor, headerStyle: storefront.look.headerStyle, showTopBar: storefront.look.showTopBar }}
                      style={style}
                      businessVertical={businessVertical}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-6">
          <p className="min-w-0 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{option.label}</span>
            {option.locked
              ? <> · no la incluye su plan {planName}{option.availableIn ? ` (está desde ${option.availableIn})` : ''}</>
              : option.current ? ' · la que usa hoy' : ` · habilitada en su plan ${planName}`}
          </p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Segmented<T extends string>({
  label, value, options, onChange, iconOnlyOnMobile = false,
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
            'flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === optionValue ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          <span className={cn(iconOnlyOnMobile && 'hidden md:inline')}>{optionLabel}</span>
        </button>
      ))}
    </div>
  )
}
