'use client'

import { useEffect, useState, type CSSProperties } from 'react'

/** Adapta el modal al teclado sin bloquear el zoom manual del navegador. */
export function useMobileDialogViewport(enabled: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({})
  useEffect(() => {
    if (!enabled || !window.visualViewport) return
    const viewport = window.visualViewport
    const update = () => {
      const next: CSSProperties = window.innerWidth < 640 && Math.abs(viewport.scale - 1) < 0.01
        ? { height: viewport.height, top: viewport.offsetTop } : {}
      setStyle(previous => previous.height === next.height && previous.top === next.top ? previous : next)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [enabled])
  return enabled ? style : {}
}
