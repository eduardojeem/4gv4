'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelAccountDeletionAction } from '@/app/superadmin/eliminaciones/actions'
import type { PendingAccountDeletion } from '@/lib/account/account-deletion'

const SOURCE_LABEL: Record<string, string> = { app: 'App', web: 'Web', support: 'Soporte' }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Pedidos de eliminación de cuenta pendientes, con la opción de cancelarlos. */
export function PendingAccountDeletions({ requests }: { requests: PendingAccountDeletion[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function cancel(request: PendingAccountDeletion) {
    const who = request.email ?? 'esta cuenta'
    const extra = request.closedOrganizations ? ` También se reabren ${request.closedOrganizations} negocio(s) con su plan y su tienda como estaban.` : ''
    if (!window.confirm(`¿Cancelar la eliminación de ${who}? La cuenta se desbloquea y vuelve a como estaba.${extra}`)) return
    setPendingId(request.id)
    startTransition(async () => {
      const result = await cancelAccountDeletionAction(request.id)
      setPendingId(null)
      if (result.ok) toast.success('Pedido cancelado. La persona ya puede iniciar sesión.')
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Cuentas a eliminar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos pendientes. La cuenta ya está bloqueada; los datos personales se borran en la fecha indicada. Cancelalo solo si la
          persona lo pidió desde el correo de la cuenta.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <UserX className="h-6 w-6" />
          No hay pedidos pendientes.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="break-all font-medium">{request.email ?? 'Sin correo'}</p>
                <p className="text-muted-foreground">
                  Pedido el {formatDate(request.requestedAt)} desde {SOURCE_LABEL[request.source] ?? request.source} · se borra el{' '}
                  {formatDate(request.scheduledFor)}
                  {request.closedOrganizations ? ` · cerró ${request.closedOrganizations} negocio(s)` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => cancel(request)} disabled={isPending}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                {pendingId === request.id ? 'Cancelando…' : 'Cancelar pedido'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
