'use client'

import { ArrowUpRight, LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface QuickAccessSection {
  title: string
  description: string
  icon: LucideIcon
  path: string
  color: 'blue' | 'purple' | 'green' | 'orange'
}

interface QuickAccessNavProps {
  sections: QuickAccessSection[]
}

const toneClasses = {
  blue: 'from-blue-500/12 to-cyan-500/8 text-blue-700 ring-blue-200/80 dark:text-blue-200 dark:ring-blue-900/70',
  purple:
    'from-violet-500/12 to-fuchsia-500/8 text-violet-700 ring-violet-200/80 dark:text-violet-200 dark:ring-violet-900/70',
  green:
    'from-emerald-500/12 to-teal-500/8 text-emerald-700 ring-emerald-200/80 dark:text-emerald-200 dark:ring-emerald-900/70',
  orange:
    'from-amber-500/12 to-orange-500/8 text-orange-700 ring-orange-200/80 dark:text-orange-200 dark:ring-orange-900/70',
} as const

export function QuickAccessNav({ sections }: QuickAccessNavProps) {
  const router = useRouter()

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Accesos rapidos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Abre las partes mas usadas sin salir del trabajo del dia.
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
              className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1',
                    toneClasses[section.color]
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{section.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
                </div>
              </div>
              <div className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors group-hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
