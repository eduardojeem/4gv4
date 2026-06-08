'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Clock, Star, CheckCircle2, Sparkles } from 'lucide-react'
import { formatWhatsAppPhone, openWhatsApp } from '@/lib/whatsapp'

interface ServiceItem {
  id?: string
  title: string
  description?: string
  price?: string | number | null
  priceNote?: string
  duration?: string
  icon?: string
  active?: boolean
  featured?: boolean
  category?: string
}

interface ServicesPageClientProps {
  services: ServiceItem[]
  companyName: string
  whatsapp: string
}

export function ServicesPageClient({ services, companyName, whatsapp }: ServicesPageClientProps) {
  const activeServices = useMemo(
    () => services.filter(s => s.active !== false),
    [services]
  )

  const categories = useMemo(() => {
    const cats = new Set(activeServices.map(s => s.category || 'General'))
    return Array.from(cats)
  }, [activeServices])

  const handleContactService = (serviceName: string) => {
    const phone = whatsapp.replace(/\D/g, '')
    if (phone.length >= 6) {
      openWhatsApp({
        phone: formatWhatsAppPhone(whatsapp),
        message: `Hola! Me interesa el servicio: ${serviceName}. ¿Me pueden dar más información?`,
      })
    }
  }

  if (activeServices.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-50">Próximamente</h1>
        <p className="mt-2 text-slate-500">Estamos preparando nuestro catálogo de servicios.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <Badge variant="secondary" className="mb-3">Servicios profesionales</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
          Nuestros servicios
        </h1>
        <p className="mt-3 text-lg text-slate-500 dark:text-slate-400">
          {companyName} ofrece servicios de calidad con garantía.
        </p>
      </div>

      {/* Services grid by category */}
      {categories.map(category => {
        const categoryServices = activeServices.filter(s => (s.category || 'General') === category)
        return (
          <div key={category} className="mb-10">
            {categories.length > 1 && (
              <h2 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-200">{category}</h2>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryServices.map((service, idx) => (
                <Card
                  key={service.id || idx}
                  className={`relative overflow-hidden transition-shadow hover:shadow-lg ${
                    service.featured ? 'ring-2 ring-cyan-500/50' : ''
                  }`}
                >
                  {service.featured && (
                    <div className="absolute right-3 top-3">
                      <Badge className="bg-cyan-600 text-white">
                        <Star className="mr-1 h-3 w-3" />
                        Destacado
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-5">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {service.title}
                    </h3>
                    {service.description && (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {service.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {service.price && (
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {typeof service.price === 'number'
                            ? `Gs. ${service.price.toLocaleString('es-PY')}`
                            : service.price}
                        </span>
                      )}
                      {service.priceNote && (
                        <span className="text-xs text-slate-400">{service.priceNote}</span>
                      )}
                    </div>

                    {service.duration && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{service.duration}</span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-[#25D366] hover:bg-[#20BA5A] text-white"
                        onClick={() => handleContactService(service.title)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Consultar
                      </Button>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        Con garantía
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
