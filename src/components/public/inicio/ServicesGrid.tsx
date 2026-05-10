'use client'

import { Wrench, CheckCircle, Clock, Tag, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { iconMap, colorMap } from '@/lib/constants/brand-theme'
import type { Service } from '@/types/website-settings'
import Link from 'next/link'

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
            const ctaHref = service.ctaUrl || '/inicio#contacto'

            return (
              <Card key={service.id} className="group flex flex-col transition-all hover:shadow-lg">
                <CardContent className="flex flex-1 flex-col pt-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} ${colors.text} ${colors.hover} group-hover:text-white transition-colors`}>
                    <IconComponent className="h-6 w-6" />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground flex-1">
                    {service.description}
                  </p>

                  {/* Price & Duration badges */}
                  {(service.price || service.duration) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {service.price && (
                        <Badge variant="secondary" className="gap-1 text-xs font-medium">
                          <Tag className="h-3 w-3" />
                          {service.price}
                        </Badge>
                      )}
                      {service.duration && (
                        <Badge variant="outline" className="gap-1 text-xs font-medium">
                          <Clock className="h-3 w-3" />
                          {service.duration}
                        </Badge>
                      )}
                    </div>
                  )}

                  <ul className="mt-4 space-y-2 text-sm">
                    {service.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={ctaHref} className="mt-6 block">
                    <Button variant="outline" size="sm" className="w-full gap-2 group-hover:border-primary group-hover:text-primary">
                      Consultar
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
