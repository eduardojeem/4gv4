'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, LayoutDashboard, Link2, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function TenantCustomerLoginPage() {
  const params = useParams<{ organizationSlug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const organizationSlug = params.organizationSlug
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [canLinkCustomer, setCanLinkCustomer] = useState(false)
  const [isStaffMember, setIsStaffMember] = useState(false)
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const nextHref = useMemo(() => {
    const requestedNext = searchParams.get('next')
    const tenantRoot = `/${organizationSlug}/`

    if (requestedNext?.startsWith(tenantRoot)) {
      return requestedNext
    }

    return `/${organizationSlug}/mis-reparaciones`
  }, [organizationSlug, searchParams])

  async function validateCustomerScope({ redirectIfValid = true } = {}) {
    const scopeResponse = await fetch(`/api/public/customer-scope?slug=${encodeURIComponent(organizationSlug)}`, {
      cache: 'no-store',
    })
    const scopeResult = await scopeResponse.json()

    if (scopeResult.success) {
      if (redirectIfValid) {
        toast.success('Bienvenido')
        router.push(nextHref)
        router.refresh()
      }
      return true
    }

    if ((scopeResult.code === 'not_customer' || scopeResult.code === 'customer_profile_missing') && scopeResult.canLink) {
      setCanLinkCustomer(true)
      setIsStaffMember(false)
      setError(scopeResult.code === 'customer_profile_missing'
        ? 'Tu acceso de cliente existe. Solo falta completar el perfil de cliente de esta empresa.'
        : 'Encontramos tu cuenta. Solo falta vincularla como cliente de esta empresa para que puedas ver tus reparaciones.'
      )
      return false
    }

    if (scopeResult.code === 'staff_member') {
      setCanLinkCustomer(false)
      setIsStaffMember(true)
      setError('Esta cuenta pertenece al equipo de esta empresa. Tambien podes continuar como cliente para comprar productos o consultar tus reparaciones personales, sin perder tu acceso interno.')
      return false
    }

    setCanLinkCustomer(false)
    setIsStaffMember(false)
    setError(
      scopeResponse.status === 401
        ? 'La sesion expiro. Inicia sesion nuevamente.'
        : scopeResult.error || 'Esta cuenta no esta registrada como cliente de esta empresa.'
    )
    return false
  }

  useEffect(() => {
    let active = true

    async function checkExistingSession() {
      try {
        const { data } = await supabase.auth.getUser()

        if (!active) return

        if (!data.user) {
          setCheckingSession(false)
          return
        }

        await validateCustomerScope()
      } catch {
        if (active) {
          setError('No se pudo validar la sesion actual.')
        }
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }

    checkExistingSession()

    return () => {
      active = false
    }
  }, [supabase, organizationSlug, nextHref])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setCanLinkCustomer(false)
    setIsStaffMember(false)

    try {
      setLoading(true)
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        setError('Credenciales incorrectas o cuenta no confirmada.')
        return
      }

      await validateCustomerScope()
    } catch {
      setError('Error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLinkCustomer() {
    setError('')
    setLinking(true)

    try {
      const response = await fetch('/api/public/customer-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        if (result.code === 'tenant_customer_index_required') {
          setCanLinkCustomer(false)
          setIsStaffMember(false)
        }
        setError(result.error || 'No se pudo vincular tu cuenta como cliente.')
        setErrorDetail(result.detail || '')
        return
      }

      toast.success('Modo cliente activado')
      router.push(nextHref)
      router.refresh()
    } catch {
      setError('Error inesperado. Intenta de nuevo.')
      setErrorDetail('')
    } finally {
      setLinking(false)
    }
  }

  async function handleUseAnotherAccount() {
    await supabase.auth.signOut()
    setCanLinkCustomer(false)
    setIsStaffMember(false)
    setError('')
    setErrorDetail('')
    setEmail('')
    setPassword('')
    setCheckingSession(false)
    toast.info('Sesion cerrada. Ingresa con la cuenta cliente.')
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <Link href={`/${organizationSlug}/inicio`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Login de cliente</CardTitle>
          <CardDescription>
            Accede solo como cliente de esta empresa para ver tus reparaciones y pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando si esta cuenta es cliente de la empresa...
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
            {error && (
              <div
                className={
                  canLinkCustomer || isStaffMember
                    ? 'space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground'
                    : 'space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
                }
              >
                {canLinkCustomer || isStaffMember ? (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {isStaffMember ? <LayoutDashboard className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold">{isStaffMember ? 'Cuenta del equipo' : 'Cuenta encontrada'}</p>
                      <p className="text-muted-foreground">{error}</p>
                      {errorDetail && (
                        <p className="rounded-md bg-background/70 p-2 font-mono text-[11px] text-muted-foreground">
                          {errorDetail}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{error}</p>
                    {errorDetail && (
                      <p className="rounded-md bg-background/70 p-2 font-mono text-[11px] text-muted-foreground">
                        {errorDetail}
                      </p>
                    )}
                  </>
                )}
                {canLinkCustomer && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={linking}
                      onClick={handleLinkCustomer}
                    >
                      {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                      Vincularme
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={linking}
                      onClick={handleUseAnotherAccount}
                    >
                      Usar otra cuenta
                    </Button>
                  </div>
                )}
                {isStaffMember && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={linking}
                      onClick={handleLinkCustomer}
                    >
                      {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                      Continuar como cliente
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full"
                    >
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Ir al panel
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!canLinkCustomer && !isStaffMember && error && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={handleUseAnotherAccount}
              >
                Usar otra cuenta
              </Button>
            )}
            <Button type="submit" className="w-full" disabled={loading || checkingSession}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Iniciar sesion
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No tenes cuenta?{' '}
              <Link href={`/${organizationSlug}/cliente/registro`} className="font-semibold text-primary hover:underline">
                Registrate como cliente
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
