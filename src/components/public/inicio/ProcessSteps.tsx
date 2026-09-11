'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BrandTheme } from '@/lib/constants/brand-theme'
import type { ProcessFlow, ProcessStep } from '@/types/website-settings'
import { CheckCircle2, ShoppingBag, Sparkles } from 'lucide-react'

interface ProcessStepsProps {
  brand: BrandTheme
  flows: ProcessFlow[]
}

function StepCard({
  step,
  index,
  isLast,
  brand,
}: {
  step: ProcessStep
  index: number
  isLast: boolean
  brand: BrandTheme
}) {
  return (
    <article className="relative z-10 w-full sm:w-[calc(50%-1rem)] lg:w-[calc(25%-1rem)] group">
      <div className="flex flex-col items-center text-center p-6 rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-2xs hover:shadow-lg hover:border-primary/40 transition-all duration-300 h-full">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-extrabold tracking-wider shadow-xs transition-transform duration-300 group-hover:scale-110',
            isLast
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-primary/10 text-primary border border-primary/20'
          )}
          aria-label={`Paso ${index + 1}`}
        >
          0{index + 1}
        </div>
        <h3 className="mt-4 text-base font-bold text-foreground">
          {step.title}
        </h3>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-[220px]">
          {step.description}
        </p>
      </div>
    </article>
  )
}

export function ProcessSteps({ brand, flows }: ProcessStepsProps) {
  const [selectedFlowId, setSelectedFlowId] = useState(flows[0]?.id ?? '')
  if (flows.length === 0) return null

  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? flows[0]
  const steps = selectedFlow.steps

  return (
    <section className="py-14 sm:py-20 border-b border-border/80 bg-background" aria-labelledby="public-process-title">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">
            <ShoppingBag className="h-3.5 w-3.5" />
            Compra Fácil y Segura
          </span>
          <h2
            id="public-process-title"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground"
          >
            ¿Cómo comprar en nuestra tienda?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground sm:text-base max-w-md mx-auto">
            {flows.length > 1
              ? 'Elegí el tipo de atención y conocé cada etapa.'
              : 'Un recorrido simple y transparente para que recibas tus prendas sin complicaciones.'}
          </p>
        </div>

        {flows.length > 1 && (
          <div
            className="mx-auto mt-7 flex max-w-3xl gap-2 overflow-x-auto pb-1 justify-center"
            role="tablist"
            aria-label="Tipos de proceso"
          >
            {flows.map((flow) => {
              const selected = flow.id === selectedFlow.id
              return (
                <button
                  key={flow.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`public-process-panel-${flow.id}`}
                  onClick={() => setSelectedFlowId(flow.id)}
                  className={cn(
                    'rounded-full border px-5 py-2 text-xs font-semibold transition-all',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {flow.title}
                </button>
              )
            })}
          </div>
        )}

        <div
          id={`public-process-panel-${selectedFlow.id}`}
          role="tabpanel"
          className="mt-10"
        >
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  isLast={index === steps.length - 1}
                  brand={brand}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
