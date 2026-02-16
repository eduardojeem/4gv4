'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Package, Wrench, Shield, Clock, Star, CheckCircle, Phone, Mail, MapPin, Loader2, MessageCircle, Smartphone, Monitor, Battery, Cpu, Zap, Headset, Laptop, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'

const iconMap = {
  wrench: Wrench,
  package: Package,
  shield: Shield,
  smartphone: Smartphone,
  monitor: Monitor,
  battery: Battery,
  cpu: Cpu,
  zap: Zap,
  headset: Headset,
  laptop: Laptop,
  clock: Clock,
  sparkles: Sparkles
}

const colorMap = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'group-hover:bg-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600', hover: 'group-hover:bg-green-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', hover: 'group-hover:bg-purple-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', hover: 'group-hover:bg-orange-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600', hover: 'group-hover:bg-red-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', hover: 'group-hover:bg-indigo-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', hover: 'group-hover:bg-teal-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', hover: 'group-hover:bg-rose-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', hover: 'group-hover:bg-amber-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'group-hover:bg-emerald-600' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', hover: 'group-hover:bg-cyan-600' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-600', hover: 'group-hover:bg-sky-600' }
}

export default function HomePage() {
  const { settings, isLoading, error } = useWebsiteSettings()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Error al cargar el contenido</p>
        </div>
      </div>
    )
  }

  const { company_info, hero_stats, hero_content, services, testimonials } = settings

  const brandColor = company_info.brandColor || 'blue'
  const brandMap: Record<string, { hero: string; text200: string; text300: string; cta: string }> = {
    blue: { hero: 'from-blue-600 via-blue-700 to-blue-900', text200: 'text-blue-200', text300: 'text-blue-300', cta: 'from-blue-600 to-blue-800' },
    green: { hero: 'from-green-600 via-emerald-600 to-teal-700', text200: 'text-green-200', text300: 'text-green-300', cta: 'from-green-600 to-teal-700' },
    purple: { hero: 'from-purple-600 via-fuchsia-600 to-pink-700', text200: 'text-purple-200', text300: 'text-purple-300', cta: 'from-purple-600 to-pink-700' },
    orange: { hero: 'from-orange-600 via-amber-600 to-red-700', text200: 'text-orange-200', text300: 'text-orange-300', cta: 'from-orange-600 to-red-700' },
    red: { hero: 'from-red-600 via-rose-600 to-red-800', text200: 'text-red-200', text300: 'text-red-300', cta: 'from-red-600 to-rose-700' },
    indigo: { hero: 'from-indigo-600 via-indigo-700 to-blue-800', text200: 'text-indigo-200', text300: 'text-indigo-300', cta: 'from-indigo-600 to-blue-800' },
    teal: { hero: 'from-teal-600 via-emerald-600 to-green-700', text200: 'text-teal-200', text300: 'text-teal-300', cta: 'from-teal-600 to-emerald-700' },
    rose: { hero: 'from-rose-600 via-pink-600 to-rose-700', text200: 'text-rose-200', text300: 'text-rose-300', cta: 'from-rose-600 to-pink-700' },
    amber: { hero: 'from-amber-500 via-orange-500 to-yellow-600', text200: 'text-amber-100', text300: 'text-amber-200', cta: 'from-amber-500 to-orange-700' },
    emerald: { hero: 'from-emerald-600 via-teal-600 to-green-700', text200: 'text-emerald-100', text300: 'text-emerald-200', cta: 'from-emerald-600 to-teal-700' },
    cyan: { hero: 'from-cyan-600 via-sky-600 to-blue-700', text200: 'text-cyan-100', text300: 'text-cyan-200', cta: 'from-cyan-600 to-sky-700' },
    sky: { hero: 'from-sky-500 via-blue-500 to-indigo-600', text200: 'text-sky-100', text300: 'text-sky-200', cta: 'from-sky-500 to-blue-700' }
  }
  const brand = brandMap[brandColor]

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${brand.hero} py-20 text-white md:py-32`}>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="container relative">
          <div className="mx-auto max-w-4xl text-center">
            {company_info.logoUrl && (
              <div className="mb-6 flex justify-center">
                <Image src={company_info.logoUrl} alt={company_info.name || 'Logo'} width={72} height={72} className="rounded-xl shadow-lg" />
              </div>
            )}
            <div className="mb-6 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
              {hero_content.badge}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {hero_content.title}
            </h1>
            <p className={`mt-6 text-lg ${brand.text200} sm:text-xl`}>
              {hero_content.subtitle}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
                <Link href="/mis-reparaciones">
                  Rastrear mi reparación
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <a href={`https://wa.me/${company_info.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Escribinos
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid gap-8 text-center sm:grid-cols-3">
              <div>
                <div className="text-4xl font-bold">{hero_stats.repairs}</div>
                <div className={`mt-1 text-sm ${brand.text200}`}>Reparaciones realizadas</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{hero_stats.satisfaction}</div>
                <div className={`mt-1 text-sm ${brand.text200}`}>Clientes satisfechos</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{hero_stats.avgTime}</div>
                <div className={`mt-1 text-sm ${brand.text200}`}>Tiempo promedio</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios Principales */}
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

      {/* Proceso */}
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
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="mt-4 font-semibold">Diagnóstico</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Evaluamos tu dispositivo de forma gratuita
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                2
              </div>
              <h3 className="mt-4 font-semibold">Presupuesto</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Te damos un precio claro y sin sorpresas
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                3
              </div>
              <h3 className="mt-4 font-semibold">Reparación</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Nuestros técnicos reparan tu celular
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-600">
                4
              </div>
              <h3 className="mt-4 font-semibold">Entrega</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Recoge tu dispositivo como nuevo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="border-t bg-muted/40 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id}>
                <CardContent className="pt-6">
                  <div className="flex gap-1 text-yellow-400">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    "{testimonial.comment}"
                  </p>
                  <p className="mt-4 text-sm font-semibold">{testimonial.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className={`border-t bg-gradient-to-br ${brand.cta} py-16 text-white md:py-24`}>
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Listo para reparar tu celular?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Visítanos o contáctanos para un diagnóstico gratuito
            </p>
            
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
                <Link href="/mis-reparaciones">
                  Rastrear mi reparación
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <a href={`https://wa.me/${company_info.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Escribinos
                </a>
              </Button>
            </div>

            {/* Contact info */}
            <div className="mt-16 grid gap-8 text-left sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <Phone className={`h-5 w-5 ${brand.text300}`} />
                <div>
                  <p className="font-semibold">Teléfono</p>
                  <p className={`mt-1 text-sm ${brand.text200}`}>{company_info.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className={`h-5 w-5 ${brand.text300}`} />
                <div>
                  <p className="font-semibold">Email</p>
                  <p className={`mt-1 text-sm ${brand.text200}`}>{company_info.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className={`h-5 w-5 ${brand.text300}`} />
                <div>
                  <p className="font-semibold">Ubicación</p>
                  <p className={`mt-1 text-sm ${brand.text200}`}>{company_info.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
