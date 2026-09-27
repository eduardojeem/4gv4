'use client'

import { ArrowUpRight, LucideIcon, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export interface QuickAccessSection {
  title: string
  description: string
  icon: LucideIcon
  path: string
  color: 'sky' | 'indigo' | 'teal' | 'amber' | 'emerald' | 'rose' | 'violet'
  badge?: string
}

interface QuickAccessNavProps {
  sections: QuickAccessSection[]
}

const toneClasses = {
  sky: {
    card: 'border-sky-200/80 bg-gradient-to-br from-white to-sky-50/60 hover:border-sky-300 hover:shadow-md dark:border-sky-900/60 dark:from-slate-950 dark:to-sky-950/25 dark:hover:border-sky-700',
    icon: 'bg-sky-500 text-white shadow-sm shadow-sky-500/20',
    arrow: 'border-sky-200 bg-white text-sky-700 group-hover:bg-sky-600 group-hover:text-white dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  indigo: {
    card: 'border-indigo-200/80 bg-gradient-to-br from-white to-indigo-50/60 hover:border-indigo-300 hover:shadow-md dark:border-indigo-900/60 dark:from-slate-950 dark:to-indigo-950/25 dark:hover:border-indigo-700',
    icon: 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20',
    arrow: 'border-indigo-200 bg-white text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white dark:border-indigo-900/70 dark:bg-indigo-950/50 dark:text-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  teal: {
    card: 'border-teal-200/80 bg-gradient-to-br from-white to-teal-50/60 hover:border-teal-300 hover:shadow-md dark:border-teal-900/60 dark:from-slate-950 dark:to-teal-950/25 dark:hover:border-teal-700',
    icon: 'bg-teal-500 text-white shadow-sm shadow-teal-500/20',
    arrow: 'border-teal-200 bg-white text-teal-700 group-hover:bg-teal-600 group-hover:text-white dark:border-teal-900/70 dark:bg-teal-950/50 dark:text-teal-200',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  amber: {
    card: 'border-amber-200/80 bg-gradient-to-br from-white to-amber-50/60 hover:border-amber-300 hover:shadow-md dark:border-amber-900/60 dark:from-slate-950 dark:to-amber-950/25 dark:hover:border-amber-700',
    icon: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20',
    arrow: 'border-amber-200 bg-white text-amber-700 group-hover:bg-amber-600 group-hover:text-white dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  emerald: {
    card: 'border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/60 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/60 dark:from-slate-950 dark:to-emerald-950/25 dark:hover:border-emerald-700',
    icon: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20',
    arrow: 'border-emerald-200 bg-white text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  rose: {
    card: 'border-rose-200/80 bg-gradient-to-br from-white to-rose-50/60 hover:border-rose-300 hover:shadow-md dark:border-rose-900/60 dark:from-slate-950 dark:to-rose-950/25 dark:hover:border-rose-700',
    icon: 'bg-rose-500 text-white shadow-sm shadow-rose-500/20',
    arrow: 'border-rose-200 bg-white text-rose-700 group-hover:bg-rose-600 group-hover:text-white dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-200',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  violet: {
    card: 'border-violet-200/80 bg-gradient-to-br from-white to-violet-50/60 hover:border-violet-300 hover:shadow-md dark:border-violet-900/60 dark:from-slate-950 dark:to-violet-950/25 dark:hover:border-violet-700',
    icon: 'bg-violet-500 text-white shadow-sm shadow-violet-500/20',
    arrow: 'border-violet-200 bg-white text-violet-700 group-hover:bg-violet-600 group-hover:text-white dark:border-violet-900/70 dark:bg-violet-950/50 dark:text-violet-200',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  },
} as const

export function QuickAccessNav({ sections }: QuickAccessNavProps) {
  const router = useRouter()

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-950/70 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Accesos Rápidos del Taller
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Herramientas directas para el flujo de técnicos, inventario, reportes y garantías.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const Icon = section.icon
          const tone = toneClasses[section.color] || toneClasses.sky

          return (
            <button
              key={section.path}
              type="button"
              onClick={() => router.push(section.path)}
              className={cn(
                'group flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                tone.card
              )}
            >
              <div className="flex items-start justify-between gap-2 w-full mb-3">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    tone.icon
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {section.badge && (
                    <Badge variant="outline" className={cn('text-[10px] px-2 py-0 font-bold', tone.badge)}>
                      {section.badge}
                    </Badge>
                  )}
                  <div
                    className={cn(
                      'rounded-full border p-1.5 transition-all group-hover:scale-110',
                      tone.arrow
                    )}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                  {section.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                  {section.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
