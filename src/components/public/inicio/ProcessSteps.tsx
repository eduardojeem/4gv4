'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BrandTheme } from '@/lib/constants/brand-theme'
import type { ProcessFlow, ProcessStep } from '@/types/website-settings'

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
    <article className="relative z-10 w-full max-w-[260px] text-center sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)]">
      <div
        className={cn(
          'mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-background text-lg font-bold shadow-sm',
          isLast
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            : brand.stepBg,
          !isLast && brand.stepText
        )}
        aria-label={`Paso ${index + 1}`}
      >
        {index + 1}
      </div>
      <h3 className="mt-4 break-words text-base font-semibold text-foreground">
        {step.title}
      </h3>
      <p className="mx-auto mt-2 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </article>
  )
}

export function ProcessSteps({ brand, flows }: ProcessStepsProps) {
  const [selectedFlowId, setSelectedFlowId] = useState(flows[0]?.id ?? '')
  if (flows.length === 0) return null

  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? flows[0]
  const steps = selectedFlow.steps
  const showConnector = steps.length > 1 && steps.length <= 4

  return (
    <section className="py-14 md:py-20" aria-labelledby="public-process-title">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="public-process-title"
            className="text-2xl font-bold sm:text-3xl"
          >
            Cómo funciona
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {flows.length > 1
              ? 'Elegí el tipo de atención y conoce cada etapa.'
              : 'Un recorrido claro para que sepas qué esperar.'}
          </p>
        </div>

        {flows.length > 1 && (
          <div
            className="mx-auto mt-7 flex max-w-3xl gap-2 overflow-x-auto pb-1"
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
                    'min-w-fit rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
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
          className="mt-9"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-lg font-semibold">{selectedFlow.title}</h3>
            {selectedFlow.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedFlow.description}
              </p>
            )}
          </div>

          <div className="relative mx-auto mt-9 max-w-5xl">
            {showConnector && (
              <div
                className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-border lg:block"
                aria-hidden="true"
              />
            )}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-10">
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
