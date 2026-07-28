'use client'

import { useState } from 'react'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface HelpStep {
  title: string
  description: string
}

export function SectionHowItWorks({
  sectionName,
  steps,
}: {
  sectionName: string
  steps: HelpStep[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 gap-1.5 rounded-md px-2 text-xs text-primary"
        >
          <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
          ¿Cómo funciona?
          <ChevronDown
            aria-hidden="true"
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 border-l-2 border-primary/30 bg-muted/20 px-4 py-3">
          <p className="sr-only">Cómo funciona {sectionName}</p>
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
