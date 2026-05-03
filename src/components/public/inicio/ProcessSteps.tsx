'use client'

import type { BrandTheme } from '@/lib/constants/brand-theme'

interface ProcessStepsProps {
  brand: BrandTheme
}

const steps = [
  { number: 1, title: 'Diagnóstico', description: 'Evaluamos tu dispositivo de forma gratuita' },
  { number: 2, title: 'Presupuesto', description: 'Te damos un precio claro y sin sorpresas' },
  { number: 3, title: 'Reparación', description: 'Nuestros técnicos reparan tu celular' },
  { number: 4, title: 'Entrega', description: 'Recoge tu dispositivo como nuevo' },
]

export function ProcessSteps({ brand }: ProcessStepsProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-4 text-muted-foreground">
            Proceso simple y transparente en 4 pasos
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-4">
          {steps.map((step) => {
            const isLast = step.number === steps.length
            return (
              <div key={step.number} className="text-center">
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
