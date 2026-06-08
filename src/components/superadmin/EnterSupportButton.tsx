'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LifeBuoy } from 'lucide-react'
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
  const [loading, setLoading] = useState(false)

  async function start() {
    const reason = window.prompt(`Motivo para entrar en modo soporte en "${organizationName}":`)
    if (reason === null) return
    if (reason.trim().length < 5) {
      window.alert('Indicá un motivo (mínimo 5 caracteres).')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/support-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, reason: reason.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(body.error || 'No se pudo iniciar el modo soporte.')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={loading}
        title="Modo soporte (auditado y temporal)"
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-950/40',
          className
        )}
      >
        <LifeBuoy className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        className
      )}
      title="Entrar en modo soporte (auditado y temporal)"
    >
      <LifeBuoy className="h-3.5 w-3.5" />
      {loading ? 'Activando…' : 'Modo soporte'}
    </button>
  )
}
