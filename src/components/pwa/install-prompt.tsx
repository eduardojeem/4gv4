'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, MoreVertical, Share, Smartphone, WifiOff, Zap } from 'lucide-react'
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
export function InstallPrompt({
  className,
  compact = false,
  variant = 'button',
}: {
  className?: string
  compact?: boolean
  variant?: 'button' | 'icon' | 'menu-item'
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  // El navegador ya ofrecio instalar y la persona dijo que no. El evento no se
  // puede reutilizar, pero el boton se queda: quien cierra el cartel sin querer
  // no tiene otra forma de volver, y el navegador puede tardar dias en reofrecer.
  const [promptUsed, setPromptUsed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  // La deteccion corre en un efecto y no en el estado inicial: leer `navigator`
  // o `matchMedia` durante el render hace que el servidor y el cliente pinten
  // cosas distintas y React descarte la hidratacion.
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    // El iPad con iPadOS 13+ se anuncia como Macintosh: sin mirar los puntos de
    // contacto queda afuera, y es donde mas sirve tener la app instalada.
    const iPadOS = /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1
    const iOS = (/iPad|iPhone|iPod/.test(nav.userAgent) || iPadOS) && !('MSStream' in window)
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
      setPromptUsed(false)
    }

    const installedHandler = () => {
      setDeferredPrompt(null)
      setGuideOpen(false)
      setIsStandalone(true)
      toast.success('¡Aplicación instalada!', {
        description: 'Ya podés abrirla desde el ícono, sin pasar por el navegador.',
      })
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstallClick = async () => {
    // Sin evento del navegador no hay nada que disparar: en iOS nunca lo hay, y
    // despues de un rechazo el de antes ya no sirve. En los dos casos lo unico
    // util es explicar como se hace a mano, y explicarlo en un cartel que se
    // quede: el aviso flotante se iba antes de que la persona llegue al menu.
    if (!deferredPrompt) {
      setGuideOpen(true)
      return
    }

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    // El evento no se puede reutilizar, pero el boton no desaparece: pasa a
    // abrir las instrucciones, que es lo unico que queda por ofrecer.
    setDeferredPrompt(null)
    setPromptUsed(true)

    if (outcome === 'accepted') {
      // `appinstalled` avisa cuando termina; esto es el acuse inmediato.
      toast.success('Instalando la aplicación…')
    }
  }

  // Ya instalada, o el navegador no ofrece instalarla (y no es iOS): sin boton.
  if (isStandalone) return null
  if (!deferredPrompt && !isIOS && !promptUsed) return null

  const pasos = isIOS
    ? [
        { icono: Share, texto: 'Tocá el botón Compartir en la barra de Safari.' },
        { icono: Download, texto: 'Deslizá la lista y elegí «Agregar a inicio».' },
        { icono: Smartphone, texto: 'Confirmá con «Agregar»: queda el ícono en la pantalla.' },
      ]
    : [
        { icono: MoreVertical, texto: 'Abrí el menú del navegador (los tres puntos).' },
        { icono: Download, texto: 'Elegí «Instalar aplicación» o «Agregar a pantalla principal».' },
      ]

  const guia = (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar la aplicación
          </DialogTitle>
          <DialogDescription>
            {isIOS
              ? 'En iPhone y iPad se agrega desde Safari, en tres pasos.'
              : 'Se agrega desde el menú del navegador, en dos pasos.'}
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          {pasos.map(({ icono: Icono, texto }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="flex items-start gap-2 pt-1 text-muted-foreground">
                <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{texto}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
            Abre más rápido
          </span>
          <span className="flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-primary" />
            Anda con poca señal
          </span>
          <span className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-primary" />
            Sin barra del navegador
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )

  if (variant === 'icon' || compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          title="Instalar aplicación"
          aria-label="Instalar app"
          className={
            className ??
            'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground hover:bg-muted/80 hover:text-primary transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          }
        >
          <Download className="h-4 w-4" />
          <span className="sr-only">Instalar app</span>
        </button>
        {guia}
      </>
    )
  }

  if (variant === 'menu-item') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={
            className ??
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors text-left'
          }
        >
          <Download className="h-4 w-4 text-primary shrink-0" />
          <span>Instalar aplicación</span>
        </button>
        {guia}
      </>
    )
  }

  return (
    <>
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
      {guia}
    </>
  )
}
