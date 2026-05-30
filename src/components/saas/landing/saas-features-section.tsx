'use client'

import { motion } from 'framer-motion'
import { Boxes, ShoppingCart, Store, Wrench } from 'lucide-react'
import { workflowSteps } from './saas-landing-data'
import { cn } from '@/lib/utils'

const highlights = [
  {
    title: 'Vende en mostrador',
    description: 'Sistema POS ultra rápido diseñado para la operación diaria. Cajas, turnos, pagos mixtos y facturación electrónica, todo en una interfaz sin distracciones.',
    icon: ShoppingCart,
    color: 'cyan',
    className: 'lg:col-span-7',
    gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
  },
  {
    title: 'Controla tu stock',
    description: 'Gestión inteligente multi-sucursal. Mueve productos entre tiendas y ajusta precios.',
    icon: Boxes,
    color: 'emerald',
    className: 'lg:col-span-5',
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
  },
  {
    title: 'Gestiona reparaciones',
    description: 'Un módulo técnico dedicado. Ordenes de servicio, estados personalizados, control de repuestos y seguimiento público para tus clientes.',
    icon: Wrench,
    color: 'amber',
    className: 'lg:col-span-5',
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
  },
  {
    title: 'Publica online',
    description: 'Tu propio ecommerce sincronizado en tiempo real con el POS. Si lo vendes en la tienda física, desaparece del sitio web automáticamente.',
    icon: Store,
    color: 'violet',
    className: 'lg:col-span-7',
    gradient: 'from-violet-500/20 via-violet-500/5 to-transparent',
  },
]

const colorMaps = {
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    icon: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-100 dark:border-cyan-900/50',
    glow: 'bg-cyan-500',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    glow: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-900/50',
    glow: 'bg-amber-500',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-100 dark:border-violet-900/50',
    glow: 'bg-violet-500',
  },
}

export function SaaSFeaturesSection() {
  return (
    <section id="caracteristicas" className="relative overflow-hidden py-24 sm:py-32">
      
      {/* Background glow effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-100 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 opacity-80" />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-sm font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400"
          >
            Módulos integrados
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            Todo lo que necesitas, nada que te sobre
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400"
          >
            Empieza con lo esencial y activa nuevos módulos a medida que tu negocio crece. Una sola plataforma conectada en tiempo real.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-12">
          {highlights.map((feature, index) => {
            const Icon = feature.icon
            const theme = colorMaps[feature.color as keyof typeof colorMaps]
            
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.1 * index, duration: 0.5 }}
                className={cn(
                  "group relative overflow-hidden rounded-3xl bg-white/50 backdrop-blur-md ring-1 ring-slate-200 transition-all hover:shadow-xl dark:bg-slate-900/50 dark:ring-slate-800",
                  feature.className
                )}
              >
                {/* Hover gradient glow */}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100", feature.gradient)} />
                
                <div className="relative p-8 sm:p-10">
                  <div className={cn("mb-6 flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm transition-transform duration-300 group-hover:scale-110", theme.bg, theme.border)}>
                    <Icon className={cn("h-6 w-6", theme.icon)} />
                  </div>
                  
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    {feature.title}
                  </h3>
                  <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Workflow Pipeline */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mx-auto mt-24 max-w-4xl rounded-3xl bg-slate-50 p-8 ring-1 ring-slate-200/50 dark:bg-slate-900/30 dark:ring-slate-800 sm:p-12"
        >
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Cómo funciona el onboarding</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Tres simples pasos para tener tu sucursal operando hoy mismo.</p>
          </div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-[2.25rem] top-12 bottom-12 w-0.5 bg-slate-200 dark:bg-slate-800 md:left-1/2 md:-ml-[1px]" aria-hidden="true" />
            
            <div className="space-y-12">
              {workflowSteps.map((step, index) => {
                const isEven = index % 2 === 0
                return (
                  <div key={step.title} className={cn("relative flex items-center md:justify-between", !isEven ? "md:flex-row-reverse" : "")}>
                    
                    {/* Icon Bubble */}
                    <div className="absolute left-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800 md:left-1/2 md:-ml-8 z-10">
                      <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 dark:bg-cyan-400/10 blur-md" />
                      <step.icon className="h-6 w-6 text-cyan-600 dark:text-cyan-400 relative z-10" />
                    </div>

                    {/* Content Box */}
                    <div className={cn(
                      "ml-24 w-full md:ml-0 md:w-[45%]",
                      isEven ? "md:text-right" : "md:text-left"
                    )}>
                      <div className={cn(
                        "flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50 transition-shadow hover:shadow-md dark:bg-slate-900/50 dark:ring-slate-800",
                        isEven ? "md:items-end" : "md:items-start"
                      )}>
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Paso 0{index + 1}
                        </span>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h4>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{step.description}</p>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
