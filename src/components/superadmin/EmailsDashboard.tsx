'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Mail,
  RefreshCw,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  stats: {
    sent24h: number
    failed24h: number
    successRate: number | null
    totalMessages: number
  }
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  sent: { label: 'Enviado', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300' },
  delivered: { label: 'Entregado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' },
  read: { label: 'Leido', className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300' },
  failed: { label: 'Fallido', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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
                <Button asChild variant="link" className="mt-1 h-auto px-0 text-xs">
                  <Link href={template.sentFrom}>Abrir origen en la aplicacion</Link>
                </Button>
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

function TestEmailCard({ defaultEmail, configured }: { defaultEmail: string; configured: boolean }) {
  const [to, setTo] = useState(defaultEmail)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function sendTestEmail() {
    setSending(true)
    setResult(null)
    try {
      const response = await fetch('/api/superadmin/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
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
        <Button className="w-full gap-2" onClick={sendTestEmail} disabled={!configured || !to || sending}>
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

export function EmailsDashboard({ data }: { data: EmailsData }) {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [templateSource, setTemplateSource] = useState<'all' | EmailTemplate['source']>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filteredTemplates = useMemo(
    () => data.templates.filter((template) => templateSource === 'all' || template.source === templateSource),
    [data.templates, templateSource]
  )
  const filteredMessages = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return data.messages.filter((message) => {
      const matchesStatus = statusFilter === 'all' || message.status === statusFilter
      const matchesSearch = !normalized || [
        message.organizationName,
        message.recipientName,
        message.recipientEmail,
        message.subject,
      ].some((value) => value?.toLowerCase().includes(normalized))
      return matchesStatus && matchesSearch
    })
  }, [data.messages, search, statusFilter])

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" />
            Actualizar datos
          </Button>
          <Button asChild className="gap-2">
            <a href="https://supabase.com/dashboard/project/_/auth/templates" target="_blank" rel="noreferrer">
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enviados 24h" value={data.stats.sent24h} helper="Aceptados por el proveedor" icon={Send} tone="blue" />
        <MetricCard label="Fallidos 24h" value={data.stats.failed24h} helper="Requieren revision" icon={XCircle} tone={data.stats.failed24h ? 'red' : 'slate'} />
        <MetricCard label="Tasa de exito" value={data.stats.successRate === null ? 'Sin datos' : `${data.stats.successRate}%`} helper="Sobre registros de las ultimas 24h" icon={ShieldCheck} tone="emerald" />
        <MetricCard label="Configuracion" value={`${configuredCount}/${data.configChecks.length}`} helper="Variables y proveedor" icon={ServerCog} tone={criticalMissing.length ? 'red' : 'emerald'} />
      </section>

      <Tabs defaultValue="overview" className="gap-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border bg-background p-1">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="history">Historial <Badge variant="secondary">{data.messages.length}</Badge></TabsTrigger>
          <TabsTrigger value="configuration">Configuracion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ultimos envios registrados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MessageList messages={data.messages.slice(0, 8)} />
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tenant, destinatario o asunto" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'sent', 'delivered', 'read', 'failed'].map((status) => (
                <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(status)}>
                  {status === 'all' ? 'Todos' : STATUS_META[status]?.label ?? status}
                </Button>
              ))}
            </div>
          </div>
          <Card><CardContent className="p-0"><MessageList messages={filteredMessages} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="configuration" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <ConfigurationSummary checks={data.configChecks} detailed />
          <TestEmailCard defaultEmail="" configured={resendConfigured} />
        </TabsContent>
      </Tabs>

      <TemplateSheet template={selectedTemplate} onOpenChange={(open) => { if (!open) setSelectedTemplate(null) }} />
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

function MessageList({ messages }: { messages: EmailMessage[] }) {
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
              {message.organizationName} · {message.recipientName || message.recipientEmail || 'Detalle de destinatario no disponible'}
            </p>
            {message.error && <p className="mt-1 truncate text-xs text-red-600" title={message.error}>{message.error}</p>}
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p>{formatDate(message.sentAt)}</p>
            {message.providerId && <code className="text-[10px]">{message.providerId}</code>}
          </div>
        </div>
      ))}
    </div>
  )
}
