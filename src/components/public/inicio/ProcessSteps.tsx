'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { BrandTheme } from '@/lib/constants/brand-theme'
import type { ProcessStep } from '@/types/website-settings'

interface ProcessStepsProps {
  brand: BrandTheme
  steps: ProcessStep[]
}

function StepCard({ step, index, isLast, brand }: { step: ProcessStep; index: number; isLast: boolean; brand: BrandTheme }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 100}ms` }}
      className={cn('text-center transition-all duration-700', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}
    >
      {/* Number bubble */}
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <div className={cn(
          'h-16 w-16 rounded-full flex items-center justify-center text-xl font-black shadow-lg ring-4 ring-background',
          isLast
            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
            : `bg-gradient-to-br ${brand.hero} text-white`
        )}>
          {step.number}
        </div>
      </div>

      {/* Content */}
      <div className="mt-5">
        <h3 className="text-base font-bold text-foreground">{step.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-[180px] mx-auto">
          {step.description}
        </p>
      </div>
    </div>
  )
}

export function ProcessSteps({ brand, steps }: ProcessStepsProps) {
  if (steps.length === 0) return null

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-3 text-muted-foreground">
            Proceso simple y transparente en {steps.length} pasos
          </p>
        </div>

        {/* Steps with connector lines */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          {/* Horizontal connector line (desktop only) */}
          {steps.length > 1 && (
            <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          )}

          <div
            className="grid gap-8 md:gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(steps.length, 4)}, minmax(0, 1fr))` }}
          >
            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                isLast={i === steps.length - 1}
                brand={brand}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
