'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running in standalone mode
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)

    // Check if device is iOS
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream)

    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
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
