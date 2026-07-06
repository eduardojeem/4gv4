'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen } from 'lucide-react'
import { type Guide } from './guides'

interface HelpPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guide: Guide
}

export function HelpPanel({ open, onOpenChange, guide }: HelpPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        {/* Header fijo */}
        <SheetHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-base leading-tight">{guide.title}</SheetTitle>
              <SheetDescription className="mt-0.5 text-xs leading-snug">
                {guide.subtitle}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Contenido scrolleable */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 px-6 py-5">
            {guide.sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {/* Título de sección */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">{section.icon}</span>
                  <h3 className="text-sm font-semibold text-foreground">
                    {section.title}
                  </h3>
                </div>

                {/* Acordeón de preguntas */}
                <Accordion type="single" collapsible className="rounded-xl border bg-card">
                  {section.steps.map((step, stepIndex) => (
                    <AccordionItem
                      key={stepIndex}
                      value={`section-${sectionIndex}-step-${stepIndex}`}
                    >
                      <AccordionTrigger className="px-4 text-sm font-medium hover:no-underline">
                        {step.question}
                      </AccordionTrigger>
                      <AccordionContent className="px-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.answer}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">Tip</Badge>
              <span>Presioná <kbd className="rounded border px-1 font-mono text-[10px]">Ctrl+K</kbd> para buscar cualquier sección del panel.</span>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
