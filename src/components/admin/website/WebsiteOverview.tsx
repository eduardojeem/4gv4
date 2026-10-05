'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Circle, ExternalLink, Lock, Minus, PartyPopper, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WebsiteSectionAnchor, WebsiteSectionId, WebsiteSetupChecklist, WebsiteSetupStep } from '@/lib/website/setup-checklist'
import type { SectionAvailability, WebsiteEditableSection } from '@/lib/website/section-availability'

type Navigate = (section: Exclude<WebsiteSectionId, 'overview'>, anchor?: WebsiteSectionAnchor) => void

const FOCUS_TITLES = {
  services: 'Para un negocio que trabaja con turnos',
  repairs: 'Para un servicio técnico',
  retail: 'Para una tienda con catálogo',
} as const

const SECTION_LABELS: Record<WebsiteEditableSection, string> = {
  company: 'Empresa y publicación',
  checkout: 'Pagos y entregas',
  hero: 'Portada',
  trust_bar: 'Beneficios',
  brands: 'Marcas destacadas',
  carousel: 'Banners promocionales',
  offers: 'Ofertas',
  announcement: 'Aviso emergente',
  booking: 'Reservas online',
  gallery: 'Galería de trabajos',
  services: 'Catálogo de servicios',
  process: 'Cómo atendemos',
}

export interface AccountModules {
  planName: string
  hasCatalog: boolean
  hasServices: boolean
  hasRepairs: boolean
}

/** Qué módulos usa la cuenta y qué secciones quedan fuera por eso. */
function AccountSections({ account, availability }: { account: AccountModules; availability: Record<WebsiteEditableSection, SectionAvailability> }) {
  const entries = Object.entries(availability) as Array<[WebsiteEditableSection, SectionAvailability]>
  const available = entries.filter(([, value]) => value.available)
  const locked = entries.filter(([, value]) => !value.available)
  const modules = [
    { label: 'Catálogo de productos', on: account.hasCatalog },
    { label: 'Servicios y agenda', on: account.hasServices },
    { label: 'Reparaciones', on: account.hasRepairs },
  ]

  return (
    <section aria-labelledby="website-account-title" className="rounded-2xl border bg-card p-5 shadow-2xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="website-account-title" className="text-sm font-semibold">Secciones de tu cuenta</h3>
          <p className="text-xs text-muted-foreground">
            Plan {account.planName}. Solo ves las secciones de los módulos que tenés activos; las demás tampoco se publican en tu tienda.
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Módulos de la cuenta">
          {modules.map((module) => (
            <li
              key={module.label}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                module.on ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
              )}
            >
              {module.on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              {module.label}
              <span className="sr-only">{module.on ? 'activo' : 'no activo'}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {available.length} secciones disponibles: {available.map(([id]) => SECTION_LABELS[id]).join(', ')}.
      </p>

      {locked.length > 0 && (
        <div className="mt-3 rounded-xl bg-muted/40 p-3">
          <ul className="space-y-1.5">
            {locked.map(([id, value]) => (
              <li key={id} className="flex items-start gap-2 text-xs">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="text-foreground">{SECTION_LABELS[id]}</span>
                  <span className="text-muted-foreground"> · requiere {value.requires}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/subscriptions" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Ver planes y módulos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  )
}

function StepRow({ step, index, onNavigate }: { step: WebsiteSetupStep; index?: number; onNavigate: Navigate }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {step.done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Listo" />
      ) : index !== undefined ? (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] text-muted-foreground" aria-label="Pendiente">
          {index + 1}
        </span>
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/60" aria-label="Pendiente" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', step.done ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{step.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{step.done ? step.why : step.missing ?? step.why}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={step.done ? 'ghost' : 'outline'}
        className="h-8 shrink-0 text-xs"
        onClick={() => onNavigate(step.section, step.anchor)}
      >
        {step.done ? 'Editar' : step.cta}
      </Button>
    </li>
  )
}

export function WebsiteOverview({
  checklist,
  businessLabel,
  storeHref,
  isPublic,
  onOpenAi,
  onNavigate,
  account,
  availability,
}: {
  checklist: WebsiteSetupChecklist
  businessLabel: string
  storeHref: string | null
  isPublic: boolean
  onOpenAi: () => void
  onNavigate: Navigate
  account: AccountModules
  availability: Record<WebsiteEditableSection, SectionAvailability>
}) {
  const percent = Math.round((checklist.done / Math.max(1, checklist.total)) * 100)
  const next = checklist.next

  return (
    <div className="space-y-5">
      {/* Progreso y siguiente paso */}
      <section aria-labelledby="website-progress-title" className="rounded-2xl border bg-card p-5 shadow-2xs sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-3 md:max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
                  isPublic ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', isPublic ? 'bg-emerald-500' : 'bg-amber-500')} />
                {isPublic ? 'Tienda publicada' : 'Sin publicar'}
              </span>
              <span className="text-xs text-muted-foreground">{businessLabel}</span>
            </div>
            <h2 id="website-progress-title" className="text-lg font-semibold sm:text-xl">
              {next ? 'Armá tu sitio paso a paso' : 'Tu sitio está completo'}
            </h2>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{checklist.done} de {checklist.total} pasos</span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso del sitio">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
            </div>
          </div>

          {next ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 md:w-80 md:shrink-0">
              <p className="text-xs uppercase tracking-wide text-primary">Siguiente paso</p>
              <p className="mt-1 text-sm font-semibold">{next.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{next.why}</p>
              <Button type="button" size="sm" className="mt-3 w-full gap-1.5" onClick={() => onNavigate(next.section, next.anchor)}>
                {next.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 md:w-80">
              <PartyPopper className="h-6 w-6 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <p className="font-semibold">¡Listo para vender!</p>
                {storeHref && (
                  <Link href={storeHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Ver mi tienda <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="website-essentials-title" className="rounded-2xl border bg-card p-5 shadow-2xs">
          <h3 id="website-essentials-title" className="text-sm font-semibold">Lo esencial</h3>
          <p className="text-xs text-muted-foreground">Con estos {checklist.essentials.length} pasos tu tienda ya puede recibir clientes.</p>
          <ol className="mt-1 divide-y">
            {checklist.essentials.map((step, index) => <StepRow key={step.id} step={step} index={index} onNavigate={onNavigate} />)}
          </ol>
        </section>

        <div className="space-y-5">
          <section aria-labelledby="website-recommended-title" className="rounded-2xl border bg-card p-5 shadow-2xs">
            <h3 id="website-recommended-title" className="text-sm font-semibold">Recomendado</h3>
            <p className="text-xs text-muted-foreground">{FOCUS_TITLES[checklist.focus]}. Suman confianza y ventas.</p>
            <ul className="mt-1 divide-y">
              {checklist.recommended.map((step) => <StepRow key={step.id} step={step} onNavigate={onNavigate} />)}
            </ul>
          </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-5 sm:flex-row sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">¿No sabés qué escribir?</h3>
                <p className="text-xs text-muted-foreground">Contale al asistente cómo es tu negocio y te propone portada, eslogan y beneficios para tu rubro, y qué configurar primero.</p>
              </div>
              <Button type="button" onClick={onOpenAi} className="shrink-0 gap-2">
                <Sparkles className="h-4 w-4" />
                Usar asistente
              </Button>
            </section>
        </div>
      </div>

      <AccountSections account={account} availability={availability} />
    </div>
  )
}
