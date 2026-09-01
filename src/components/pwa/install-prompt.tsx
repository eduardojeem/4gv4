'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/**
 * Boton para instalar la app.
 *
 * Antes estaba con `hidden md:flex`, es decir invisible justo en el celular,
 * que es donde instalar tiene mas sentido; y el aviso de iOS quedaba tapado por
 * esa misma clase, asi que nunca se veia.
 *
 * En iOS no existe `beforeinstallprompt`: Safari solo permite instalar a mano
 * desde Compartir, por eso ahi se muestran las instrucciones.
 */
export function InstallPrompt({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)

  // La deteccion corre en un efecto y no en el estado inicial: leer `navigator`
  // o `matchMedia` durante el render hace que el servidor y el cliente pinten
  // cosas distintas y React descarte la hidratacion.
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const iOS = /iPad|iPhone|iPod/.test(nav.userAgent) && !('MSStream' in window)
    const installed =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true

    setIsIOS(iOS)
    setIsStandalone(installed)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      // Se frena el aviso propio del navegador para ofrecerlo desde este boton.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const installedHandler = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast.info('Para instalar en iPhone o iPad', {
          description: 'Tocá el botón Compartir de Safari y elegí "Agregar a inicio".',
          duration: 8000,
        })
      }
      return
    }

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    // El evento no se puede reutilizar: si lo rechaza, el navegador emitira uno
    // nuevo mas adelante si vuelve a corresponder.
    setDeferredPrompt(null)

    if (outcome === 'accepted') {
      toast.success('¡Aplicación instalada!')
    }
  }

  // Ya instalada, o el navegador no ofrece instalarla (y no es iOS): sin boton.
  if (isStandalone) return null
  if (!deferredPrompt && !isIOS) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className={className ?? 'gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary'}
      onClick={handleInstallClick}
    >
      <Download className="h-4 w-4" />
      {/* En pantallas angostas queda solo el icono: el header del panel ya lleva
          menu, notificaciones y avatar, y el texto lo desbordaba. */}
      <span className="hidden sm:inline">Instalar app</span>
      <span className="sr-only sm:hidden">Instalar app</span>
    </Button>
  )
}
