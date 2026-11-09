'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, ExternalLink, Loader2, Send, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { EmailConfigCheck, EmailTemplateInfo } from '@/lib/superadmin/communications'

export function EmailSetupPanel({
  checks,
  templates,
  supabaseProjectRef,
}: {
  checks: EmailConfigCheck[]
  templates: EmailTemplateInfo[]
  supabaseProjectRef: string | null
}) {
  const [to, setTo] = useState('')
  const [pending, startTransition] = useTransition()
  const inFlight = useRef(false)
  const [error,setError] = useState<string | null>(null)
  const [acceptedTo,setAcceptedTo] = useState<string | null>(null)
  const resendReady = checks.find((c) => c.key === 'RESEND_API_KEY')?.configured ?? false

  const sendTest = () => {
    if (inFlight.current) return
    const recipient = to.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { setError('Ingresá un email válido.'); return }
    inFlight.current = true
    setError(null); setAcceptedTo(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/superadmin/emails/test', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:recipient}) }).catch(()=>{ throw new Error('Error de conexión. Volvé a intentar.') })
        const payload = await response.json().catch(()=>null) as {error?:string}|null
        if (!response.ok) throw new Error(payload?.error || 'No se pudo enviar')
        setAcceptedTo(recipient)
        toast.success('Resend aceptó el email de prueba. Revisá la bandeja del destinatario.')
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Error de conexión. Volvé a intentar.')
      } finally { inFlight.current=false }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Emails que envía la plataforma</CardTitle>
          <CardDescription>
            Los de <b>Supabase</b> (cuentas y contraseñas) se editan en el panel de Supabase; los de <b>Resend</b> están en el código de la app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y dark:divide-slate-800">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.description}</p>
                  <p className="font-mono text-[11px] text-slate-400">{t.sentFrom}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="rounded-full">{t.provider === 'supabase' ? 'Supabase' : 'Resend'}</Badge>
                  <Badge variant="outline" className={cn('rounded-full', t.available ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300')}>
                    {t.available ? 'Configurado · sin verificar entrega' : 'Sin configurar'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
          {supabaseProjectRef && (
            <Button asChild variant="link" className="mt-2 h-auto px-0">
              <a href={`https://supabase.com/dashboard/project/${supabaseProjectRef}/auth/templates`} target="_blank" rel="noreferrer">
                Editar plantillas de Supabase <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Configuración</CardTitle>
            <CardDescription>Solo se verifica si cada variable existe; los valores nunca se muestran.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {checks.map((c) => (
                <li key={c.key} className="flex gap-2">
                  {c.configured
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Configurado" />
                    : <XCircle className={cn('mt-0.5 h-4 w-4 shrink-0', c.critical ? 'text-red-600' : 'text-amber-500')} aria-label="Falta" />}
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enviar email de prueba</CardTitle>
            <CardDescription>Envía una prueba real a la dirección indicada. La aceptación del proveedor no confirma su entrega.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="test-email">Enviar a</Label>
            <div className="flex gap-2">
              <Input id="test-email" type="email" value={to} disabled={pending} onChange={(e) => setTo(e.target.value)} placeholder="tu@email.com" />
              <Button onClick={sendTest} disabled={pending || !resendReady || !to.includes('@')}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
              </Button>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {acceptedTo && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Aceptado por Resend para {acceptedTo}. Entrega aún no verificada.</p>}
            {!resendReady && <p className="text-xs text-red-600">Configurá RESEND_API_KEY para poder enviar.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
