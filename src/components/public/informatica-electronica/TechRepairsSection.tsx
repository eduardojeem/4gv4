'use client'

import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { WhatsAppIcon } from '@/components/public/SocialIcons'

/** El módulo habilita seguimiento; no implica garantías, plazos ni especialidades. */
export function TechRepairsSection({ prefix, phone, name, trackingLabel }: { prefix: string; phone: string; name: string; trackingLabel?: string }) {
  return <section aria-labelledby="tech-repairs-title" className="border-b border-border/70 py-8 sm:py-12">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="max-w-xl"><span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-primary"><Wrench className="size-4" />Reparaciones</span><h2 id="tech-repairs-title" className="text-xl font-bold tracking-tight sm:text-2xl">Seguimiento de tu reparación</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Consultá el estado de tu orden en {name}. Para conocer equipos atendidos, presupuesto y condiciones, comunicate con el comercio.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <Link href={`${prefix}/mis-reparaciones`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{trackingLabel?.trim() || 'Consultar mi reparación'}<ArrowRight className="size-4 shrink-0" /></Link>
          {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent('Hola, quisiera consultar por una reparación.')}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"><WhatsAppIcon className="size-4 text-emerald-600" />Consultar por WhatsApp</a>}
        </div>
      </div>
    </div>
  </section>
}
