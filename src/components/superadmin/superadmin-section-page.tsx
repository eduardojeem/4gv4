import type { ComponentType } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type IconComponent = ComponentType<{ className?: string }>

type StatItem = {
  label: string
  value: string
  helper: string
  icon?: IconComponent
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet'
}

type TableItem = {
  title: string
  description: string
  status: string
  meta: string
  href?: string
}

type ActionItem = {
  title: string
  description: string
  status: string
  href?: string
}

type SuperAdminSectionPageProps = {
  eyebrow?: string
  title: string
  description: string
  primaryActionLabel?: string
  primaryActionHref?: string
  stats: StatItem[]
  actions: ActionItem[]
  tableTitle: string
  tableDescription: string
  tableItems: TableItem[]
}

const toneClasses = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
  violet:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300',
}

function SectionStatCard({ item }: { item: StatItem }) {
  const Icon = item.icon ?? Activity
  const tone = item.tone ?? 'slate'

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-background shadow-sm dark:border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
            <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-50">{item.value}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.helper}</div>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionCard({ action }: { action: ActionItem }) {
  const content = (
    <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-background p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-slate-950 dark:text-slate-50">{action.title}</h3>
          <Badge variant="outline" className="rounded-full text-[11px]">
            {action.status}
          </Badge>
        </div>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{action.description}</p>
      </div>
      <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-300">
        Abrir seccion
        <ArrowRight className="h-4 w-4" />
      </div>
    </div>
  )

  if (!action.href) return content

  return (
    <Link href={action.href} className="block h-full">
      {content}
    </Link>
  )
}

export function SuperAdminSectionPage({
  eyebrow = 'Superadmin',
  title,
  description,
  primaryActionLabel,
  primaryActionHref,
  stats,
  actions,
  tableTitle,
  tableDescription,
  tableItems,
}: SuperAdminSectionPageProps) {
  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Sparkles className="h-4 w-4" />
            {eyebrow}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          {primaryActionHref && primaryActionLabel && (
            <Button asChild className="gap-2">
              <Link href={primaryActionHref}>
                {primaryActionLabel}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <SectionStatCard key={item.label} item={item} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {actions.map((action) => (
          <ActionCard key={action.title} action={action} />
        ))}
      </section>

      <Card className="overflow-hidden rounded-3xl border-slate-200/80 dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">{tableTitle}</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tableDescription}</p>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar en esta vista" className="h-11 rounded-xl pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 dark:border-slate-800">
                  <TableHead className="min-w-[280px]">Elemento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-20 text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableItems.map((item) => (
                  <TableRow key={item.title} className="border-slate-100 dark:border-slate-800">
                    <TableCell className="py-4">
                      <div className="font-semibold text-slate-950 dark:text-slate-50">{item.title}</div>
                      <div className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">{item.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {item.meta}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.href ? (
                        <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                          <Link href={item.href} aria-label={`Abrir ${item.title}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" disabled>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
