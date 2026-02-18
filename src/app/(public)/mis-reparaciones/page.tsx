'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Ticket, Smartphone, Search, ArrowRight, Phone, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'

const STEPS = [
  { number: '1', title: 'Recibido', desc: 'Ingreso al taller' },
  { number: '2', title: 'Diagnostico', desc: 'Evaluacion tecnica' },
  { number: '3', title: 'Reparacion', desc: 'Trabajo en progreso' },
  { number: '4', title: 'Listo', desc: 'Para retirar' },
]

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
    } catch { /* ignore */ }
  }, [])

  const handleTicketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setFormData(prev => ({ ...prev, ticketNumber: value }))
    try { localStorage.setItem('mr_ticket', value) } catch { /* ignore */ }
  }

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, contact: value }))
    try { localStorage.setItem('mr_contact', value) } catch { /* ignore */ }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.ticketNumber.trim() || !formData.contact.trim()) {
      toast.error('Por favor completa todos los campos')
      return
    }

    setLoading(true)

    try {
      if (!executeRecaptcha) {
        toast.error('Error de verificacion. Recarga la pagina.')
        setLoading(false)
        return
      }

      const recaptchaToken = await executeRecaptcha('repair_auth')

      const response = await fetch('/api/public/repairs/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ ...formData, recaptchaToken })
      })

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        toast.error(`Error de servidor (${response.status})`)
        setLoading(false)
        return
      }

      const data = await response.json()

      if (!data.success) {
        if (response.status === 429) {
          const retry = response.headers.get('Retry-After')
          toast.error(`Demasiados intentos. Intenta en ${retry ? `${retry} segundos` : 'unos minutos'}.`)
        } else if (response.status === 401) {
          toast.error('Ticket no encontrado o datos incorrectos')
        } else if (response.status === 400) {
          const detail = Array.isArray(data.details) ? data.details[0] : undefined
          toast.error(detail || data.error || 'Datos invalidos')
        } else {
          toast.error(data.error || 'Error al autenticar')
        }
        setLoading(false)
        return
      }

      router.push(`/mis-reparaciones/${formData.ticketNumber}`)
    } catch {
      toast.error('Error al procesar la solicitud')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-140px)]">
      {/* Hero / Search Section */}
      <section className="relative overflow-hidden bg-primary/[0.03]">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Rastreo de Reparaciones
            </h1>
            <p className="mt-3 text-pretty text-muted-foreground">
              Consulta el estado de tu dispositivo en tiempo real. Ingresa tu numero de ticket y el contacto que registraste.
            </p>
          </div>

          {/* Form Card */}
          <div className="mx-auto mt-10 max-w-md">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-primary/5 md:p-8"
            >
              <div className="space-y-5">
                {/* Ticket */}
                <div className="space-y-2">
                  <Label htmlFor="ticketNumber" className="text-sm font-medium">
                    Numero de ticket
                  </Label>
                  <div className="relative">
                    <Ticket className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ticketNumber"
                      placeholder="Ej: REP-000042"
                      className="h-11 pl-10 font-mono uppercase placeholder:font-sans placeholder:normal-case"
                      value={formData.ticketNumber}
                      onChange={handleTicketChange}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lo encontraras en tu comprobante (empieza con REP- o R-)
                  </p>
                </div>

                {/* Contact */}
                <div className="space-y-2">
                  <Label htmlFor="contact" className="text-sm font-medium">
                    Email o Telefono
                  </Label>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="contact"
                      placeholder="Tu email o numero de celular"
                      className="h-11 pl-10"
                      value={formData.contact}
                      onChange={handleContactChange}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El mismo que proporcionaste al dejar tu equipo
                  </p>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="h-12 w-full gap-2 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Ver estado
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Help */}
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-muted/60 p-4">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Problemas para ingresar?
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Si perdiste tu ticket, contactanos directamente por WhatsApp.
                  </p>
                  <a
                    href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '595981234567'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    Contactar soporte
                  </a>
                </div>
              </div>

              {/* reCAPTCHA */}
              <p className="mt-5 text-center text-[10px] text-muted-foreground/50">
                Protegido por reCAPTCHA.{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  Privacidad
                </a>{' '}
                y{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  Terminos
                </a>
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card">
        <div className="container py-16">
          <h2 className="text-center text-xl font-semibold text-foreground">
            Como funciona
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
            Tu dispositivo pasa por estas etapas. Te notificamos en cada cambio de estado.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-6 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative text-center">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+28px)] top-7 hidden h-px w-[calc(100%-56px)] bg-border md:block" />
                )}
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                  {step.number}
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
