'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, X } from 'lucide-react'

interface SupportSessionBannerProps {
  session: {
    organizationName: string | null
    organizationSlug: string | null
    reason: string
    expiresAt: string
  }
}

export function SupportSessionBanner({ session }: SupportSessionBannerProps) {
  const router = useRouter()
  const [remaining, setRemaining] = useState('')
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    const tick = () => {
      const ms = new Date(session.expiresAt).getTime() - Date.now()
      if (ms <= 0) {
        setRemaining('00:00')
        router.refresh()
        return
      }
      const minutes = Math.floor(ms / 60000)
      const seconds = Math.floor((ms % 60000) / 1000)
      setRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [session.expiresAt, router])

  async function endSupport() {
    setEnding(true)
    try {
      await fetch('/api/superadmin/support-session', { method: 'DELETE' })
      router.refresh()
    } finally {
      setEnding(false)
    }
  }

  const orgLabel = session.organizationName || session.organizationSlug || 'organización'

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        Modo <strong>SOPORTE</strong> activo en <strong>{orgLabel}</strong>
        <span className="hidden opacity-80 sm:inline">· {session.reason}</span>
        <span className="tabular-nums">· vence en {remaining}</span>
      </span>
      <button
        type="button"
        onClick={endSupport}
        disabled={ending}
        className="flex items-center gap-1 rounded-md bg-amber-950/10 px-2 py-1 transition-colors hover:bg-amber-950/20 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        {ending ? 'Saliendo…' : 'Salir de soporte'}
      </button>
    </div>
  )
}
