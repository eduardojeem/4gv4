'use client'

import React from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShieldCheck, CheckCircle2, LucideIcon, Sparkles, ArrowRight, X } from 'lucide-react'

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

  // Los pasos entran en dos columnas cuando hay ancho. Van numerados, asi que
  // el orden de lectura sigue claro y se evita un scroll largo.
  const stepsBlock = (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="grid gap-3 lg:grid-cols-2">
        {guide.steps.map((step, idx) => {
          const StepIcon = step.icon
          return (
            <div
              key={idx}
              className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-xs dark:bg-white dark:text-slate-900">
                  {idx + 1}
                </span>
                <h4 className="flex items-center gap-1.5 text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {StepIcon && <StepIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  {step.title}
                </h4>
              </div>
              <p className="pl-8.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                {step.description}
              </p>
            </div>
          )
        })}
      </div>

      {guide.tip && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-[13px] leading-relaxed text-amber-900 dark:text-amber-200">
            <strong>Consejo clave:</strong> {guide.tip}
          </div>
        </div>
      )}
    </div>
  )

  const examplesBlock = (
    <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-2">
      {(guide.examples ?? []).map((example, idx) => {
        const ExampleIcon = example.icon || Sparkles
        return (
          <div
            key={idx}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30"
          >
            <div className="flex items-start gap-2 border-b border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <ExampleIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <p className="text-[13px] font-bold leading-snug text-slate-900 dark:text-slate-100">
                &laquo;{example.goal}&raquo;
              </p>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-3 px-4 py-3.5">
              <ol className="space-y-2">
                {example.setup.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {i + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-[13px] leading-relaxed text-emerald-900 dark:text-emerald-200">
                  {example.result}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Alto acotado al viewport con la cabecera y el pie fijos: solo scrollea
        el contenido. Antes el cuerpo tenia un max-h-[60vh] suelto, que en
        pantallas bajas desbordaba y en altas desperdiciaba espacio.
        El boton de cerrar del primitivo hereda el color del cuerpo y quedaba
        oscuro sobre el degradado; se usa uno propio en blanco.
      */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 shadow-2xl sm:max-w-[720px] lg:max-w-[880px] dark:border-slate-800"
      >
        {/* Cabecera con degradado */}
        <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br ${gradient} p-5 text-left text-white sm:p-6`}>
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

          <DialogClose asChild>
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>

          <div className="mb-2 flex items-center gap-3 pr-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner backdrop-blur-md">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Badge className="border-0 bg-white/20 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/30">
                {guide.badgeText || 'Guía de Sección'}
              </Badge>
              <DialogTitle className="mt-0.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                {guide.title}
              </DialogTitle>
            </div>
          </div>

          {guide.subtitle && (
            <DialogDescription className="max-w-2xl text-[13px] leading-relaxed text-white/80">
              {guide.subtitle}
            </DialogDescription>
          )}
        </div>

        {hasExamples ? (
          <Tabs defaultValue="steps" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="shrink-0 border-b border-slate-100 px-5 pt-4 pb-3 sm:px-6 dark:border-slate-800">
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="steps" className="text-xs font-semibold">Paso a paso</TabsTrigger>
                <TabsTrigger value="examples" className="text-xs font-semibold">
                  Ejemplos ({guide.examples!.length})
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="steps" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              {stepsBlock}
            </TabsContent>
            <TabsContent value="examples" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              {examplesBlock}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">{stepsBlock}</div>
        )}

        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <Button
            type="button"
            className="rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            onClick={() => onOpenChange(false)}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
