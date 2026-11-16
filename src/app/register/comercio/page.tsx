'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { BUSINESS_VERTICAL_LABELS } from '@/lib/organization/business-labels'
import { formatCurrency } from '@/lib/currency'

type PlanOption = { tier: string; slug: string; name: string; price: number; priceNote: string; trialDays: number }
type FieldErrors = Partial<Record<'companyName' | 'companySlug' | 'plan' | 'businessVertical', string>>

/**
 * Abrir un comercio con la cuenta ya iniciada: después de «Registrarme con
 * Google» en /register, o un cliente que ahora quiere vender. Solo pide los
 * datos del comercio; la cuenta sale de la sesión (POST /api/auth/create-company).
 */
function CreateCompanyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan')?.toLowerCase().trim() ?? ''
  const [email, setEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [plans, setPlans] = useState<PlanOption[] | null>(null)
  const [plan, setPlan] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [businessVertical, setBusinessVertical] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [slugTaken, setSlugTaken] = useState<string | null>(null)

  // Sin sesión no hay a quién darle el comercio: al login, y vuelve acá.
  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        const back = `/register/comercio${planParam ? `?plan=${encodeURIComponent(planParam)}` : ''}`
        router.replace(`/login?redirect=${encodeURIComponent(back)}`)
        return
      }
      setEmail(data.user.email ?? null)
      setChecking(false)
    })
  }, [planParam, router])

  useEffect(() => {
    let cancelled = false
    void createClient()
      .from('subscription_plans')
      .select('tier, public_slug, name, price, price_note, trial_days')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const list = (data ?? []).map((row) => ({
          tier: String(row.tier),
          slug: String(row.public_slug || row.tier),
          name: String(row.name),
          price: Number(row.price) || 0,
          priceNote: row.price_note ? String(row.price_note) : '',
          trialDays: Number(row.trial_days) || 0,
        }))
        setPlans(list)
        // El slug público manda y el tier es respaldo, igual que en /register.
        const match = list.find((item) => item.slug === planParam) ?? list.find((item) => item.tier === planParam)
        setPlan(match ? match.slug : list.length === 1 ? list[0].slug : '')
      })
    return () => {
      cancelled = true
    }
  }, [planParam])

  const slug = useMemo(() => slugifyTenantName(companySlug || companyName), [companySlug, companyName])

  useEffect(() => {
    if (slug.length < 3) return
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/auth/check-slug?slug=${encodeURIComponent(slug)}`)
        .then((response) => response.json())
        .then((result: { available?: boolean; message?: string }) => {
          if (!cancelled) setSlugTaken(result.available === false ? result.message || 'Esa dirección ya está en uso.' : null)
        })
        .catch(() => undefined)
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [slug])

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (companyName.trim().length < 2) next.companyName = 'Escribí el nombre de tu comercio.'
    if (slug.length < 3) next.companySlug = 'La dirección necesita al menos 3 letras o números.'
    else if (slugTaken) next.companySlug = slugTaken
    if (!plan) next.plan = 'Elegí un plan para continuar.'
    return next
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    const found = validate()
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      const response = await fetch('/api/auth/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim(), companySlug: slug, plan, ...(businessVertical ? { businessVertical } : {}) }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string; code?: string; fieldErrors?: { field?: string; message?: string }[] }
      if (!response.ok) {
        const fields = Object.fromEntries((result.fieldErrors ?? []).filter((item) => item.field && item.message).map((item) => [item.field, item.message])) as FieldErrors
        setErrors(fields)
        if (result.code === 'ALREADY_HAS_COMPANY') {
          toast.info(result.error ?? 'Tu cuenta ya tiene un comercio.')
          router.push('/dashboard')
          return
        }
        setFormError(result.error ?? 'No se pudo crear tu comercio. Intentá de nuevo.')
        return
      }
      // La sesión se renueva para que el panel ya la vea como dueña del comercio.
      await createClient().auth.refreshSession().catch(() => undefined)
      await fetch('/api/organizations', { cache: 'no-store' }).catch(() => undefined)
      toast.success('¡Tu comercio quedó creado!')
      router.push('/admin/onboarding')
      router.refresh()
    } catch {
      setFormError('No se pudo crear tu comercio. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />Revisando tu sesión...
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary"><Store className="h-5 w-5" /></span>
            <div>
              <CardTitle>Crear mi comercio</CardTitle>
              <CardDescription>Tu cuenta ya está lista. Faltan los datos de tu negocio.</CardDescription>
            </div>
          </div>
          {email ? <p className="pt-2 text-xs text-muted-foreground">Vas a ser el dueño del comercio con la cuenta <strong>{email}</strong>.</p> : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Nombre del comercio</Label>
              <Input id="companyName" value={companyName} maxLength={120} placeholder="Ej. Comercial San Miguel" onChange={(event) => setCompanyName(event.target.value)} aria-invalid={Boolean(errors.companyName)} />
              {errors.companyName ? <p role="alert" className="text-xs text-destructive">{errors.companyName}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companySlug">Dirección de tu tienda</Label>
              <Input id="companySlug" value={companySlug || slug} maxLength={48} placeholder="comercial-san-miguel" autoCapitalize="none" onChange={(event) => setCompanySlug(event.target.value)} aria-invalid={Boolean(errors.companySlug || slugTaken)} />
              <p className={`text-xs ${errors.companySlug || slugTaken ? 'text-destructive' : 'text-muted-foreground'}`}>
                {errors.companySlug || slugTaken || (slug.length >= 3 ? `Tu tienda va a estar en …/${slug}` : 'Sale del nombre; podés cambiarla.')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="businessVertical">Rubro (opcional)</Label>
              <select id="businessVertical" value={businessVertical} onChange={(event) => setBusinessVertical(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Elegilo después</option>
                {Object.entries(BUSINESS_VERTICAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Plan</legend>
              {plans === null ? <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Cargando planes...</p> : null}
              {plans?.length === 0 ? <p className="text-xs text-muted-foreground">No hay planes disponibles en este momento. Escribinos y te ayudamos.</p> : null}
              {plans?.map((item) => (
                <label key={item.slug} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${plan === item.slug ? 'border-primary bg-primary/5' : ''}`}>
                  <input type="radio" name="plan" value={item.slug} checked={plan === item.slug} onChange={() => setPlan(item.slug)} />
                  <span className="flex-1">
                    <span className="block font-semibold">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.price > 0 ? `${formatCurrency(item.price)}${item.priceNote ? ` ${item.priceNote}` : ''}` : 'Gratis'}
                      {item.trialDays > 0 ? ` · ${item.trialDays} días de prueba` : ''}
                    </span>
                  </span>
                </label>
              ))}
              {errors.plan ? <p role="alert" className="text-xs text-destructive">{errors.plan}</p> : null}
            </fieldset>
            {formError ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}
            <Button type="submit" className="h-11 w-full" disabled={saving || !plans?.length}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando tu comercio...</> : <>Crear mi comercio<ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              ¿Solo querías comprar? <Link href="/marketplace" className="font-semibold text-primary hover:underline">Seguir al marketplace</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CreateCompanyPage() {
  return (
    <Suspense fallback={null}>
      <CreateCompanyForm />
    </Suspense>
  )
}
