'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Eye, Laptop, Smartphone, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StorefrontTemplateSelector } from '@/components/admin/website/StorefrontTemplateSelector'
import { StorefrontTemplatePreviewDialog, type StorefrontLook } from '@/components/admin/website/StorefrontTemplatePreviewDialog'
import { StorefrontPaletteAssistant } from '@/components/admin/website/StorefrontPaletteAssistant'
import { StorefrontAppearancePreview } from '@/components/admin/website/StorefrontAppearancePreview'
import { BrandColorScope } from '@/components/admin/website/StorefrontTemplateThumbnail'
import { ExtraBrandColorSwatches } from '@/components/admin/website/ExtraBrandColorSwatches'
import { BRAND_COLORS, findExtraBrandColor } from '@/lib/website/brand-colors'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import {
  STOREFRONT_HEADER_OPTIONS,
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_TEMPLATES_METADATA,
  headerOptionFor,
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
  suggestStorefrontAppearance,
  type StorefrontStylePreference,
} from '@/lib/website/storefront-style'
import { getPremiumHeroForVertical } from '@/lib/website/premium-hero'
import type { CompanyInfo, PublicCommerceMode } from '@/types/website-settings'
import { cn } from '@/lib/utils'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

function toColorPickerValue(value?: string): string {
  if (!value || !isValidBrandHexColor(value)) return '#2563EB'
  if (value.length === 7) return value
  const [red, green, blue] = value.slice(1).split('')
  return `#${red}${red}${green}${green}${blue}${blue}`
}

interface StorefrontAppearanceEditorProps {
  value: CompanyInfo
  onChange: (patch: Partial<CompanyInfo>) => void
  customColorError?: string
  businessVertical?: string | null
  /** `/slug` de la tienda ya publicada; sin publicar, la vista real no existe. */
  storePath: string | null
  /** Modo de venta resuelto de la tienda (cart | whatsapp | catalog). */
  commerceMode?: PublicCommerceMode
}

export function StorefrontAppearanceEditor({
  value,
  onChange,
  customColorError,
  businessVertical,
  storePath,
  commerceMode,
}: StorefrontAppearanceEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewStyleOverride, setPreviewStyleOverride] = useState<StorefrontStylePreference | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [previewHeroActive, setPreviewHeroActive] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')

  const handleQuickPreview = (style: StorefrontStylePreference) => {
    setPreviewStyleOverride(style)
    setPreviewOpen(true)
  }

  // «Servicios» arma la portada con la agenda: sin el módulo se ofrece el resto.
  const { effectiveModules } = useSubscriptionStatus()
  const servicesAvailable = effectiveModules.includes('services')
  // Un negocio de servicios sin productos no usa plantillas de tienda.
  const catalogAvailable = effectiveModules.includes('inventory')

  const stylePreference = (value.storefrontStyle || 'auto') as StorefrontStylePreference
  const activeStyle = resolveStorefrontStyle(stylePreference, businessVertical, { servicesAvailable, catalogAvailable, commerceMode })
  // La plantilla guardada ya no corresponde (sin agenda, sin productos o de otro rubro): la tienda usa otra.
  const styleFallback = !isStorefrontStyleAvailable(stylePreference, { servicesAvailable, catalogAvailable, businessVertical, commerceMode })
  const brandColor = value.brandColor || 'blue'
  const extraColor = brandColor === 'custom' ? findExtraBrandColor(value.customBrandColor) : null
  const headerOption = headerOptionFor(value.headerStyle)
  const templateMeta = STOREFRONT_TEMPLATES_METADATA[activeStyle]

  const verticalDef = useMemo(() => getPremiumHeroForVertical(businessVertical), [businessVertical])

  const suggestion = useMemo(
    () => suggestStorefrontAppearance({ businessVertical, name: value.name, slogan: value.slogan, description: value.description, servicesAvailable, catalogAvailable, commerceMode }),
    [businessVertical, value.name, value.slogan, value.description, servicesAvailable, catalogAvailable, commerceMode]
  )
  // Si «Automático» ya da la plantilla sugerida, se queda en Automático para seguir al rubro.
  const suggestedPreference: StorefrontStylePreference =
    resolveStorefrontStyle('auto', businessVertical, { servicesAvailable, catalogAvailable, commerceMode }) === suggestion.style ? 'auto' : suggestion.style
  const followsSuggestion =
    activeStyle === suggestion.style && brandColor === suggestion.brandColor && headerOption === suggestion.headerStyle
  const suggestedColorName = BRAND_COLORS.find((color) => color.key === suggestion.brandColor)?.name ?? suggestion.brandColor
  const suggestedHeaderName = STOREFRONT_HEADER_OPTIONS.find((option) => option.value === suggestion.headerStyle)?.label ?? ''

  const applySuggestion = () => {
    onChange({ storefrontStyle: suggestedPreference, brandColor: suggestion.brandColor, headerStyle: suggestion.headerStyle })
    toast.success('Sugerencia aplicada', { description: 'Revisá la vista previa y guardá los cambios para publicarla.' })
  }

  const currentLook: StorefrontLook = {
    storefrontStyle: stylePreference,
    brandColor,
    brandPalette: value.brandPalette,
    customBrandColor: value.customBrandColor,
    headerStyle: value.headerStyle || 'glass',
    showTopBar: value.showTopBar !== false,
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="min-w-0 space-y-6">
        {/* Banner contextual del rubro de la organización */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-gradient-to-r from-primary/10 via-muted/30 to-background p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background border border-border shadow-xs text-xl">
              {verticalDef.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rubro del comercio</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.2 text-[10px] font-bold text-primary">
                  Recomendado
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground">
                {verticalDef.verticalLabel}
              </h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:text-right max-w-xs">
            Plantilla sugerida: <strong className="text-foreground">{STOREFRONT_STYLE_LABELS[suggestion.style]}</strong>.
          </p>
        </div>

        {!followsSuggestion && !suggestionDismissed && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold">Sugerencia para tu rubro ({verticalDef.verticalLabel})</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Plantilla <span className="font-medium text-foreground">{STOREFRONT_STYLE_LABELS[suggestion.style]}</span>, color{' '}
                  <span className="font-medium text-foreground">{suggestedColorName}</span> y encabezado{' '}
                  <span className="font-medium text-foreground">{suggestedHeaderName.toLowerCase()}</span>. {suggestion.reason}
                </p>
              </div>
              <Button type="button" size="sm" onClick={applySuggestion} className="h-8">
                Aplicar sugerencia
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setSuggestionDismissed(true)}
              aria-label="Ocultar sugerencia"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}

        <Step
          number={1}
          id="storefrontStyleLabel"
          title="Plantilla"
          hint="Define cómo se ven el inicio y las fotos de tus productos según tu rubro."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewStyleOverride(null)
                setPreviewOpen(true)
              }}
              className="h-8 gap-1.5"
            >
              <Eye aria-hidden="true" className="h-3.5 w-3.5" />
              Diseñar en mi tienda
            </Button>
          }
        >
          <BrandColorScope brandColor={brandColor} customBrandColor={value.customBrandColor} brandPalette={value.brandPalette}>
            <StorefrontTemplateSelector
              value={stylePreference}
              onChange={(next) => onChange({ storefrontStyle: next })}
              onPreview={handleQuickPreview}
              businessVertical={businessVertical}
              suggestedStyle={followsSuggestion ? undefined : suggestedPreference}
              servicesAvailable={servicesAvailable}
              catalogAvailable={catalogAvailable}
              commerceMode={commerceMode}
            />
            {styleFallback && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                {stylePreference === 'services' && !servicesAvailable
                  ? 'Tenías elegida la plantilla Servicios, pero tu cuenta no tiene la agenda de turnos activa.'
                  : `La plantilla ${STOREFRONT_STYLE_LABELS[stylePreference as keyof typeof STOREFRONT_STYLE_LABELS] ?? ''} no corresponde a tu rubro o a lo que vendés.`}{' '}Tu tienda se muestra con{' '}
                <strong>{STOREFRONT_STYLE_LABELS[activeStyle]}</strong>. Elegí la que prefieras y guardá.
              </p>
            )}
          </BrandColorScope>
        </Step>

        <Step number={2} title="Colores de la tienda" hint="Elegí tu color principal o explorá combinaciones recomendadas.">
          <Tabs defaultValue="single" className="min-w-0">
            <TabsList className="mb-4 grid h-auto w-full grid-cols-2" aria-label="Cómo elegir los colores">
              <TabsTrigger value="single" className="min-h-10">Color único</TabsTrigger>
              <TabsTrigger value="palettes" className="min-h-10">Combinaciones</TabsTrigger>
            </TabsList>
            <TabsContent value="palettes" className="m-0">
              <StorefrontPaletteAssistant value={value} onChange={onChange} businessVertical={businessVertical} />
            </TabsContent>
            <TabsContent value="single" className="m-0 space-y-4">
              <p className="text-xs text-muted-foreground">Al elegir un color único, reemplazás la combinación activa. Abrir esta opción no cambia tus colores.</p>
          <div role="group" aria-label="Color de marca" className="flex flex-wrap gap-2.5">
            {BRAND_COLORS.map((color) => {
              const selected = brandColor === color.key
              const recommended = (templateMeta.recommendedColors as readonly string[]).includes(color.key)
              return (
                <button
                  key={color.key}
                  type="button"
                  onClick={() => onChange({ brandColor: color.key as CompanyInfo['brandColor'] })}
                  aria-label={`Usar color ${color.name}${recommended ? ' (recomendado)' : ''}`}
                  aria-pressed={selected}
                  title={color.name}
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full transition-transform',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    color.swatch,
                    selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110'
                  )}
                >
                  {selected && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
                  {recommended && !selected && (
                    <span aria-hidden="true" className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-foreground/60" />
                  )}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => onChange({ brandColor: 'custom', customBrandColor: value.customBrandColor || '#2563EB' })}
              aria-label="Usar un color personalizado"
              aria-pressed={brandColor === 'custom' && !extraColor}
              title="Personalizado"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full bg-[conic-gradient(at_center,#ef4444,#f59e0b,#22c55e,#06b6d4,#6366f1,#ec4899,#ef4444)] transition-transform',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                brandColor === 'custom' && !extraColor ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110'
              )}
            >
              <span
                aria-hidden="true"
                className="h-5 w-5 rounded-full border-2 border-white"
                style={{ backgroundColor: brandColor === 'custom' ? toColorPickerValue(value.customBrandColor) : 'white' }}
              />
            </button>
          </div>
          <ExtraBrandColorSwatches
            className="mt-4"
            brandColor={brandColor}
            customBrandColor={value.customBrandColor}
            onSelect={(hex) => onChange({ brandColor: 'custom', customBrandColor: hex })}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {brandColor === 'custom'
              ? extraColor?.name ?? 'Color personalizado'
              : BRAND_COLORS.find((color) => color.key === brandColor)?.name ?? 'Azul'}
            <span className="mx-1.5">·</span>
            Los marcados con un punto combinan con {STOREFRONT_STYLE_LABELS[activeStyle]}.
          </p>

          {brandColor === 'custom' && (
            <div className="mt-4 flex flex-wrap items-start gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="customBrandColorPicker" className="text-xs">Elegir</Label>
                <input
                  id="customBrandColorPicker"
                  type="color"
                  value={toColorPickerValue(value.customBrandColor)}
                  onChange={(event) => onChange({ customBrandColor: event.target.value.toUpperCase() })}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                />
              </div>
              <div className="w-36 space-y-1.5">
                <Label htmlFor="customBrandColor" className="text-xs">Código HEX</Label>
                <Input
                  id="customBrandColor"
                  value={value.customBrandColor || ''}
                  onChange={(event) => onChange({ customBrandColor: event.target.value })}
                  onBlur={(event) => onChange({ customBrandColor: event.target.value.trim().toUpperCase() })}
                  placeholder="#2563EB"
                  maxLength={7}
                  spellCheck={false}
                  aria-invalid={!!customColorError}
                  aria-describedby={customColorError ? 'customBrandColorError' : undefined}
                  className="h-10 font-mono uppercase"
                />
              </div>
              {customColorError && (
                <p id="customBrandColorError" role="alert" className="basis-full text-xs text-destructive">
                  {customColorError}
                </p>
              )}
            </div>
          )}
            </TabsContent>
          </Tabs>
        </Step>

        <Step number={3} title="Encabezado" hint="La barra con tu logo y el menú.">
          <BrandColorScope brandColor={brandColor} customBrandColor={value.customBrandColor} brandPalette={value.brandPalette}>
            <div role="group" aria-label="Estilo del encabezado" className="grid gap-3 sm:grid-cols-3">
              {STOREFRONT_HEADER_OPTIONS.map((option) => {
                const selected = headerOption === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ headerStyle: option.value })}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-card text-left transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/25'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex items-center justify-between border-b px-3 py-2.5',
                        option.value === 'solid' && 'bg-background',
                        option.value === 'accent' && 'bg-primary',
                        option.value === 'dark' && 'bg-slate-950'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn('h-3 w-3 rounded', option.value === 'accent' ? 'bg-white' : 'bg-primary')} />
                        <span className={cn('h-1.5 w-10 rounded-full', option.value === 'solid' ? 'bg-foreground/30' : 'bg-white/60')} />
                      </span>
                      <span className={cn('h-3 w-8 rounded', option.value === 'accent' ? 'bg-white' : 'bg-primary')} />
                    </span>
                    <span className="block p-2.5">
                      <span className="flex items-center justify-between text-sm font-semibold">
                        {option.label}
                        {selected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                      </span>{' '}
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </BrandColorScope>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <div>
              <Label htmlFor="showTopBar" className="text-sm font-semibold">Barra de contacto</Label>
              <p className="text-xs text-muted-foreground">Teléfono y horario arriba del menú, en computadoras.</p>
            </div>
            <Switch
              id="showTopBar"
              checked={value.showTopBar !== false}
              onCheckedChange={(checked) => onChange({ showTopBar: checked })}
            />
          </div>
        </Step>
      </div>

      {/* Vista previa fija mientras se edita (adaptada en tiempo real al rubro) */}
      <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
        {/* Barra superior de controles de la vista previa */}
        <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black tracking-tight text-foreground uppercase">
                Vista previa en vivo
              </p>
              <p className="text-[11px] text-muted-foreground">
                {verticalDef.icon} {verticalDef.verticalLabel}
              </p>
            </div>
            {/* Selector de dispositivo */}
            <div className="flex rounded-lg border border-border/80 bg-muted/40 p-0.5" aria-label="Dispositivo de vista previa">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                aria-label="Vista previa en computadora"
                aria-pressed={previewDevice === 'desktop'}
                title="Vista computadora"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer',
                  previewDevice === 'desktop'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Laptop className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                aria-label="Vista previa en celular"
                aria-pressed={previewDevice === 'mobile'}
                title="Vista celular"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer',
                  previewDevice === 'mobile'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">Mostrar portada</span>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="previewHeroToggle" className="cursor-pointer text-[11px]">
                {previewHeroActive ? 'Activa' : 'Oculta'}
              </Label>
              <Switch
                id="previewHeroToggle"
                checked={previewHeroActive}
                onCheckedChange={setPreviewHeroActive}
                className="scale-75"
              />
            </div>
          </div>
        </div>

        {/* Marco de dispositivo */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted/20 p-2 shadow-sm">
          {previewDevice === 'desktop' ? (
            <div className="space-y-1.5">
              {/* Barra de ventana de navegador simulada */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/60 rounded-t-lg border-b border-border/60 text-[10px] text-muted-foreground select-none">
                <span className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="ml-2 font-mono truncate text-[9px] bg-background/80 px-2 py-0.5 rounded border border-border/60">
                  {storePath ? storePath : `/${value.slug || 'inicio'}`}
                </span>
              </div>
              <StorefrontAppearancePreview
                value={value}
                style={activeStyle}
                businessVertical={businessVertical}
                heroEnabled={previewHeroActive}
                device="desktop"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Celular notch simulado */}
              <div className="mx-auto flex h-2.5 w-14 rounded-full bg-foreground/20" />
              <StorefrontAppearancePreview
                value={value}
                style={activeStyle}
                businessVertical={businessVertical}
                heroEnabled={previewHeroActive}
                device="mobile"
              />
            </div>
          )}
        </div>

        {/* Acciones principales */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPreviewStyleOverride(null)
              setPreviewOpen(true)
            }}
            className="w-full gap-1.5 font-bold shadow-xs hover:border-primary/50"
          >
            <Eye aria-hidden="true" className="h-4 w-4 text-primary" />
            {storePath ? 'Ver con mis productos' : 'Comparar plantillas'}
          </Button>

          {storePath && (
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs font-semibold">
              <Link href={storePath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir tienda en nueva pestaña
              </Link>
            </Button>
          )}
        </div>
      </aside>

      {previewOpen && (
        <StorefrontTemplatePreviewDialog
          open={previewOpen}
          onOpenChange={(open) => {
            setPreviewOpen(open)
            if (!open) setPreviewStyleOverride(null)
          }}
          initial={
            previewStyleOverride
              ? { ...currentLook, storefrontStyle: previewStyleOverride }
              : currentLook
          }
          onApply={(changes) => {
            onChange(changes)
            setPreviewStyleOverride(null)
            toast.success('Cambios aplicados', { description: 'Guardá los cambios para publicarlos en tu tienda.' })
          }}
          businessVertical={businessVertical}
          suggestedStyle={followsSuggestion ? undefined : suggestedPreference}
          storePath={storePath}
          servicesAvailable={servicesAvailable}
          catalogAvailable={catalogAvailable}
          commerceMode={commerceMode}
        />
      )}
    </div>
  )
}

function Step({
  number,
  id,
  title,
  hint,
  action,
  children,
}: {
  number: number
  id?: string
  title: string
  hint: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
            {number}
          </span>
          <div>
            <h3 id={id} className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
