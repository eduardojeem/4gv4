'use client'

import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REPAIR_FORM_SECTIONS } from './repair-form-sections'
import type { RepairFormSectionId, RepairFormSectionState } from './types'

interface RepairFormSectionNavProps {
  activeSection: RepairFormSectionId
  sectionState: RepairFormSectionState
  onSelect: (section: RepairFormSectionId) => void
}

export function RepairFormSectionNav({ activeSection, sectionState, onSelect }: RepairFormSectionNavProps) {
  return (
    <nav aria-label="Secciones del formulario" className="sticky top-0 z-20 border-y bg-background/95 px-3 py-2 backdrop-blur max-sm:-mx-3 sm:rounded-lg sm:border">
      <ol className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain sm:grid sm:grid-cols-6">
        {REPAIR_FORM_SECTIONS.map((section, index) => {
          const active = activeSection === section.id
          const errorCount = sectionState[section.id].errorCount
          const errorText = errorCount === 1 ? '1 error' : `${errorCount} errores`
          return (
            <li key={section.id} className="min-w-[6.75rem] snap-start sm:min-w-0">
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                aria-label={`${section.label}${errorCount ? `, ${errorText}` : ''}`}
                onClick={() => onSelect(section.id)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors sm:h-12',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                  active ? 'border-primary-foreground/40' : 'border-border bg-background'
                )}>
                  {errorCount ? <AlertCircle className="h-3.5 w-3.5" /> : index + 1 < 6 ? index + 1 : <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{section.label}</span>
                  <span className={cn('block truncate text-[10px] max-sm:hidden', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {errorCount ? errorText : section.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
