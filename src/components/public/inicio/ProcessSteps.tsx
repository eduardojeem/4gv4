'use client'

import type { BrandTheme } from '@/lib/constants/brand-theme'
import type { ProcessStep } from '@/types/website-settings'

interface ProcessStepsProps {
  brand: BrandTheme
  steps: ProcessStep[]
}

export function ProcessSteps({ brand, steps }: ProcessStepsProps) {
  if (steps.length === 0) return null

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-4 text-muted-foreground">
            Proceso simple y transparente en {steps.length} pasos
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-4" style={{ gridTemplateColumns: `repeat(${Math.min(steps.length, 4)}, minmax(0, 1fr))` }}>
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1
            return (
              <div key={step.id} className="text-center">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isLast ? 'bg-green-100 text-green-600' : `${brand.stepBg} ${brand.stepText}`} text-2xl font-bold`}>
                  {step.number}
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
