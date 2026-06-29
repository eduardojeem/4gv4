'use client'

import { ArrowUpRight, LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface QuickAccessSection {
  title: string
  description: string
  icon: LucideIcon
  path: string
  color: 'sky' | 'indigo' | 'teal' | 'amber'
}

interface QuickAccessNavProps {
  sections: QuickAccessSection[]
}

const toneClasses = {
  sky: {
    card: 'border-sky-200/80 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/25 dark:hover:border-sky-800',
    icon: 'bg-sky-100 text-sky-700 ring-sky-200/80 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-900/70',
    arrow: 'border-sky-200 bg-white text-sky-700 group-hover:bg-sky-600 group-hover:text-white dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200',
  },
  indigo: {
    card: 'border-indigo-200/80 bg-indigo-50/80 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/25 dark:hover:border-indigo-800',
    icon: 'bg-indigo-100 text-indigo-700 ring-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-200 dark:ring-indigo-900/70',
    arrow: 'border-indigo-200 bg-white text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white dark:border-indigo-900/70 dark:bg-indigo-950/50 dark:text-indigo-200',
  },
  teal: {
    card: 'border-teal-200/80 bg-teal-50/80 hover:border-teal-300 hover:bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/25 dark:hover:border-teal-800',
    icon: 'bg-teal-100 text-teal-700 ring-teal-200/80 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-900/70',
    arrow: 'border-teal-200 bg-white text-teal-700 group-hover:bg-teal-600 group-hover:text-white dark:border-teal-900/70 dark:bg-teal-950/50 dark:text-teal-200',
  },
  amber: {
    card: 'border-amber-200/80 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25 dark:hover:border-amber-800',
    icon: 'bg-amber-100 text-amber-700 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900/70',
    arrow: 'border-amber-200 bg-white text-amber-700 group-hover:bg-amber-600 group-hover:text-white dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200',
  },
} as const

export function QuickAccessNav({ sections }: QuickAccessNavProps) {
  const router = useRouter()

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Accesos rapidos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Entra directo a las herramientas que apoyan el flujo de reparaciones.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.path}
              type="button"
              onClick={() => router.push(section.path)}
              className={cn(
                'group flex min-h-[112px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-600 dark:focus-visible:ring-offset-slate-950',
                toneClasses[section.color].card
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1',
                    toneClasses[section.color].icon
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{section.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{section.description}</p>
                </div>
              </div>
              <div
                className={cn(
                  'rounded-full border p-2 transition-colors',
                  toneClasses[section.color].arrow
                )}
              >
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
