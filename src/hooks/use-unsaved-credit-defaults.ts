'use client'
import { useEffect } from 'react'

/** Protect links/reload and history traversals in browsers with the Navigation API. */
export function useUnsavedCreditDefaults(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const message = 'Tenés cambios sin guardar. ¿Querés salir y descartarlos?'
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const confirmLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation() }
    }
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation
    const traverse = (event: Event) => {
      const next = event as Event & { navigationType?: string; destination?: { url: string } }
      if (next.navigationType === 'traverse' && event.cancelable && next.destination?.url !== window.location.href && !window.confirm(message)) event.preventDefault()
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', confirmLink, true)
    navigation?.addEventListener('navigate', traverse)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', confirmLink, true)
      navigation?.removeEventListener('navigate', traverse)
    }
  }, [dirty])
}
