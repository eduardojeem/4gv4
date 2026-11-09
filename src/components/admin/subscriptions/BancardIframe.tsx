'use client'

import { useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'

type BancardFormApi = {
  createForm: (containerId: string, processId: string, options?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    Bancard?: {
      Checkout?: BancardFormApi
      Cards?: BancardFormApi
    }
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string) {
  const existing = scriptLoads.get(src)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoads.delete(src)
      reject(new Error('No se pudo cargar el formulario de Bancard.'))
    }
    document.head.appendChild(script)
  })
  scriptLoads.set(src, promise)
  return promise
}

/**
 * Formulario seguro de Bancard (vPOS 2.0). Los datos de la tarjeta se cargan
 * dentro del iframe de Bancard y nunca pasan por nuestros servidores.
 *
 * kind="checkout": pago único (single_buy). kind="cards": guardar una tarjeta.
 */
export function BancardIframe({
  kind,
  processId,
  scriptUrl,
  className,
}: {
  kind: 'checkout' | 'cards'
  processId: string
  scriptUrl: string
  className?: string
}) {
  const containerId = `bancard-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    loadScript(scriptUrl)
      .then(() => {
        if (cancelled) return
        const api = kind === 'cards' ? window.Bancard?.Cards : window.Bancard?.Checkout
        if (!api) throw new Error('El formulario de Bancard no está disponible.')
        const container = document.getElementById(containerId)
        if (container) container.innerHTML = ''
        api.createForm(containerId, processId)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [containerId, kind, processId, scriptUrl])

  return (
    <div className={className}>
      {state === 'loading' && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando el formulario seguro de Bancard…
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="py-6 text-center text-sm text-destructive">
          No se pudo cargar el formulario de Bancard. Recargá la página o intentá más tarde.
        </p>
      )}
      <div id={containerId} className="min-h-[340px] w-full" />
    </div>
  )
}
