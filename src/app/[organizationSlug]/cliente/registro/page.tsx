'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPasswordChecks, validatePassword } from '@/lib/auth/password-validation'

export default function TenantCustomerRegisterPage() {
  const params = useParams<{ organizationSlug: string }>()
  const router = useRouter()
  const organizationSlug = params.organizationSlug
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/public/customer-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'No se pudo crear tu cuenta.')
        return
      }

      toast.success(
        result.data?.requiresEmailConfirmation
          ? 'Cuenta creada. Revisa tu correo para confirmar el acceso.'
          : 'Cuenta creada correctamente.'
      )
      router.push(`/${organizationSlug}/cliente/login`)
      router.refresh()
    } catch {
      setError('Error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
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
            Registrate solo como cliente de esta empresa para consultar tus reparaciones y pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" value={formData.fullName} onChange={(event) => updateField('fullName', event.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input id="email" type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
              <Input id="confirmPassword" type="password" value={formData.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} required disabled={loading} />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-semibold">Requisitos de contrasena</p>
              <ul className="space-y-1 text-xs">
                {passwordChecks.map((item) => (
                  <li key={item.label} className={item.ok ? 'text-emerald-600' : 'text-muted-foreground'}>{item.label}</li>
                ))}
              </ul>
            </div>
            {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Crear cuenta
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Ya tenes cuenta?{' '}
              <Link href={`/${organizationSlug}/cliente/login`} className="font-semibold text-primary hover:underline">
                Iniciar sesion
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
