'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Zap,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  CheckCircle2,
  Database,
  Terminal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type RobotMood = 'healthy' | 'warning' | 'critical' | 'scanning' | 'idle'

interface MonitoringRobotMascotProps {
  mood?: RobotMood
  statusText?: string
  headline?: string
  metrics?: {
    latency?: number | null
    healthScore?: number
    activeAlerts?: number
    dbSize?: string
    cacheRatio?: number
  }
  onQuickAction?: (action: string) => void
  actionLabel?: string
  compact?: boolean
  className?: string
}

export function MonitoringRobotMascot({
  mood = 'healthy',
  statusText,
  headline,
  metrics,
  onQuickAction,
  actionLabel,
  compact = false,
  className,
}: MonitoringRobotMascotProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)

  const tips = [
    'Latencia de probes monitoreada en tiempo real.',
    'El Cache Hit Ratio > 95% garantiza transacciones ultrarrápidas.',
    'Mantené los logs de auditoría menores a 90 días para optimizar espacio.',
    'Todas las conexiones SQL están aisladas por esquema de organización.',
  ]

  const currentTip = tips[tipIndex % tips.length]

  const moodConfig = {
    healthy: {
      eyeColor: '#10b981',
      visorGlow: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      antennaColor: 'text-emerald-500',
      title: headline || '¡Infraestructura 100% Estable!',
      defaultMsg: statusText || 'Todos los servicios de base de datos y APIs responden de manera óptima.',
      icon: CheckCircle2,
      pulseClass: 'bg-emerald-400',
    },
    warning: {
      eyeColor: '#f59e0b',
      visorGlow: 'from-amber-500/20 via-orange-500/10 to-yellow-500/20',
      badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      antennaColor: 'text-amber-500',
      title: headline || 'Atención en algunos parámetros',
      defaultMsg: statusText || 'Detecté latencias elevadas o alertas pendientes de revisión.',
      icon: AlertTriangle,
      pulseClass: 'bg-amber-400',
    },
    critical: {
      eyeColor: '#ef4444',
      visorGlow: 'from-red-500/20 via-rose-500/10 to-orange-500/20',
      badgeBg: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
      antennaColor: 'text-red-500',
      title: headline || '¡Alerta en la infraestructura!',
      defaultMsg: statusText || 'Uno o más servicios reportan fallas. Se recomienda intervención.',
      icon: XCircle,
      pulseClass: 'bg-red-400',
    },
    scanning: {
      eyeColor: '#06b6d4',
      visorGlow: 'from-cyan-500/20 via-blue-500/10 to-indigo-500/20',
      badgeBg: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
      antennaColor: 'text-cyan-500',
      title: headline || 'Analizando telemetría...',
      defaultMsg: statusText || 'Ejecutando health probes y sincronizando estadísticas de rendimiento.',
      icon: RefreshCw,
      pulseClass: 'bg-cyan-400',
    },
    idle: {
      eyeColor: '#8b5cf6',
      visorGlow: 'from-violet-500/20 via-purple-500/10 to-indigo-500/20',
      badgeBg: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
      antennaColor: 'text-violet-500',
      title: headline || 'Guardián del Sistema Activo',
      defaultMsg: statusText || 'Supervisando salud de base de datos y eventos en vivo.',
      icon: Cpu,
      pulseClass: 'bg-violet-400',
    },
  }[mood]

  const MoodIcon = moodConfig.icon

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900/80', className)}>
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center p-0.5"
        >
          <img
            src={
              mood === 'healthy'
                ? '/images/robot/robot-black-gold.png'
                : mood === 'warning'
                  ? '/images/robot/robot-amber-gunmetal.png'
                  : mood === 'critical'
                    ? '/images/robot/robot-amber-gunmetal.png'
                    : mood === 'scanning'
                      ? '/images/robot/robot-white-cyan.png'
                      : '/images/robot/robot-navy-gold.png'
            }
            alt="ByteBot Icon"
            className="h-full w-full object-contain select-none drop-shadow-md"
          />
          <span className={cn('absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900', moodConfig.pulseClass, 'animate-pulse')} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-wide text-slate-900 dark:text-white">ByteBot Guard</span>
            <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 font-bold', moodConfig.badgeBg)}>
              {mood.toUpperCase()}
            </Badge>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-medium">
            {moodConfig.defaultMsg}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-cyan-50/30 p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:from-slate-900/95 dark:via-slate-900/70 dark:to-slate-950/80 backdrop-blur-xl transition-all duration-300 hover:shadow-md',
        className
      )}
    >
      <div className={cn('absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl opacity-60 pointer-events-none', moodConfig.visorGlow)} />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
        
        {/* 3D Robot Figure */}
        <motion.div
          animate={{
            y: [0, -6, 0],
            rotate: isHovered ? [0, -2, 2, 0] : 0,
          }}
          transition={{
            y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
            rotate: { duration: 0.5 },
          }}
          className="relative flex h-28 w-28 sm:h-32 sm:w-32 shrink-0 items-center justify-center select-none"
        >
          {/* Ambient Glow Halo */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-amber-500/20 via-cyan-500/20 to-violet-500/20 blur-xl opacity-80" />

          {/* High quality Transparent 3D Robot Mascot Render */}
          <img
            src={
              mood === 'healthy'
                ? '/images/robot/robot-black-gold.png'
                : mood === 'warning'
                  ? '/images/robot/robot-amber-gunmetal.png'
                  : mood === 'critical'
                    ? '/images/robot/robot-amber-gunmetal.png'
                    : mood === 'scanning'
                      ? '/images/robot/robot-white-cyan.png'
                      : '/images/robot/robot-navy-gold.png'
            }
            alt="ByteBot Mascot"
            className="relative z-10 h-full w-full object-contain drop-shadow-xl select-none"
          />

          <span className="absolute bottom-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border-2 border-white dark:border-slate-800 shadow-md">
            <span className={cn('h-3 w-3 rounded-full', moodConfig.pulseClass, 'animate-pulse')} />
          </span>
        </motion.div>

        {/* Diagnostic Speech & Insights */}
        <div className="flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              <span>ByteBot</span>
              <span className="text-slate-400 font-medium">· Asistente de Telemetría</span>
            </div>
            <Badge variant="outline" className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full gap-1', moodConfig.badgeBg)}>
              <MoodIcon className="h-3 w-3" />
              {moodConfig.title}
            </Badge>
          </div>

          <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
            {moodConfig.defaultMsg}
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            {metrics?.latency !== undefined && (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Latencia: </span>
                <span className={cn('font-bold', (metrics.latency ?? 0) < 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600')}>
                  {metrics.latency !== null ? `${metrics.latency} ms` : '—'}
                </span>
              </div>
            )}

            {metrics?.healthScore !== undefined && (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Salud: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {metrics.healthScore}%
                </span>
              </div>
            )}

            {metrics?.dbSize && (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300">
                <Database className="h-3.5 w-3.5 text-cyan-500" />
                <span>Tamaño DB: </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {metrics.dbSize}
                </span>
              </div>
            )}

            {metrics?.cacheRatio !== undefined && (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300">
                <Cpu className="h-3.5 w-3.5 text-violet-500" />
                <span>Cache Hit: </span>
                <span className="font-bold text-violet-600 dark:text-violet-400">
                  {metrics.cacheRatio}%
                </span>
              </div>
            )}
          </div>

          {/* Interactive Tip Ticker */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setTipIndex(t => t + 1)}
              className="flex items-center gap-1.5 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left cursor-pointer"
            >
              <Terminal className="h-3 w-3 text-cyan-500 shrink-0" />
              <span className="font-medium">💡 Tip ByteBot: </span>
              <span className="italic">{currentTip}</span>
            </button>

            {onQuickAction && actionLabel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuickAction('robot_action')}
                className="h-7 text-[10px] font-bold rounded-lg border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/30 hover:bg-cyan-100 cursor-pointer"
              >
                {actionLabel}
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
