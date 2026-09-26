'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPasswordChecks, isValidEmail, validatePassword } from '@/lib/auth/password-validation'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'

/** El aviso que va debajo del dato equivocado, no arriba de todo el formulario. */
function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {children}
    </p>
  )
}

export default function TenantCustomerRegisterPage() {
  const params = useParams<{ organizationSlug: string }>()
  const router = useRouter()
  const organizationSlug = params.organizationSlug
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [emailYaRegistrado, setEmailYaRegistrado] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof formData, string>>>({})

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
    // El error se borra al corregir, no al volver a enviar: si no, el cartel
    // rojo queda contradiciendo lo que la persona acaba de escribir.
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
    setError('')
  }

  /**
   * Todo lo que se puede decir sin ir al servidor se dice acá, y se dice junto:
   * mandar el formulario para enterarse de un error por vez es lo que hace que
   * la gente abandone el registro.
   */
  function validateFields() {
    const errores: Partial<Record<keyof typeof formData, string>> = {}

    if (formData.fullName.trim().length < 2) {
      errores.fullName = 'Escribí tu nombre y apellido.'
    }

    if (!formData.email.trim()) {
      errores.email = 'Escribí tu correo electrónico.'
    } else if (!isValidEmail(formData.email.trim())) {
      errores.email = 'Revisá el correo: tiene que ser como nombre@correo.com.'
    }

    // El teléfono es opcional, pero si lo dejan a medias la tienda no puede
    // avisar nada: seis dígitos es el mínimo de un número real acá.
    const digitosDelTelefono = formData.phone.replace(/\D/g, '')
    if (formData.phone.trim() && digitosDelTelefono.length < 6) {
      errores.phone = 'Revisá el teléfono: escribilo completo, por ejemplo 0981 123 456.'
    }

    const problemaDeClave = validatePassword(formData.password)
    if (!formData.password) {
      errores.password = 'Elegí una contraseña.'
    } else if (problemaDeClave) {
      errores.password = `${problemaDeClave}.`
    }

    if (!formData.confirmPassword) {
      errores.confirmPassword = 'Repetí la contraseña para confirmarla.'
    } else if (formData.password !== formData.confirmPassword) {
      errores.confirmPassword = 'Las dos contraseñas no coinciden.'
    }

    setFieldErrors(errores)
    return Object.keys(errores).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!validateFields()) {
      return
    }

    if (!captchaToken || loading) {
      setError('Completá la verificación de seguridad para continuar.')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/public/customer-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug,
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          password: formData.password,
          captchaToken,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        const mensaje = result.error || 'No pudimos crear tu cuenta. Intentá de nuevo.'
        // El servidor dice qué campo falló: el aviso va al lado del dato.
        const campo = result.field as keyof typeof formData | null | undefined
        if (campo && campo in formData) {
          setFieldErrors((current) => ({ ...current, [campo]: mensaje }))
        }
        setError(mensaje)
        // Ese correo ya tiene cuenta: el camino es ingresar, no registrarse.
        setEmailYaRegistrado(result.code === 'email_already_registered')
        return
      }

      toast.success(
        result.data?.requiresEmailConfirmation
          ? `Cuenta creada. Te mandamos un correo a ${formData.email.trim()} para confirmarla.`
          : 'Listo, tu cuenta ya está creada.'
      )
      router.push(`/${organizationSlug}/cliente/login`)
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Comprobá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  const passwordChecks = getPasswordChecks(formData.password)

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <Link href={`/${organizationSlug}/inicio`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta de cliente</CardTitle>
          <CardDescription>
            Con tu cuenta seguís tus reparaciones y tus pedidos en esta tienda. Es gratis y toma un minuto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                required
                disabled={loading}
                maxLength={160}
                autoComplete="name"
                placeholder="Ej: María González"
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
              />
              {fieldErrors.fullName && <FieldError id="fullName-error">{fieldErrors.fullName}</FieldError>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={formData.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
                disabled={loading}
                maxLength={254}
                autoComplete="email"
                placeholder="nombre@correo.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && <FieldError id="email-error">{fieldErrors.email}</FieldError>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={formData.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                disabled={loading}
                maxLength={50}
                autoComplete="tel"
                placeholder="0981 123 456"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'phone-error' : 'phone-hint'}
              />
              {fieldErrors.phone ? (
                <FieldError id="phone-error">{fieldErrors.phone}</FieldError>
              ) : (
                <p id="phone-hint" className="text-xs text-muted-foreground">
                  Lo usamos para avisarte cuando tu reparación o tu pedido estén listos.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : 'password-requisitos'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Repetir la contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
              />
              {fieldErrors.confirmPassword && (
                <FieldError id="confirmPassword-error">{fieldErrors.confirmPassword}</FieldError>
              )}
            </div>
            <div id="password-requisitos" className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-semibold">La contraseña necesita</p>
              <ul className="space-y-1 text-xs">
                {passwordChecks.map((item) => (
                  <li key={item.label} className={item.ok ? 'text-emerald-600' : 'text-muted-foreground'}>{item.label}</li>
                ))}
              </ul>
            </div>
            {error && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <p className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </p>
                {emailYaRegistrado && (
                  <Link
                    href={`/${organizationSlug}/cliente/login`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-2.5 py-1.5 text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Iniciar sesión con ese correo
                  </Link>
                )}
              </div>
            )}
            <TurnstileChallenge
              action="tenant_customer_register"
              onTokenChange={setCaptchaToken}
              resetKey={captchaResetKey}
              disabled={loading}
            />
            <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Crear cuenta
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{' '}
              <Link href={`/${organizationSlug}/cliente/login`} className="font-semibold text-primary hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
