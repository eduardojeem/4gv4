'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Bug, Check, CheckCheck, Globe, Inbox, Lightbulb, Mail, RotateCcw, Smartphone, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setFeedbackStatusAction } from '@/app/superadmin/comentarios/actions'
import type { FeedbackEntry, FeedbackFilters, FeedbackKind, FeedbackStatus } from '@/lib/feedback/user-feedback'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

const KIND_META: Record<FeedbackKind, { label: string; icon: typeof Bug; className: string }> = {
  bug: { label: 'Error', icon: Bug, className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  idea: { label: 'Idea', icon: Lightbulb, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  praise: { label: 'Funciona bien', icon: ThumbsUp, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
}

const STATUS_LABELS: Record<FeedbackStatus, string> = { new: 'Nuevo', reviewed: 'Revisado', done: 'Resuelto' }

type Props = {
  filters: FeedbackFilters
  entries: FeedbackEntry[]
  total: number
  pending: { total: number; bug: number; idea: number; praise: number }
}

function hrefFor(filters: FeedbackFilters, next: Partial<FeedbackFilters>) {
  const merged = { ...filters, page: 1, ...next }
  const params = new URLSearchParams()
  if (merged.kind !== 'all') params.set('tipo', merged.kind)
  if (merged.status !== 'new') params.set('estado', merged.status)
  if (merged.page > 1) params.set('pagina', String(merged.page))
  const query = params.toString()
  return `/superadmin/comentarios${query ? `?${query}` : ''}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Bandeja de «Enviar comentarios»: lo nuevo primero, con filtros por tipo y estado. */
export function FeedbackInbox({ filters, entries, total, pending }: Props) {
  const [statusById, setStatusById] = useState<Record<string, FeedbackStatus>>({})
  const [isPending, startTransition] = useTransition()
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function changeStatus(entry: FeedbackEntry, status: FeedbackStatus) {
    const previous = statusById[entry.id] ?? entry.status
    setStatusById((current) => ({ ...current, [entry.id]: status }))
    startTransition(async () => {
      const result = await setFeedbackStatusAction(entry.id, status)
      if (!result.ok) {
        setStatusById((current) => ({ ...current, [entry.id]: previous }))
        toast.error(result.error)
      }
    })
  }

  const kindTabs: Array<{ value: FeedbackFilters['kind']; label: string; count: number }> = [
    { value: 'all', label: 'Todos', count: pending.total },
    { value: 'bug', label: 'Errores', count: pending.bug },
    { value: 'idea', label: 'Ideas', count: pending.idea },
    { value: 'praise', label: 'Funciona bien', count: pending.praise },
  ]
  const statusTabs: Array<{ value: FeedbackFilters['status']; label: string }> = [
    { value: 'new', label: 'Nuevos' },
    { value: 'reviewed', label: 'Revisados' },
    { value: 'done', label: 'Resueltos' },
    { value: 'all', label: 'Todos' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comentarios</h1>
        <p className="text-sm text-muted-foreground">
          Lo que mandan los usuarios desde «Enviar comentarios» en la web y la app.
          {pending.total > 0 ? ` Hay ${pending.total} sin revisar.` : ' Está todo revisado.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kindTabs.map((tab) => (
          <Link
            key={tab.value}
            href={hrefFor(filters, { kind: tab.value })}
            aria-current={filters.kind === tab.value ? 'page' : undefined}
            className={cn(
              'rounded-xl border p-3 transition-colors hover:bg-muted/60',
              filters.kind === tab.value && 'border-primary bg-primary/5',
            )}
          >
            <p className="text-2xl font-bold">{tab.count}</p>
            <p className="text-xs text-muted-foreground">{tab.label} sin revisar</p>
          </Link>
        ))}
      </div>

      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Button key={tab.value} asChild size="sm" variant={filters.status === tab.value ? 'default' : 'outline'}>
            <Link href={hrefFor(filters, { status: tab.value })}>{tab.label}</Link>
          </Button>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">No hay comentarios con estos filtros.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const meta = KIND_META[entry.kind]
            const Icon = meta.icon
            const status = statusById[entry.id] ?? entry.status
            return (
              <li key={entry.id} className={cn('rounded-xl border bg-card p-4', status === 'new' && 'border-l-4 border-l-primary')}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', meta.className)}>
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                  <Badge variant="outline" className="gap-1 font-normal">
                    {entry.source === 'app' ? <Smartphone className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {entry.source === 'app' ? `App${entry.appVersion ? ` v${entry.appVersion}` : ''}` : 'Web'}
                  </Badge>
                  <Badge variant={status === 'new' ? 'default' : 'secondary'} className="font-normal">{STATUS_LABELS[status]}</Badge>
                  <span className="ml-auto text-muted-foreground">{formatDate(entry.createdAt)}</span>
                </div>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm">{entry.message}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{entry.user.name || entry.user.email || 'Usuario eliminado'}</span>
                  {entry.organization.id && (
                    <Link href={`/superadmin/organizations/${entry.organization.id}`} className="underline-offset-2 hover:underline">
                      {entry.organization.name ?? 'Comercio'}
                    </Link>
                  )}
                  {entry.pagePath && <span className="font-mono">{entry.pagePath}</span>}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.user.email && (
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={`mailto:${entry.user.email}?subject=${encodeURIComponent('Sobre tu comentario en Mi TiendaPy')}`}>
                        <Mail className="h-3.5 w-3.5" /> Responder
                      </a>
                    </Button>
                  )}
                  {status === 'new' && (
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={isPending} onClick={() => changeStatus(entry, 'reviewed')}>
                      <Check className="h-3.5 w-3.5" /> Marcar revisado
                    </Button>
                  )}
                  {status !== 'done' && (
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={isPending} onClick={() => changeStatus(entry, 'done')}>
                      <CheckCheck className="h-3.5 w-3.5" /> Resuelto
                    </Button>
                  )}
                  {status !== 'new' && (
                    <Button size="sm" variant="ghost" className="gap-1.5" disabled={isPending} onClick={() => changeStatus(entry, 'new')}>
                      <RotateCcw className="h-3.5 w-3.5" /> Volver a nuevo
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          <Button asChild size="sm" variant="outline" disabled={filters.page <= 1}>
            <Link href={hrefFor(filters, { page: Math.max(1, filters.page - 1) })} aria-disabled={filters.page <= 1}>Anterior</Link>
          </Button>
          <span className="text-muted-foreground">Página {filters.page} de {pages}</span>
          <Button asChild size="sm" variant="outline" disabled={filters.page >= pages}>
            <Link href={hrefFor(filters, { page: Math.min(pages, filters.page + 1) })} aria-disabled={filters.page >= pages}>Siguiente</Link>
          </Button>
        </nav>
      )}
    </div>
  )
}
