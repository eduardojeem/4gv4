'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Loader2, Ticket, Smartphone, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'

export default function MisReparacionesPage() {
  const router = useRouter()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    contact: '',
    ticketNumber: ''
  })
  useEffect(() => {
    try {
      const savedTicket = localStorage.getItem('mr_ticket') || ''
      const savedContact = localStorage.getItem('mr_contact') || ''
      if (savedTicket || savedContact) {
        setFormData({ ticketNumber: savedTicket, contact: savedContact })
      }
    } catch {}
  }, [])

  const handleTicketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setFormData({ ...formData, ticketNumber: value })
    try { localStorage.setItem('mr_ticket', value) } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.ticketNumber.trim() || !formData.contact.trim()) {
      toast.error('Por favor completa todos los campos')
      return
    }

    setLoading(true)

    try {
      // Execute reCAPTCHA
      if (!executeRecaptcha) {
        toast.error('Error de verificación. Recarga la página.')
        setLoading(false)
        return
      }

      const recaptchaToken = await executeRecaptcha('repair_auth')

      const response = await fetch('/api/public/repairs/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          ...formData,
          recaptchaToken
        })
      })

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await response.text()
        console.error('DEBUG - Auth non-JSON response details:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          bodyText: text
        })
        toast.error(`Error de servidor (${response.status}). Revisa la consola.`)
        setLoading(false)
        return
      }
      const data = await response.json()

      if (!data.success) {
        if (response.status === 429) {
          const retry = response.headers.get('Retry-After')
          toast.error(`Demasiados intentos. Intenta de nuevo en ${retry ? `${retry} segundos` : 'unos minutos'}.`)
        } else if (response.status === 401) {
          toast.error('Ticket no encontrado o datos incorrectos')
        } else if (response.status === 400) {
          const detail = Array.isArray(data.details) ? data.details[0] : undefined
          toast.error(detail || data.error || 'Datos inválidos')
        } else {
          toast.error(data.error || 'Error al autenticar')
        }
        setLoading(false)
        return
      }

      // Token is now stored in httpOnly cookie by the server
      
      // Redirect to repair details
      router.push(`/mis-reparaciones/${formData.ticketNumber}`)
    } catch (error) {
      console.error('Auth error:', error)
      toast.error('Error al procesar la solicitud')
      setLoading(false)
    }
  }

  return (
    <div className="container flex min-h-[calc(100vh-140px)] flex-col items-center justify-center py-12 bg-muted/30">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Rastreo de Reparaciones</h1>
          <p className="text-muted-foreground">
            Consulta el estado de tu dispositivo en tiempo real
          </p>
        </div>

        <Card className="border-muted-foreground/10 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Ingresa tus datos</CardTitle>
            <CardDescription>
              Necesitarás tu número de ticket y el contacto registrado
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Ticket Number */}
              <div className="space-y-2">
                <Label htmlFor="ticketNumber">Número de ticket</Label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ticketNumber"
                    placeholder="Ej: REP-000042 o R-2026-00042"
                    className="pl-9 font-mono uppercase placeholder:normal-case"
                    value={formData.ticketNumber}
                    onChange={handleTicketChange}
                    required
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lo encontrarás en tu comprobante (empieza con REP- o R-)
                </p>
              </div>

              {/* Contact (Email or Phone) */}
              <div className="space-y-2">
                <Label htmlFor="contact">Email o Teléfono</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact"
                    placeholder="Tu email o número de celular"
                    className="pl-9"
                    value={formData.contact}
                    onChange={(e) => {
                      const v = e.target.value
                      setFormData({ ...formData, contact: v })
                      try { localStorage.setItem('mr_contact', v) } catch {}
                    }}
                    required
                    autoComplete="username"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  El mismo que proporcionaste al dejar tu equipo
                </p>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Ver estado de reparación
                  </>
                )}
              </Button>
            </form>

            {/* Help Section */}
            <div className="mt-6 flex items-start gap-3 rounded-md bg-blue-50/50 p-3 text-sm dark:bg-blue-950/20">
              <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-200">¿Problemas para ingresar?</p>
                <p className="text-blue-700 dark:text-blue-300 text-xs">
                  Si perdiste tu ticket, contáctanos directamente a nuestro WhatsApp de soporte para ayudarte.
                </p>
              </div>
            </div>

            {/* reCAPTCHA Badge Info */}
            <p className="mt-6 text-[10px] text-center text-muted-foreground/60">
              Protegido por reCAPTCHA. Google{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                Privacidad
              </a>{' '}
              y{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                Términos
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
