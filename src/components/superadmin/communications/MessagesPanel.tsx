'use client'

import { useMemo, useState, useTransition } from 'react'
import { Loader2, Mail, MessageCircle, Search, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getMessageContentAction } from '@/app/superadmin/communications/actions'
import type { ChannelStats, MessageDeliveryState, MessageLogEntry } from '@/lib/superadmin/communications'

const CHANNEL_META: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: 'Email', icon: Mail },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  sms: { label: 'SMS', icon: Smartphone },
}

const STATE_META: Record<MessageDeliveryState, { label: string; badge: string }> = {
  sent: { label: 'Enviado', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
  failed: { label: 'Falló', badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300' },
  pending: { label: 'Pendiente', badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
  received: { label: 'Recibido', badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300' },
}

const PAGE_SIZE = 50

function channelMeta(channel: string) {
  return CHANNEL_META[channel] ?? { label: channel, icon: Mail }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'short', timeStyle: 'short' })
}

function contentBlock(text: string) {
  return <p className="whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">{text}</p>
}

export function MessagesPanel({
  messages,
  channelStats,
  messagesTotal,
  logLimit,
}: {
  messages: MessageLogEntry[]
  channelStats: ChannelStats[]
  messagesTotal: number
  logLimit: number
}) {
  const [channel, setChannel] = useState('all')
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [open, setOpen] = useState<MessageLogEntry | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return messages.filter((m) =>
      (channel === 'all' || m.channel === channel) &&
      (!onlyFailed || m.deliveryState === 'failed') &&
      (!q || [m.recipient, m.recipientName, m.subject, m.organizationName, m.content].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [messages, channel, onlyFailed, query])

  // Cada cambio de filtro vuelve a la primera página.
  const changeFilter = (update: () => void) => {
    update()
    setShown(PAGE_SIZE)
  }

  const openMessage = (m: MessageLogEntry) => {
    setOpen(m)
    setHtml(null)
    setContentError(null)
    if (m.channel !== 'email') return
    startLoading(async () => {
      const result = await getMessageContentAction(m.id)
      if ('error' in result) setContentError(result.error)
      else setHtml(result.data.html)
    })
  }

  const truncated = messagesTotal > messages.length

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {channelStats.length === 0 ? (
          <Card className="rounded-xl sm:col-span-3"><CardContent className="p-4 text-sm text-slate-500">Todavía no hay mensajes registrados.</CardContent></Card>
        ) : channelStats.map((s) => {
          const meta = channelMeta(s.channel)
          const total = s.sent + s.failed + s.pending + s.received
          return (
            <Card key={s.channel} className="rounded-xl">
              <CardContent className="p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><meta.icon className="h-4 w-4" /> {meta.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{total}</p>
                <p className="text-xs text-slate-500">
                  {s.sent} enviados · <span className={s.failed ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{s.failed} fallidos</span>
                  {s.pending > 0 && <> · {s.pending} pendientes</>}
                  {s.received > 0 && <> · {s.received} recibidos</>}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {truncated && (
        <p className="text-xs text-slate-500">
          Las tarjetas y la lista usan los últimos {messages.length.toLocaleString('es-PY')} mensajes de {messagesTotal.toLocaleString('es-PY')} registrados en total.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar mensajes">
          {['all', ...channelStats.map((s) => s.channel)].map((value) => (
            <button key={value} type="button" aria-pressed={channel === value} onClick={() => changeFilter(() => setChannel(value))}
              className={cn('rounded-full border px-3 py-1 text-sm', channel === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
              {value === 'all' ? 'Todos los canales' : channelMeta(value).label}
            </button>
          ))}
          <button type="button" aria-pressed={onlyFailed} onClick={() => changeFilter(() => setOnlyFailed((v) => !v))}
            className={cn('rounded-full border px-3 py-1 text-sm', onlyFailed ? 'border-red-500 bg-red-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
            Solo fallidos
          </button>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input value={query} onChange={(e) => changeFilter(() => setQuery(e.target.value))} placeholder="Destinatario, asunto, texto o tienda" className="pl-8" aria-label="Buscar mensaje" />
        </div>
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">No hay mensajes con estos filtros.</p>
          ) : (
            <ul className="divide-y dark:divide-slate-800">
              {visible.slice(0, shown).map((m) => {
                const meta = channelMeta(m.channel)
                const state = STATE_META[m.deliveryState]
                const title = m.subject || (m.channel !== 'email' && m.content ? m.content : m.channel === 'email' ? '(sin asunto)' : meta.label)
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => openMessage(m)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <meta.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label={meta.label} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{title}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {m.direction === 'inbound' ? 'De ' : ''}
                          {m.recipientName && m.recipientName !== m.recipient ? `${m.recipientName} · ` : ''}
                          {m.recipient} · {m.organizationName}
                          {m.isRepairMessage ? ' · Reparación' : ''}
                        </span>
                        {m.error && <span className="block truncate text-xs text-red-600 dark:text-red-400">{m.error}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant="outline" className={cn('rounded-full', state.badge)}>{state.label}</Badge>
                        <span className="font-mono text-[11px] text-slate-500">{formatDate(m.sentAt)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-xs text-slate-500">
          Mostrando {Math.min(shown, visible.length)} de {visible.length} · se cargan los últimos {logLimit} mensajes.
        </p>
        {shown < visible.length && (
          <Button variant="outline" size="sm" onClick={() => setShown((value) => value + PAGE_SIZE)}>Mostrar más</Button>
        )}
      </div>

      <Sheet open={open !== null} onOpenChange={(value) => { if (!value) setOpen(null) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{open.subject || channelMeta(open.channel).label}</SheetTitle>
                <SheetDescription>
                  {channelMeta(open.channel).label} {open.direction === 'inbound' ? 'de' : 'a'}{' '}
                  {open.recipientName && open.recipientName !== open.recipient ? `${open.recipientName} (${open.recipient})` : open.recipient}
                  {' · '}{open.organizationName} · {formatDate(open.sentAt)} · {STATE_META[open.deliveryState].label}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4 pb-6">
                {open.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{open.error}</p>}
                {open.channel !== 'email' ? (
                  open.content
                    ? contentBlock(open.content)
                    : <p className="text-sm text-slate-500">Este mensaje no guardó su texto; solo el resultado del envío.</p>
                ) : loading ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando contenido…</p>
                ) : contentError ? (
                  <p className="text-sm text-red-600">{contentError}</p>
                ) : html ? (
                  // sandbox sin scripts: el HTML viene de la base y se muestra aislado.
                  <iframe title="Contenido del email" sandbox="" srcDoc={html} className="h-[60vh] w-full rounded-lg border bg-white dark:border-slate-800" />
                ) : open.content ? (
                  contentBlock(open.content)
                ) : (
                  <p className="text-sm text-slate-500">Este mensaje no guardó contenido.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
