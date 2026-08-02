'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LifeBuoy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface EnterSupportButtonProps {
  organizationId: string
  organizationName: string
  className?: string
  /** Render as a compact icon button (e.g. inside a table actions cell). */
  iconOnly?: boolean
}

/**
 * Starts a time-boxed "support mode" session against a tenant. The super_admin
 * must provide a reason; the action is audited and a banner appears while active.
 */
export function EnterSupportButton({ organizationId, organizationName, className, iconOnly = false }: EnterSupportButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function start() {
    if (reason.trim().length < 5) {
      setError('Indicá un motivo de al menos 5 caracteres.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/support-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, reason: reason.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'No se pudo iniciar el modo soporte.')
        return
      }
      setOpen(false)
      setReason('')
      toast.success(`Modo soporte iniciado para ${organizationName}.`)
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servicio de soporte.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (loading) return
      setOpen(nextOpen)
      if (!nextOpen) setError(null)
    }}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            aria-label={`Iniciar modo soporte para ${organizationName}`}
            title="Modo soporte auditado"
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40',
              className
            )}
          >
            <LifeBuoy className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className={cn('gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300', className)}>
            <LifeBuoy className="h-3.5 w-3.5" />
            Modo soporte
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entrar en modo soporte</DialogTitle>
          <DialogDescription>
            Accederás temporalmente a {organizationName}. El motivo y la sesión quedarán registrados en auditoría.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={`support-reason-${organizationId}`}>Motivo del acceso</Label>
          <Textarea
            id={`support-reason-${organizationId}`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              if (error) setError(null)
            }}
            placeholder="Ej.: revisar configuración de pagos solicitada por el owner"
            rows={4}
            maxLength={300}
            disabled={loading}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={error ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}>
              {error ?? 'Mínimo 5 caracteres.'}
            </span>
            <span className="text-slate-400">{reason.length}/300</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={() => void start()} disabled={loading || reason.trim().length < 5}>
            {loading ? 'Iniciando…' : 'Iniciar acceso temporal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
