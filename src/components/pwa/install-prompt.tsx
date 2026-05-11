'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS] = useState(() => {
    if (typeof window === 'undefined') return false
    return /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !('MSStream' in window)
  })
  const [isStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    const handler = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setDeferredPrompt(promptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast.info('Para instalar en iOS: presiona el botón "Compartir" y luego "Agregar a Inicio"', {
          duration: 5000,
        })
      }
      return
    }

    deferredPrompt.prompt()

    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      toast.success('¡Aplicación instalada correctamente!')
    }
  }

  if (isStandalone) return null

  // Don't show anything if not installable (unless it's iOS where we might want to show instructions, 
  // but for now let's only show if we have the prompt event or if it's explicitly requested)
  if (!deferredPrompt && !isIOS) return null

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="hidden md:flex gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
      onClick={handleInstallClick}
    >
      <Download className="h-4 w-4" />
      <span className="hidden lg:inline">Instalar App</span>
    </Button>
  )
}
