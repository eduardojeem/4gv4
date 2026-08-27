'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShieldCheck, CheckCircle2, LucideIcon, Sparkles, ArrowRight } from 'lucide-react'

export interface GuideStep {
  title: string
  description: string
  icon?: LucideIcon
}

/**
 * Caso concreto, para quien aprende mirando un ejemplo antes que leyendo la
 * explicacion. Se muestra en su propia pestaña y solo si la guia trae ejemplos.
 */
export interface GuideExample {
  /** Lo que el usuario quiere lograr, en sus palabras. */
  goal: string
  /** Como se configura, campo por campo. */
  setup: string[]
  /** Que termina viendo el cliente. */
  result: string
  icon?: LucideIcon
}

export interface SectionGuideData {
  title: string
  subtitle?: string
  badgeText?: string
  steps: GuideStep[]
  examples?: GuideExample[]
  tip?: string
  gradient?: string
  icon?: LucideIcon
}

interface SectionGuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guide: SectionGuideData
}

export function SectionGuideModal({
  open,
  onOpenChange,
  guide
}: SectionGuideModalProps) {
  const Icon = guide.icon || Sparkles
  const gradient = guide.gradient || 'from-blue-600 via-indigo-600 to-slate-900'
  const hasExamples = Boolean(guide.examples?.length)

  const stepsBlock = (
    <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
      {guide.steps.map((step, idx) => {
        const StepIcon = step.icon
        return (
          <div
            key={idx}
            className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xs shrink-0">
                {idx + 1}
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                {StepIcon && <StepIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                {step.title}
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
              {step.description}
            </p>
          </div>
        )
      })}

      {guide.tip && (
        <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
            <strong>Consejo clave:</strong> {guide.tip}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Cabecera con degradado */}
        <div className={`bg-gradient-to-br ${gradient} p-6 text-white text-left relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-bold uppercase tracking-wider">
                {guide.badgeText || 'Guía de Sección'}
              </Badge>
              <DialogTitle className="text-xl font-bold text-white tracking-tight mt-0.5">
                {guide.title}
              </DialogTitle>
            </div>
          </div>
          
          {guide.subtitle && (
            <DialogDescription className="text-white/80 text-xs leading-relaxed max-w-lg">
              {guide.subtitle}
            </DialogDescription>
          )}
        </div>

        {hasExamples ? (
          <Tabs defaultValue="steps" className="w-full">
            <div className="px-5 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="steps" className="text-xs font-semibold">Paso a paso</TabsTrigger>
                <TabsTrigger value="examples" className="text-xs font-semibold">
                  Ejemplos ({guide.examples!.length})
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="steps" className="mt-0">{stepsBlock}</TabsContent>
            <TabsContent value="examples" className="mt-0">
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {guide.examples!.map((example, idx) => {
                  const ExampleIcon = example.icon || Sparkles
                  return (
                    <div
                      key={idx}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30"
                    >
                      <div className="flex items-start gap-2 border-b border-slate-200/80 bg-white/60 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                        <ExampleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                        <p className="text-xs font-bold leading-snug text-slate-900 dark:text-slate-100">
                          &laquo;{example.goal}&raquo;
                        </p>
                      </div>
                      <div className="space-y-2 px-3.5 py-3">
                        <ol className="space-y-1.5">
                          {example.setup.map((line, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {i + 1}
                              </span>
                              {line}
                            </li>
                          ))}
                        </ol>
                        <div className="flex items-start gap-1.5 rounded-xl border border-emerald-200/60 bg-emerald-50/70 px-2.5 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-[11px] leading-snug text-emerald-900 dark:text-emerald-200">
                            {example.result}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        ) : stepsBlock}

        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 sm:justify-end">
          <Button
            type="button"
            className="rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            onClick={() => onOpenChange(false)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
