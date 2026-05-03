'use client'

import { Wrench, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { iconMap, colorMap } from '@/lib/constants/brand-theme'
import type { Service } from '@/types/website-settings'

interface ServicesGridProps {
  services: Service[]
}

export function ServicesGrid({ services }: ServicesGridProps) {
  if (services.length === 0) return null

  return (
    <section className="border-t bg-muted/40 py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Nuestros servicios
          </h2>
          <p className="mt-4 text-muted-foreground">
            Soluciones completas para tu dispositivo
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const IconComponent = iconMap[service.icon] || Wrench
            const colors = colorMap[service.color] || colorMap.blue

            return (
              <Card key={service.id} className="group transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} ${colors.text} ${colors.hover} group-hover:text-white transition-colors`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {service.description}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {service.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
