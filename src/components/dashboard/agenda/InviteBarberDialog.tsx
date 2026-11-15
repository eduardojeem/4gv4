'use client'

import { useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InviteBarberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  professional: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  }
  onSuccess?: (userId: string) => void
}

export function InviteBarberDialog({
  open,
  onOpenChange,
  professional,
  onSuccess,
}: InviteBarberDialogProps) {
  const [email, setEmail] = useState(professional.email || '')
  const [sendEmailInvite, setSendEmailInvite] = useState(true)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<{
    inviteLink: string
    whatsappUrl: string
    message: string
  } | null>(null)

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Por favor ingresá un correo electrónico válido')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/agenda/professionals/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId: professional.id,
          email: email.trim().toLowerCase(),
          sendEmailInvite,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudo generar la invitación')
      }

      setResult({
        inviteLink: data.inviteLink,
        whatsappUrl: data.whatsappUrl,
        message: data.message,
      })
      if (data.emailSent === false) toast.warning(data.message)
      else toast.success('¡Invitación generada exitosamente!')
      if (data.userId && onSuccess) {
        onSuccess(data.userId)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al enviar la invitación')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result?.inviteLink) return
    try {
      await navigator.clipboard.writeText(result.inviteLink)
      setCopied(true)
      toast.success('Enlace de invitación copiado al portapapeles')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('No se pudo copiar automáticamente')
    }
  }

  const handleReset = () => {
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wide uppercase">
            <UserPlus className="h-4 w-4" />
            Acceso al sistema
          </div>
          <DialogTitle className="text-xl font-bold">
            Invitar a {professional.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            La activación llega al correo del empleado. El enlace compartible abre el inicio de sesión y no contiene credenciales.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="barber-invite-email" className="text-xs font-semibold">
                Correo electrónico del barbero
              </Label>
              <Input
                id="barber-invite-email"
                type="email"
                placeholder="ej: carlos.barber@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Se vinculará a la organización con permisos de vendedor/operativo.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmailInvite}
                  onChange={(e) => setSendEmailInvite(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">Enviar correo de invitación</span>
                  <span className="text-muted-foreground text-[11px]">
                    Obligatorio para cuentas nuevas. Las cuentas existentes usan su contraseña actual.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Podés compartir el inicio de sesión por <b>WhatsApp</b> con un mensaje listo.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-4 text-center dark:bg-emerald-950/20">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                <Check className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                ¡Invitación lista para {professional.name}!
              </h4>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                {result.message}
              </p>
            </div>

            {/* Acción 1: Compartir por WhatsApp */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Opción rápida por WhatsApp</Label>
              <Button
                asChild
                className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#20ba5a] shadow-xs"
              >
                <a href={result.whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Enviar enlace por WhatsApp
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>
              </Button>
            </div>

            {/* Acción 2: Copiar enlace */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">O copiá el enlace de inicio de sesión:</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={result.inviteLink}
                  className="font-mono text-xs bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copiar enlace"
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={loading} className="gap-1.5">
                {loading ? <Mail className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Generar invitación
              </Button>
            </>
          ) : (
            <Button onClick={handleReset} className="w-full">
              Listo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
