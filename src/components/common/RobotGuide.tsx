'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export type RobotColorVariant =
  | 'black-gold'
  | 'white-cyan'
  | 'emerald-pearl'
  | 'navy-gold'
  | 'violet-neon'
  | 'amber-gunmetal'

export const ROBOT_VARIANTS: Record<
  RobotColorVariant,
  {
    name: string
    role: string
    description: string
    src: string
    badgeColor: string
    glowColor: string
  }
> = {
  'black-gold': {
    name: 'ByteBot Stealth Gold',
    role: 'Asistente Principal & Seguridad',
    description: 'Edición Black & Gold premium para dashboards ejecutivos y control de accesos.',
    src: '/images/robot/robot-black-gold.png',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300',
    glowColor: 'shadow-amber-500/20',
  },
  'white-cyan': {
    name: 'ByteBot Core Cyan',
    role: 'Guía de Tienda & Onboarding',
    description: 'Edición Blanco y Cian brillante para guías públicas, soporte e inducción.',
    src: '/images/robot/robot-white-cyan.png',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300',
    glowColor: 'shadow-cyan-500/20',
  },
  'emerald-pearl': {
    name: 'ByteBot Sales Emerald',
    role: 'Fidelización, Puntos & Sorteos',
    description: 'Edición Perla y Esmeralda para ventas, fidelización y programas de premios.',
    src: '/images/robot/robot-emerald-pearl.png',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300',
    glowColor: 'shadow-emerald-500/20',
  },
  'navy-gold': {
    name: 'ByteBot Superadmin Navy',
    role: 'Auditor Financiero & Suscripciones',
    description: 'Edición Azul Marino y Oro para superadmin, facturación y planes SaaS.',
    src: '/images/robot/robot-navy-gold.png',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300',
    glowColor: 'shadow-blue-500/20',
  },
  'violet-neon': {
    name: 'ByteBot SaaS Violet',
    role: 'Marketing & Tiendas Públicas',
    description: 'Edición Violeta y Neón Magenta para páginas públicas, catálogo y marketing.',
    src: '/images/robot/robot-violet-neon.png',
    badgeColor: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300',
    glowColor: 'shadow-violet-500/20',
  },
  'amber-gunmetal': {
    name: 'ByteBot Guard Gunmetal',
    role: 'Monitoreo & Diagnóstico',
    description: 'Edición Gunmetal y Ámbar para telemetría de base de datos y logs del sistema.',
    src: '/images/robot/robot-amber-gunmetal.png',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300',
    glowColor: 'shadow-orange-500/20',
  },
}

export type RobotGuideProps = {
  variant?: RobotColorVariant
  size?: 'sm' | 'md' | 'lg' | 'xl' | number
  speechText?: string
  speechTitle?: string
  animated?: boolean
  className?: string
}

export function RobotGuide({
  variant = 'black-gold',
  size = 'md',
  speechText,
  speechTitle,
  animated = true,
  className,
}: RobotGuideProps) {
  const robot = ROBOT_VARIANTS[variant] || ROBOT_VARIANTS['black-gold']

  const sizePixelMap = {
    sm: 48,
    md: 80,
    lg: 120,
    xl: 180,
  }

  const dimension = typeof size === 'number' ? size : sizePixelMap[size]

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <div
        className={cn(
          'relative shrink-0 transition-transform duration-300',
          animated && 'hover:scale-105',
          robot.glowColor
        )}
        style={{ width: dimension, height: dimension }}
      >
        <Image
          src={robot.src}
          alt={robot.name}
          width={dimension}
          height={dimension}
          className="h-full w-full object-contain drop-shadow-md select-none"
          priority
        />
      </div>

      {(speechTitle || speechText) && (
        <div className="relative max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 space-y-1">
          {/* Speech bubble pointer */}
          <div className="absolute -left-2 top-4 h-3 w-3 rotate-45 border-b border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />

          {speechTitle && (
            <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
              {speechTitle}
            </p>
          )}
          {speechText && (
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {speechText}
            </p>
          )}
        </div>
      )}
    </div>
  )
}