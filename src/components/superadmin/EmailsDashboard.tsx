'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Mail,
  RefreshCw,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  Timer,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type EmailTemplate = {
  id: string
  name: string
  description: string
  category: 'auth' | 'onboarding' | 'security' | 'billing' | 'transactional' | 'marketing'
  source: 'supabase' | 'resend'
  trigger: string
  subject: string
  variables: string[]
  enabled: boolean
  sentFrom: string
}

export type EmailMessage = {
  id: string
  organizationId: string
  organizationName: string
  recipientName: string | null
  recipientEmail: string
  subject: string | null
  htmlBody: string | null
  channel: string
  status: string
  providerId: string | null
  error: string | null
  sentAt: string
}

export type EmailConfigCheck = {
  key: string
  label: string
  configured: boolean
  critical: boolean
  description: string
}

type EmailsData = {
  templates: EmailTemplate[]
  messages: EmailMessage[]
  configChecks: EmailConfigCheck[]
  warnings: string[]
  organizations: { id: string; name: string }[]
  stats: {
    sent24h: number
    failed24h: number
    successRate: number | null
    sent7d: number
    failed7d: number
    successRate7d: number | null
    totalMessages: number
  }
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  sent: { label: 'Enviado', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300' },
  delivered: { label: 'Entregado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' },
  read: { label: 'Leido', className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300' },
  failed: { label: 'Fallido', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' },
}

const DATE_RANGES = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: 'all', label: 'Todo el historial' },
] as const
type DateRange = typeof DATE_RANGES[number]['value']

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function cutoffForRange(range: DateRange): Date | null {
  const now = new Date()
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return null
}

function exportCsv(messages: EmailMessage[]) {
  const headers = ['Fecha', 'Estado', 'Asunto', 'Destinatario', 'Nombre', 'Tenant', 'Provider ID', 'Error']
  const rows = messages.map((m) => [
    formatDate(m.sentAt),
    STATUS_META[m.status]?.label ?? m.status,
    m.subject ?? '',
    m.recipientEmail,
    m.recipientName ?? '',
    m.organizationName,
    m.providerId ?? '',
    m.error ?? '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `emails-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: '' }
  return <Badge variant="outline" className={cn('rounded-full text-[10px]', meta.className)}>{meta.label}</Badge>
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  helper: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'blue' | 'emerald' | 'red' | 'slate'
}) {
  const tones = {
    blue: 'border-blue-200/70 bg-blue-50/60 text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-400',
    emerald: 'border-emerald-200/70 bg-emerald-50/60 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-400',
    red: 'border-red-200/70 bg-red-50/60 text-red-600 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400',
    slate: 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
  }

  return (
    <div className={cn('rounded-xl border p-4', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
        </div>
        <div className="rounded-lg border bg-background/80 p-2"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  )
}

function TemplateSheet({
  template,
  onOpenChange,
}: {
  template: EmailTemplate | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(template)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {template && (
          <>
            <SheetHeader className="border-b p-5 pr-12">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{template.source === 'resend' ? 'Resend' : 'Supabase Auth'}</Badge>
                <Badge variant="secondary">{template.category}</Badge>
              </div>
              <SheetTitle className="text-xl">{template.name}</SheetTitle>
              <SheetDescription>{template.description}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-5">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asunto</p>
                <p className="mt-2 text-sm font-semibold">{template.subject}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trigger</p>
                <code className="mt-2 block overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-emerald-200">{template.trigger}</code>
                {!template.sentFrom.startsWith('/api/') && (
                  <Button asChild variant="link" className="mt-1 h-auto px-0 text-xs">
                    <Link href={template.sentFrom}>Abrir origen en la aplicacion</Link>
                  </Button>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variables</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <code key={variable} className="rounded border bg-muted px-2 py-1 text-xs">{variable}</code>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disponibilidad</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {template.enabled
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <XCircle className="h-4 w-4 text-red-500" />}
                  {template.enabled ? 'Configuracion base disponible' : 'Proveedor o credenciales faltantes'}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function TestEmailCard({ defaultEmail, configured }: { defaultEmail: string; configured: boolean }) {
  const [to, setTo] = useState(defaultEmail)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const isValidEmail = EMAIL_RE.test(to.trim())

  async function sendTestEmail() {
    if (!isValidEmail) return
    setSending(true)
    setResult(null)
    try {
      const response = await fetch('/api/superadmin/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim() }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      setResult({
        success: response.ok,
        message: response.ok ? 'Email de prueba enviado correctamente.' : payload.error ?? 'No se pudo enviar.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Probar canal Resend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input type="email" value={to} onChange={(event) => setTo(event.target.value)} placeholder="correo@ejemplo.com" aria-label="Destinatario de prueba" />
        <Button className="w-full gap-2" onClick={sendTestEmail} disabled={!configured || !isValidEmail || sending}>
          <Send className={cn('h-4 w-4', sending && 'animate-pulse')} />
          {sending ? 'Enviando...' : 'Enviar email de prueba'}
        </Button>
        {!configured && <p className="text-xs text-amber-600">Configura RESEND_API_KEY para habilitar esta accion.</p>}
        {result && (
          <p role="status" className={cn('text-xs font-medium', result.success ? 'text-emerald-600' : 'text-red-600')}>
            {result.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const AUTO_REFRESH_INTERVAL = 30

export function EmailsDashboard({ data, supabaseProjectRef }: { data: EmailsData; supabaseProjectRef?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null)
  const [messageCopied, setMessageCopied] = useState(false)
  const [templateSource, setTemplateSource] = useState<'all' | EmailTemplate['source']>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!autoRefresh) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      setCountdown(AUTO_REFRESH_INTERVAL)
      return
    }
    setCountdown(AUTO_REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          startTransition(() => router.refresh())
          return AUTO_REFRESH_INTERVAL
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [autoRefresh, router])

  const filteredTemplates = useMemo(
    () => data.templates.filter((template) => templateSource === 'all' || template.source === templateSource),
    [data.templates, templateSource]
  )

  const filteredMessages = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const cutoff = cutoffForRange(dateRange)
    return data.messages.filter((message) => {
      const matchesStatus = statusFilter === 'all' || message.status === statusFilter
      const matchesOrg = orgFilter === 'all' || message.organizationId === orgFilter
      const matchesDate = !cutoff || new Date(message.sentAt) >= cutoff
      const matchesSearch = !normalized || [
        message.organizationName,
        message.recipientName,
        message.recipientEmail,
        message.subject,
      ].some((value) => value?.toLowerCase().includes(normalized))
      return matchesStatus && matchesOrg && matchesDate && matchesSearch
    })
  }, [data.messages, search, statusFilter, orgFilter, dateRange])

  const resendConfigured = data.configChecks.find((check) => check.key === 'RESEND_API_KEY')?.configured ?? false
  const configuredCount = data.configChecks.filter((check) => check.configured).length
  const criticalMissing = data.configChecks.filter((check) => check.critical && !check.configured)

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Mail className="h-3.5 w-3.5" />
            Operaciones de email
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Centro de emails</h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Salud del proveedor, plantillas transaccionales e historial real de envios de todos los tenants.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setAutoRefresh((v) => !v)}
            title="Actualizar automaticamente cada 30 segundos"
          >
            <Timer className="h-4 w-4" />
            {autoRefresh ? `Auto (${countdown}s)` : 'Auto-refresh'}
          </Button>
          <Button variant="outline" className="gap-2" disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
            <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <Button asChild className="gap-2">
            <a
              href={`https://supabase.com/dashboard/project/${supabaseProjectRef ?? '_'}/auth/templates`}
              target="_blank"
              rel="noreferrer"
            >
              Supabase Auth
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      {data.warnings.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">No se pudieron leer todos los datos de email</p>
              <ul className="mt-1 space-y-1 text-xs text-red-700 dark:text-red-400">
                {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {criticalMissing.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Configuracion critica incompleta</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {criticalMissing.map((check) => check.key).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Stats 24h */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Ultimas 24 horas</p>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Enviados" value={data.stats.sent24h} helper="Aceptados por el proveedor" icon={Send} tone="blue" />
          <MetricCard label="Fallidos" value={data.stats.failed24h} helper="Requieren revision" icon={XCircle} tone={data.stats.failed24h ? 'red' : 'slate'} />
          <MetricCard label="Tasa de exito" value={data.stats.successRate === null ? '—' : `${data.stats.successRate}%`} helper="24h" icon={ShieldCheck} tone="emerald" />
          <MetricCard label="Configuracion" value={`${configuredCount}/${data.configChecks.length}`} helper="Variables y proveedor" icon={ServerCog} tone={criticalMissing.length ? 'red' : 'emerald'} />
        </section>
      </div>

      {/* Stats 7d */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Ultimos 7 dias</p>
        <section className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Enviados 7d" value={data.stats.sent7d} helper="Aceptados por el proveedor" icon={Send} tone="blue" />
          <MetricCard label="Fallidos 7d" value={data.stats.failed7d} helper="Requieren revision" icon={XCircle} tone={data.stats.failed7d ? 'red' : 'slate'} />
          <MetricCard label="Tasa de exito 7d" value={data.stats.successRate7d === null ? '—' : `${data.stats.successRate7d}%`} helper="Sobre registros de 7 dias" icon={ShieldCheck} tone="emerald" />
        </section>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border bg-background p-1">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="history">
            Historial <Badge variant="secondary" className="ml-1">{data.messages.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="configuration">Configuracion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Ultimos envios registrados</CardTitle>
              {data.messages.length > 8 && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setActiveTab('history')}>
                  Ver todos ({data.messages.length})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <MessageList messages={data.messages.slice(0, 8)} onView={(msg) => { setSelectedMessage(msg); setMessageCopied(false) }} />
            </CardContent>
          </Card>
          <div className="space-y-5">
            <TestEmailCard defaultEmail="" configured={resendConfigured} />
            <ConfigurationSummary checks={data.configChecks} />
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'resend', 'supabase'] as const).map((source) => (
              <Button key={source} variant={templateSource === source ? 'default' : 'outline'} size="sm" onClick={() => setTemplateSource(source)}>
                {source === 'all' ? 'Todas' : source === 'resend' ? 'Resend' : 'Supabase Auth'}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <button key={template.id} type="button" onClick={() => setSelectedTemplate(template)} className="rounded-xl border bg-card p-5 text-left transition-colors hover:border-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg border bg-muted/40 p-2"><FileCode2 className="h-4 w-4" /></div>
                  <Badge variant={template.enabled ? 'secondary' : 'destructive'}>{template.enabled ? 'Disponible' : 'No configurada'}</Badge>
                </div>
                <p className="mt-4 font-semibold">{template.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{template.source === 'resend' ? 'Resend' : 'Supabase Auth'}</span>
                  <span>{template.category}</span>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tenant, destinatario o asunto" className="pl-9" />
            </div>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.organizations.length > 0 && (
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Todos los tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tenants</SelectItem>
                  {data.organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'sent', 'delivered', 'read', 'failed'].map((status) => (
              <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'Todos' : STATUS_META[status]?.label ?? status}
              </Button>
            ))}
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(filteredMessages)} disabled={filteredMessages.length === 0}>
                <Download className="h-3.5 w-3.5" />
                Exportar CSV ({filteredMessages.length})
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <MessageList messages={filteredMessages} onView={(msg) => { setSelectedMessage(msg); setMessageCopied(false) }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <ConfigurationSummary checks={data.configChecks} detailed />
          <TestEmailCard defaultEmail="" configured={resendConfigured} />
        </TabsContent>
      </Tabs>

      <TemplateSheet template={selectedTemplate} onOpenChange={(open) => { if (!open) setSelectedTemplate(null) }} />

      {/* Message content viewer */}
      <Dialog open={!!selectedMessage} onOpenChange={(open) => { if (!open) { setSelectedMessage(null); setMessageCopied(false) } }}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="p-5 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Contenido del mensaje
            </DialogTitle>
            {selectedMessage && (
              <DialogDescription className="mt-1 space-y-0.5 text-left text-xs">
                <span className="block"><span className="font-semibold text-foreground">Para:</span> {selectedMessage.recipientEmail}{selectedMessage.recipientName ? ` (${selectedMessage.recipientName})` : ''}</span>
                <span className="block"><span className="font-semibold text-foreground">Asunto:</span> {selectedMessage.subject || 'Sin asunto'}</span>
                <span className="block"><span className="font-semibold text-foreground">Tenant:</span> {selectedMessage.organizationName}</span>
                <span className="block"><span className="font-semibold text-foreground">Fecha:</span> {formatDate(selectedMessage.sentAt)}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto border-y bg-slate-50 p-3 dark:bg-slate-900">
            <iframe
              srcDoc={selectedMessage?.htmlBody ?? ''}
              className="h-[460px] w-full rounded-md border bg-white"
              sandbox=""
              title="Contenido del email"
            />
          </div>
          <DialogFooter className="p-4">
            <div className="flex w-full items-center justify-between gap-2">
              <StatusBadge status={selectedMessage?.status ?? 'sent'} />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (!selectedMessage?.htmlBody) return
                  navigator.clipboard.writeText(selectedMessage.htmlBody)
                  setMessageCopied(true)
                  setTimeout(() => setMessageCopied(false), 1500)
                }}
              >
                {messageCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {messageCopied ? 'Copiado' : 'Copiar HTML'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConfigurationSummary({ checks, detailed = false }: { checks: EmailConfigCheck[]; detailed?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Estado de configuracion</CardTitle></CardHeader>
      <CardContent className={cn('grid gap-3', detailed && 'sm:grid-cols-2')}>
        {checks.map((check) => (
          <div key={check.key} className={cn('rounded-lg border p-3', check.configured ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/10' : 'border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/10')}>
            <div className="flex items-start gap-2">
              {check.configured ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />}
              <div>
                <p className="text-sm font-semibold">{check.label}</p>
                <code className="text-[10px] text-muted-foreground">{check.key}</code>
                <p className="mt-1 text-xs text-muted-foreground">{check.description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MessageList({ messages, onView }: { messages: EmailMessage[]; onView?: (msg: EmailMessage) => void }) {
  if (messages.length === 0) {
    return <div className="py-14 text-center text-sm text-muted-foreground"><Mail className="mx-auto mb-2 h-8 w-8 opacity-40" />Sin envios registrados</div>
  }

  return (
    <div className="divide-y">
      {messages.map((message) => (
        <div key={message.id} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{message.subject || 'Sin asunto'}</p>
              <StatusBadge status={message.status} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {message.organizationName} · {message.recipientName || message.recipientEmail || 'Sin destinatario'}
            </p>
            {message.error && <p className="mt-1 truncate text-xs text-red-600" title={message.error}>{message.error}</p>}
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
            <p className="text-xs text-muted-foreground">{formatDate(message.sentAt)}</p>
            {message.providerId && (
              <a
                href={`https://resend.com/emails/${message.providerId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                title="Ver en Resend"
              >
                <code>{message.providerId.slice(0, 12)}…</code>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {message.htmlBody && onView && (
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => onView(message)}>
                <Eye className="h-3 w-3" /> Ver
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
