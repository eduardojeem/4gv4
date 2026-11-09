'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, X, CheckCircle2 } from 'lucide-react'

interface SupportSessionBannerProps {
  session: { organizationName: string | null; organizationSlug: string | null; reason: string; expiresAt: string }
}
export function SupportSessionBanner({ session }: SupportSessionBannerProps) {
  const router = useRouter()
  const [remaining, setRemaining] = useState('')
  const [expired, setExpired] = useState(false)
  const [ended, setEnded] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const refreshedExpiry = useRef<string | null>(null)

  useEffect(() => {
    if (ended) return
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const ms = new Date(session.expiresAt).getTime() - Date.now()
      if (!Number.isFinite(ms) || ms <= 0) {
        setRemaining('00:00'); setExpired(true)
        if (timer !== undefined) clearInterval(timer)
        if (refreshedExpiry.current !== session.expiresAt) {
          refreshedExpiry.current = session.expiresAt
          router.refresh()
        }
        return false
      }
      setExpired(false)
      const minutes = Math.floor(ms / 60000), seconds = Math.floor((ms % 60000) / 1000)
      setRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      return true
    }
    if (tick()) timer = setInterval(tick, 1000)
    return () => { if (timer !== undefined) clearInterval(timer) }
  }, [session.expiresAt, router, ended])

  async function endSupport() {
    if (inFlight.current || ended) return
    inFlight.current = true; setEnding(true); setError(null)
    try {
      const response = await fetch('/api/superadmin/support-session', { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.success !== true) {
        setError(typeof body.error === 'string' ? body.error : 'No se pudo confirmar el cierre. Volvé a intentar.')
        return
      }
      setEnded(true)
      router.refresh()
    } catch {
      setError('No se pudo conectar. La sesión se conserva para que puedas reintentar el cierre.')
    } finally {
      inFlight.current = false; setEnding(false)
    }
  }
  const orgLabel = session.organizationName || session.organizationSlug || 'organización'
  if (ended) return <div role="status" className="flex shrink-0 items-center gap-2 bg-emerald-100 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 aria-hidden className="size-4"/>Sesión de soporte cerrada correctamente.</div>
  return <div className="z-50 shrink-0 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-sm dark:bg-amber-950 dark:text-amber-100">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><ShieldAlert aria-hidden className="size-4 shrink-0"/><span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{expired ? 'Sesión de soporte vencida en ' : 'Soporte activo en '}<strong>{orgLabel}</strong></span><span className="hidden max-w-xl opacity-80 [overflow-wrap:anywhere] sm:inline">· {session.reason}</span>{!expired && <span className="tabular-nums">· {remaining || '…'} restantes</span>}</div><button type="button" onClick={() => void endSupport()} disabled={ending} className="flex min-h-11 items-center gap-2 rounded-xl border border-current/15 px-3 py-2 text-sm font-semibold transition-colors hover:bg-amber-950/10 disabled:opacity-50"><X aria-hidden className="size-4"/>{ending ? 'Saliendo…' : 'Salir de soporte'}</button></div>
    {error && <p role="alert" className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-sm font-medium text-red-800 dark:bg-black/20 dark:text-red-200">{error}</p>}
  </div>
}
