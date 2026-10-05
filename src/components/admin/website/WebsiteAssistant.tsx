'use client'

import { useState } from 'react'
import { ArrowRight, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { generateWebsiteSuggestion, type AssistantTone, type WebsiteSuggestion } from '@/lib/website/site-assistant'
import type { WebsiteFocus, WebsiteSectionId } from '@/lib/website/setup-checklist'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { WebsiteSettings } from '@/types/website-settings'

const TONES: Array<{ value: AssistantTone; label: string }> = [
  { value: 'cercano', label: 'Cercano' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'premium', label: 'Premium' },
  { value: 'juvenil', label: 'Juvenil' },
]

const SECTION_LABELS: Record<string, string> = {
  company: 'Empresa y publicación',
  checkout: 'Pagos y entregas',
  hero: 'Portada',
  trust_bar: 'Beneficios',
  brands: 'Marcas',
  carousel: 'Banners',
  offers: 'Ofertas',
  announcement: 'Aviso',
  booking: 'Reservas',
  gallery: 'Galería',
  services: 'Servicios',
  process: 'Cómo atendemos',
}

type Part = 'hero' | 'identity' | 'trustBar'
type Section = Exclude<WebsiteSectionId, 'overview'>

export interface AssistantContext {
  vertical: BusinessVertical
  focus: WebsiteFocus
  /** Pasos pendientes del resumen, en orden. */
  pending: Array<{ section: Section; title: string }>
}

const stampId = (index: number) => `ai-${Date.now().toString(36)}-${index}`

function AssistantBody({
  settings,
  context,
  onNavigate,
  onApplied,
  onClose,
}: {
  settings: WebsiteSettings
  context: AssistantContext
  onNavigate: (section: Section) => void
  onApplied: () => void
  onClose: () => void
}) {
  const { updateSettings } = useAdminWebsiteSettings()
  const [about, setAbout] = useState(settings.company_info.description ?? '')
  const [tone, setTone] = useState<AssistantTone>('cercano')
  const [variant, setVariant] = useState(0)
  const [applying, setApplying] = useState(false)
  const [suggestion, setSuggestion] = useState<WebsiteSuggestion | null>(null)
  const [parts, setParts] = useState<Record<Part, boolean>>({ hero: true, identity: true, trustBar: true })

  const generate = (nextVariant: number) => {
    const result = generateWebsiteSuggestion({
      about,
      tone,
      variant: nextVariant,
      name: settings.company_info.name ?? '',
      vertical: context.vertical,
      focus: context.focus,
      services: (settings.services || []).filter((service) => service.active !== false).map((service) => service.title).filter(Boolean),
      bookingAvailable: Boolean(settings.booking_section?.enabled),
      commerceMode: settings.checkout?.commerceMode ?? 'cart',
      pending: context.pending,
    })
    setVariant(nextVariant)
    setSuggestion(result)
    setParts({ hero: true, identity: true, trustBar: result.trustBar.length > 0 })
  }

  const apply = async () => {
    if (!suggestion) return
    const values: Partial<WebsiteSettings> = {}
    if (parts.hero && settings.hero_content) {
      values.hero_content = { ...settings.hero_content, ...suggestion.hero, enabled: true }
    }
    if (parts.identity) {
      values.company_info = { ...settings.company_info, slogan: suggestion.slogan, description: suggestion.description }
    }
    if (parts.trustBar && suggestion.trustBar.length > 0) {
      values.trust_bar = {
        position: settings.trust_bar?.position ?? 'below_carousel',
        enabled: true,
        items: suggestion.trustBar.map((item, index) => ({ id: stampId(index), ...item, active: true })),
      }
    }
    if (Object.keys(values).length === 0) return
    setApplying(true)
    const result = await updateSettings(values)
    setApplying(false)
    if (result?.success) {
      toast.success('Textos aplicados. Podés ajustarlos en cada sección.')
      onApplied()
      onClose()
    } else {
      toast.error(result?.error ?? 'No se pudieron guardar los textos')
    }
  }

  const togglePart = (part: Part) => (checked: boolean | 'indeterminate') =>
    setParts((current) => ({ ...current, [part]: checked === true }))

  if (!suggestion) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-about">Contanos de tu negocio</Label>
          <Textarea
            id="ai-about"
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            maxLength={800}
            rows={5}
            placeholder="Ej.: Barbería en Luque. Hacemos cortes clásicos y fades, perfilado de barba y color. Atendemos con turno de martes a sábado."
          />
          <p className="text-xs text-muted-foreground">Qué vendés u ofrecés, dónde estás y qué te diferencia (envíos, turnos, garantía…). Usamos solo lo que escribas acá y los datos de tu rubro.</p>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Tono</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tono de los textos">
            {TONES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={tone === option.value}
                onClick={() => setTone(option.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  tone === option.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => generate(variant)} disabled={about.trim().length < 10} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generar sugerencias
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Elegí qué querés aplicar. Después podés editar cada texto en su sección.</p>

      <SuggestionBlock id="ai-part-hero" title="Portada" checked={parts.hero} onCheckedChange={togglePart('hero')}>
        <p className="text-xs uppercase tracking-wide text-primary">{suggestion.hero.badge}</p>
        <p className="text-base font-semibold leading-snug">{suggestion.hero.title}</p>
        <p className="text-sm text-muted-foreground">{suggestion.hero.subtitle}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground">{suggestion.hero.ctaPrimaryText}</span>
          <span className="rounded-md border px-2.5 py-1 text-xs">{suggestion.hero.ctaSecondaryText}</span>
        </div>
      </SuggestionBlock>

      <SuggestionBlock id="ai-part-identity" title="Eslogan y descripción" checked={parts.identity} onCheckedChange={togglePart('identity')}>
        <p className="text-sm font-semibold">{suggestion.slogan}</p>
        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
      </SuggestionBlock>

      {suggestion.trustBar.length > 0 && (
        <SuggestionBlock id="ai-part-trust" title="Beneficios" checked={parts.trustBar} onCheckedChange={togglePart('trustBar')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {suggestion.trustBar.map((item) => (
              <li key={item.title} className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Reemplaza los beneficios actuales.</p>
        </SuggestionBlock>
      )}

      {suggestion.tips.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold">Qué configurar ahora</p>
          <ul className="space-y-2">
            {suggestion.tips.map((tip) => (
              <li key={tip.advice} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                <span className="text-sm text-muted-foreground">{tip.advice}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 gap-1 self-start px-2 text-xs"
                  onClick={() => { onClose(); onNavigate(tip.section) }}
                >
                  {SECTION_LABELS[tip.section] ?? 'Ir'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => setSuggestion(null)}>
          Cambiar descripción
        </Button>
        <Button type="button" variant="outline" onClick={() => generate(variant + 1)} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Otra versión
        </Button>
        <Button
          type="button"
          onClick={apply}
          disabled={applying || !(parts.hero || parts.identity || parts.trustBar)}
          className="gap-2"
        >
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aplicar seleccionados
        </Button>
      </DialogFooter>
    </div>
  )
}

function SuggestionBlock({
  id,
  title,
  checked,
  onCheckedChange,
  children,
}: {
  id: string
  title: string
  checked: boolean
  onCheckedChange: (checked: boolean | 'indeterminate') => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border p-4 transition-colors', checked ? 'border-primary/40 bg-background' : 'bg-muted/20 opacity-70')}>
      <div className="mb-2 flex items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <Label htmlFor={id} className="cursor-pointer text-sm">{title}</Label>
      </div>
      <div className="space-y-1.5 pl-6">{children}</div>
    </div>
  )
}

export function WebsiteAssistantDialog({
  open,
  onOpenChange,
  settings,
  context,
  onNavigate,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: WebsiteSettings | null | undefined
  context: AssistantContext
  onNavigate: (section: Section) => void
  onApplied: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente del sitio
          </DialogTitle>
          <DialogDescription>
            Te proponemos portada, eslogan, descripción y beneficios pensados para tu rubro, y qué conviene configurar ahora. Nada se guarda hasta que lo apliques.
          </DialogDescription>
        </DialogHeader>
        {open && settings && (
          <AssistantBody
            settings={settings}
            context={context}
            onNavigate={onNavigate}
            onApplied={onApplied}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
