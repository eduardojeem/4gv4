'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wrench, ShieldCheck, Clock, ArrowRight, Smartphone, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { getWhatsAppLink } from '@/lib/whatsapp'
import type { CompanyInfo } from '@/types/website-settings'

interface TechRepairsBannerProps {
  phoneClean?: string
  companyInfo?: CompanyInfo
}

const REPAIR_PERKS = [
  { icon: ShieldCheck, title: 'Condiciones del servicio', desc: 'Consultalas con el negocio' },
  { icon: Clock, title: 'Consulta técnica', desc: 'Coordiná la revisión de tu equipo' },
  { icon: Sparkles, title: 'Información de repuestos', desc: 'Consultá las opciones disponibles' },
]

const WORKFLOW_STEPS = [
  { step: '01', label: 'Recepción', desc: 'Ingreso y chequeo inicial' },
  { step: '02', label: 'Diagnóstico', desc: 'Revisión técnica experta' },
  { step: '03', label: 'Reparación', desc: 'Cambio de piezas y test' },
  { step: '04', label: 'Listo', desc: 'Consulta de entrega' },
]

export function TechRepairsBanner({ phoneClean, companyInfo }: TechRepairsBannerProps) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const whatsappHref = phoneClean
    ? getWhatsAppLink({
        phone: phoneClean,
        message: `Hola ${companyInfo?.name || ''}, quisiera consultar por el servicio técnico para mi equipo.`,
      })
    : null

  return (
    <section aria-labelledby="tech-repairs-title" className="py-12 sm:py-16 bg-background border-b border-border/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-white shadow-2xl p-6 sm:p-10 lg:p-12">
          {/* Luces de ambiente sutiles */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Columna Izquierda: Información del Taller */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 shadow-xs mb-4">
                <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                Servicio técnico
              </span>

              <h2
                id="tech-repairs-title"
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight"
              >
                ¿Tu equipo no enciende o necesita reparación?
              </h2>

              <p className="mt-3.5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                Consultá con el negocio los equipos que atiende, las condiciones del servicio y el estado de tu reparación.
              </p>

              {/* Beneficios del Servicio Técnico */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                {REPAIR_PERKS.map((perk, i) => {
                  const Icon = perk.icon
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs"
                    >
                      <Icon className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">{perk.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{perk.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Acciones del banner */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full font-bold px-7 bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/25 transition-all"
                >
                  <Link href={`${tenantPrefix}/mis-reparaciones`}>
                    <Wrench className="h-4 w-4 mr-2" />
                    <span>Rastrear mi reparación</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>

                {whatsappHref && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full font-semibold px-6 border-white/20 text-white hover:bg-white/10 hover:border-white/40 transition-all"
                  >
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                      <WhatsAppIcon className="h-4 w-4 mr-2 text-emerald-400" />
                      <span>Consultar al negocio</span>
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Columna Derecha: Tarjeta de Estado / Proceso */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-md shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Seguimiento de tu orden</h4>
                      <p className="text-[10px] text-slate-400">Desde tu teléfono o PC</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Activo
                  </span>
                </div>

                {/* Pasos visuales del flujo de trabajo */}
                <div className="space-y-2.5">
                  {WORKFLOW_STEPS.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono font-bold text-cyan-400">{s.step}</span>
                        <span className="font-semibold text-slate-200">{s.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{s.desc}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/10">
                  <Link
                    href={`${tenantPrefix}/mis-reparaciones`}
                    className="flex items-center justify-between text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    <span>Ingresar número de orden</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
