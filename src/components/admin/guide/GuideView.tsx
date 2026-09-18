'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Building2, CreditCard, Search, ShieldCheck, Sparkles, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { getNavItemByKey } from '@/config/admin-navigation'
import { GUIDE_SECTIONS } from '@/lib/guide/content'
import { GUIDE_GROUPS, filterGuideSections, searchGuideSections, type GuideSection } from '@/lib/guide/types'
import { FirstStepsPanel } from './FirstStepsPanel'
import { GuideSectionCard } from './GuideSectionCard'

/** Las secciones de conceptos no están en el menú, así que traen su propio ícono. */
const CONCEPT_ICONS: Record<string, LucideIcon> = {
  plataforma: Building2,
  roles: ShieldCheck,
  plan: CreditCard,
}

function iconFor(section: GuideSection): LucideIcon {
  if (section.navKey) {
    const item = getNavItemByKey(section.navKey)
    if (item) return item.icon
  }
  return CONCEPT_ICONS[section.id] ?? Sparkles
}

export function GuideView() {
  const [query, setQuery] = useState('')
  const { hasPermission, isAdmin } = useAuth()
  const { effectiveModules, businessVertical } = useSubscriptionStatus()

  // Sin esto la guía explica funciones que el plan no trae y manda a pantallas
  // que el menú no muestra.
  const available = useMemo(
    () => filterGuideSections(GUIDE_SECTIONS, { hasPermission, isAdmin, modules: effectiveModules }),
    [hasPermission, isAdmin, effectiveModules],
  )

  const results = useMemo(() => searchGuideSections(available, query), [available, query])
  const searching = query.trim().length > 0

  const groups = useMemo(
    () => GUIDE_GROUPS
      .map((group) => ({ ...group, sections: results.filter((section) => section.group === group.id) }))
      .filter((group) => group.sections.length > 0),
    [results],
  )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Guía del sistema</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Qué hace cada sección, con un ejemplo de cada una, y qué te falta para empezar a vender.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar: caja, stock, publicar tienda, permisos..."
            className="pl-9 pr-9"
            aria-label="Buscar en la guía"
          />
          {searching && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => setQuery('')}
              aria-label="Limpiar la búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {!searching && (
          <nav aria-label="Temas de la guía" className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <a
                key={group.id}
                href={`#guia-grupo-${group.id}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {group.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {!searching && <FirstStepsPanel />}

      {searching && (
        <p className="text-sm text-muted-foreground" role="status">
          {results.length === 0
            ? 'No hay nada con esas palabras. Probá con «caja», «stock» o «publicar».'
            : `${results.length} ${results.length === 1 ? 'sección' : 'secciones'} con «${query.trim()}»`}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.id} id={`guia-grupo-${group.id}`} className="space-y-3 scroll-mt-20">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="space-y-3">
            {group.sections.map((section) => (
              <GuideSectionCard
                key={section.id}
                section={section}
                icon={iconFor(section)}
                vertical={businessVertical}
                defaultOpen={searching}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
