'use client'

import { createElement, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Headphones,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import type { BrandTheme } from '@/lib/constants/brand-theme'
import type { ProcessFlow, ProcessStep } from '@/types/website-settings'

interface ProcessStepsProps {
  brand: BrandTheme
  flows: ProcessFlow[]
  tenantPrefix?: string
  phoneClean?: string
}

function getFlowIcon(flowId: string) {
  switch (flowId) {
    case 'repairs':
      return Wrench
    case 'purchase':
      return ShoppingBag
    case 'payments':
      return CreditCard
    case 'personalized':
      return Headphones
    default:
      return Sparkles
  }
}

function getStepIcon(step: ProcessStep, index: number) {
  const text = `${step.title} ${step.description}`.toLowerCase()
  if (
    text.includes('diagnóst') ||
    text.includes('revis') ||
    text.includes('elegí') ||
    text.includes('catalogo') ||
    text.includes('catálogo') ||
    text.includes('explor') ||
    text.includes('seleccion')
  ) {
    return Search
  }
  if (
    text.includes('presupuest') ||
    text.includes('confirm') ||
    text.includes('pago') ||
    text.includes('costo') ||
    text.includes('precio') ||
    text.includes('consulta')
  ) {
    return MessageCircle
  }
  if (
    text.includes('repara') ||
    text.includes('prepar') ||
    text.includes('acondicion') ||
    text.includes('operación') ||
    text.includes('trabajo')
  ) {
    return PackageCheck
  }
  if (
    text.includes('entrega') ||
    text.includes('delivery') ||
    text.includes('retiro') ||
    text.includes('comprobante') ||
    text.includes('recibí') ||
    text.includes('envío')
  ) {
    return Truck
  }
  const defaultIcons = [Search, MessageCircle, PackageCheck, Truck]
  return defaultIcons[index % defaultIcons.length]
}

function StepCard({
  step,
  index,
  totalSteps,
  isLast,
  brand: _brand,
}: {
  step: ProcessStep
  index: number
  totalSteps: number
  isLast: boolean
  brand: BrandTheme
}) {
  const Icon = getStepIcon(step, index)

  return (
    <article className="relative flex flex-col h-full group">
      <div
        className={cn(
          'relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl border transition-all duration-300 h-full backdrop-blur-md shadow-2xs',
          isLast
            ? 'border-emerald-500/30 bg-gradient-to-b from-card via-card to-emerald-500/5 hover:border-emerald-500/60 hover:shadow-xl hover:shadow-emerald-950/10 hover:-translate-y-1'
            : 'border-border/80 bg-gradient-to-b from-card via-card to-muted/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1'
        )}
      >
        <div>
          {/* Header de la tarjeta: Icono + Número de Paso */}
          <div className="flex items-center justify-between gap-3">
            <div
              className={cn(
                'relative flex h-13 w-13 items-center justify-center rounded-2xl border transition-all duration-300 shadow-sm group-hover:scale-110',
                isLast
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-600 group-hover:text-white'
                  : 'bg-primary/10 text-primary border-primary/25 group-hover:bg-primary group-hover:text-primary-foreground'
              )}
            >
              {createElement(Icon, { className: 'h-6 w-6 stroke-[2.2]' })}
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider border shadow-2xs',
                  isLast
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-primary/20 bg-primary/10 text-primary'
                )}
                aria-label={`Paso ${index + 1}`}
              >
                Paso 0{index + 1}
              </span>
            </div>
          </div>

          {/* Título del paso */}
          <h3 className="mt-5 text-base sm:text-lg font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
            {step.title}
          </h3>

          {/* Descripción */}
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </div>

        {/* Footer del paso: Etapa + Chevron */}
        <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/80">
            <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', isLast ? 'text-emerald-500' : 'text-primary')} />
            <span>{isLast ? 'Paso final' : `Etapa ${index + 1} de ${totalSteps}`}</span>
          </span>
          {!isLast && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          )}
        </div>
      </div>
    </article>
  )
}

export function ProcessSteps({ brand, flows, tenantPrefix = '', phoneClean }: ProcessStepsProps) {
  const [selectedFlowId, setSelectedFlowId] = useState(flows[0]?.id ?? '')
  if (flows.length === 0) return null

  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? flows[0]
  const steps = selectedFlow.steps

  const whatsappHref = phoneClean && phoneClean.length >= 6
    ? getWhatsAppLink({
        phone: phoneClean,
        message: '¡Hola! 👋 Estuve viendo cómo comprar en la tienda online y quería consultar sobre un producto.',
      })
    : null

  return (
    <section className="py-16 sm:py-24 border-b border-border/80 bg-background relative overflow-hidden" aria-labelledby="public-process-title">
      {/* Fondo sutil con resplandor */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-96 w-[600px] rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado Principal */}
        <div className="mx-auto max-w-3xl text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary shadow-xs">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
            <span>Paso a Paso Transparente</span>
          </div>

          <h2
            id="public-process-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground"
          >
            ¿Cómo comprar en nuestra tienda?
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {flows.length > 1
              ? 'Elegí el tipo de atención para conocer cada etapa de forma transparente.'
              : selectedFlow.description || 'Un recorrido simple, rápido y seguro desde la elección del producto hasta la entrega en tus manos.'}
          </p>
        </div>

        {/* Pestañas de Procesos cuando hay más de uno */}
        {flows.length > 1 && (
          <div
            className="mx-auto mt-8 flex max-w-2xl gap-2 overflow-x-auto p-1.5 rounded-2xl border border-border/80 bg-muted/40 backdrop-blur-md justify-center shadow-inner scrollbar-none"
            role="tablist"
            aria-label="Tipos de proceso"
          >
            {flows.map((flow) => {
              const selected = flow.id === selectedFlow.id
              const FlowIcon = getFlowIcon(flow.id)
              return (
                <button
                  key={flow.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`public-process-panel-${flow.id}`}
                  onClick={() => setSelectedFlowId(flow.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 shrink-0 select-none',
                    selected
                      ? 'bg-background text-foreground shadow-sm border border-border/80 scale-[1.02]'
                      : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                  )}
                >
                  <FlowIcon className={cn('h-3.5 w-3.5', selected ? 'text-primary' : 'text-muted-foreground')} />
                  <span>{flow.title}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Grilla de Pasos */}
        <div
          id={`public-process-panel-${selectedFlow.id}`}
          role="tabpanel"
          className="mt-10 sm:mt-12"
        >
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  totalSteps={steps.length}
                  isLast={index === steps.length - 1}
                  brand={brand}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Banner Inferior de Acción y Ayuda */}
        <div className="mt-12 sm:mt-16 mx-auto max-w-6xl relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-muted/30 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-foreground">
                  ¿Querés hacer un pedido o consultar sobre un producto?
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Estamos online para resolver todas tus consultas y coordinar envíos o retiro inmediato.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto justify-center">
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-border/80 bg-background font-bold text-foreground hover:bg-muted shadow-2xs gap-2"
              >
                <Link href={`${tenantPrefix}/productos`}>
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span>Explorar Catálogo</span>
                </Link>
              </Button>

              {whatsappHref && (
                <Button
                  asChild
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold shadow-md shadow-emerald-700/20 gap-2"
                >
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    <span>Consultar por WhatsApp</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
