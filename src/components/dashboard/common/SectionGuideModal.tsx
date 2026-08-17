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
import { ShieldCheck, CheckCircle2, LucideIcon, Sparkles } from 'lucide-react'

export interface GuideStep {
  title: string
  description: string
  icon?: LucideIcon
}

export interface SectionGuideData {
  title: string
  subtitle?: string
  badgeText?: string
  steps: GuideStep[]
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

        {/* Pasos */}
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
