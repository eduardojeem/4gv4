'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Link2,
  Link2Off,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface CustomerLinkAccountProps {
  customerId: string
  customerName: string
  customerEmail?: string
  profileId?: string | null
  onLinked?: () => void
}

/**
 * Badge que indica si el cliente tiene cuenta vinculada.
 * Si no tiene, muestra botón para vincular.
 */
export function CustomerAccountBadge({
  profileId,
  onLinkClick,
}: {
  profileId?: string | null
  onLinkClick?: () => void
}) {
  if (profileId) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        <UserCheck className="h-3 w-3" />
        Cuenta vinculada
      </Badge>
    )
  }

  return (
    <button
      type="button"
      onClick={onLinkClick}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
    >
      <Link2 className="h-3 w-3" />
      Sin cuenta
    </button>
  )
}

/**
 * Sección completa de vinculación en el detalle del cliente.
 */
export function CustomerLinkAccount({
  customerId,
  customerName,
  customerEmail,
  profileId,
  onLinked,
}: CustomerLinkAccountProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [email, setEmail] = useState(customerEmail || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unlinking, setUnlinking] = useState(false)

  const handleLink = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/customers/${customerId}/link-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al vincular')
        return
      }

      toast.success(data.message || 'Cuenta vinculada')
      setDialogOpen(false)
      onLinked?.()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm(`¿Desvincular la cuenta de "${customerName}"? El cliente perderá acceso a sus reparaciones y pedidos desde la página pública.`)) return
    setUnlinking(true)

    try {
      const res = await fetch(`/api/customers/${customerId}/link-account`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Cuenta desvinculada')
        onLinked?.()
      } else {
        toast.error('No se pudo desvincular')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUnlinking(false)
    }
  }

  if (profileId) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Cuenta autenticada vinculada
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              El cliente puede ver sus reparaciones, comprar y acceder a precios especiales.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnlink}
          disabled={unlinking}
          className="text-slate-500 hover:text-red-600"
        >
          {unlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <Link2 className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Sin cuenta vinculada
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vinculá una cuenta para que el cliente acceda a sus reparaciones y compre online.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Vincular
          </Button>
          {customerEmail && (
            <Button variant="default" size="sm" onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Crear cuenta
            </Button>
          )}
        </div>
      </div>

      {/* Dialog: Vincular cuenta existente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Vincular cuenta a &quot;{customerName}&quot;</DialogTitle>
            <DialogDescription>
              Ingresá el email con el que el cliente se registró. Si no tiene cuenta, usá &quot;Crear cuenta&quot; para crearle una.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label htmlFor="link-email" className="text-sm font-medium">
                Email de la cuenta
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="link-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLink} disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Vincular cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear cuenta nueva */}
      <CreateAccountDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        customerId={customerId}
        customerName={customerName}
        customerEmail={customerEmail || ''}
        onSuccess={onLinked}
      />
    </>
  )
}


// ─── Create Account Dialog ────────────────────────────────────────────────────

function CreateAccountDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerEmail,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
  customerEmail: string
  onSuccess?: () => void
}) {
  const [mode, setMode] = useState<'invite' | 'password'>('invite')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ message: string; temporaryPassword?: string } | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/customers/${customerId}/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendInvite: mode === 'invite',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al crear la cuenta')
        return
      }

      setResult({
        message: data.message,
        temporaryPassword: data.temporaryPassword,
      })
      toast.success(data.message)
      onSuccess?.()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset después de cerrar
    setTimeout(() => {
      setError('')
      setResult(null)
      setMode('invite')
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crear cuenta para &quot;{customerName}&quot;</DialogTitle>
          <DialogDescription>
            Se creará una cuenta con el email <strong>{customerEmail}</strong>. El cliente podrá acceder a la página pública para ver reparaciones, comprar y más.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="font-medium">✓ {result.message}</p>
              {result.temporaryPassword && (
                <p className="mt-2 rounded bg-white p-2 font-mono text-xs dark:bg-slate-900">
                  Contraseña temporal: <strong>{result.temporaryPassword}</strong>
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('invite')}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  mode === 'invite'
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                }`}
              >
                <Send className={`h-4 w-4 ${mode === 'invite' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="mt-1.5 text-xs font-semibold">Enviar invitación</p>
                <p className="mt-0.5 text-[10px] text-slate-500">El cliente define su contraseña</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  mode === 'password'
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                }`}
              >
                <UserPlus className={`h-4 w-4 ${mode === 'password' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="mt-1.5 text-xs font-semibold">Crear con contraseña</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Se genera una contraseña temporal</p>
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
              {mode === 'invite' ? (
                <p>Se enviará un email a <strong>{customerEmail}</strong> con un link para que el cliente cree su contraseña y active su cuenta.</p>
              ) : (
                <p>Se creará la cuenta inmediatamente con una contraseña temporal. Se le enviará un email para que el cliente la cambie.</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {mode === 'invite' ? 'Enviar invitación' : 'Crear cuenta'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
