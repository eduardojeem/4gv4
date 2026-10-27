'use client'

import { useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'
import { REGIONAL_CURRENCIES } from '@/lib/regional/contract'
import {
  ONBOARDING_MODULE_PREFERENCES,
  suggestOnboardingPreferences,
  getRegionalSelection,
  validateBusinessStep,
  validateBranchStep,
  type SharedOnboardingState,
} from '@/lib/onboarding/shared-setup'

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Comercio general', clothing: 'Ropa y calzado', cosmetics: 'Cosmética', electronics: 'Electrónica y celulares',
  food: 'Alimentos', hardware: 'Ferretería', barbershop: 'Barbería', beauty_services: 'Servicios de belleza', other: 'Otro',
}
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu']
const STEP_NAMES = ['Plan', 'Negocio', 'Sucursal', 'Módulos', 'Listo']

export function SharedOnboardingWizard({
  initialState,
  planName,
  entitledModules,
}: {
  initialState: SharedOnboardingState
  planName: string
  entitledModules: string[]
}) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [selectedModules, setSelectedModules] = useState<string[]>(() => initialState.data.selectedModules ?? suggestOnboardingPreferences(initialState.data.businessCategory, entitledModules))
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const step = state.completed ? 5 : Math.max(2, state.currentStep)
  const defaults = useMemo(() => state.data.countryCode ? getRegionalSelection(state.data.countryCode) : null, [state.data.countryCode])
  const recommendedPreferences = useMemo(
    () => new Set(suggestOnboardingPreferences(state.data.businessCategory, entitledModules)),
    [state.data.businessCategory, entitledModules],
  )
  const countryTimezoneNeedsChoice = defaults?.timezoneSelectionRequired === true

  const setBusiness = (patch: Partial<SharedOnboardingState['data']>) => {
    setState((current) => {
      const regionalChanged = (['countryCode', 'currency', 'timezone', 'locale'] as const).some((key) => key in patch && patch[key] !== current.data[key])
      return { ...current, data: { ...current.data, ...patch, ...(regionalChanged && !('regionalConfirmed' in patch) ? { regionalConfirmed: false } : {}) } }
    })
    setErrors([])
  }
  const setBranch = (patch: Partial<SharedOnboardingState['data']['primaryBranch']>) => {
    setState((current) => ({ ...current, data: { ...current.data, primaryBranch: { ...current.data.primaryBranch, ...patch } } }))
    setErrors([])
  }

  const saveStep = async () => {
    let data: Record<string, unknown>
    if (step === 2) {
      const result = validateBusinessStep(state.data)
      if (!result.valid) { setErrors(result.fields); return }
      data = state.data as unknown as Record<string, unknown>
    } else if (step === 3) {
      const result = validateBranchStep(state.data.primaryBranch)
      if (!result.valid) { setErrors(result.fields); return }
      data = state.data.primaryBranch
    } else {
      data = { selectedModules }
    }

    setSaving(true)
    try {
      const response = await fetch('/api/onboarding/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setErrors(Array.isArray(result?.fields) ? result.fields : [])
        throw new Error(result?.error || 'No se pudo guardar el paso.')
      }
      if (result?.setupState) setState(result.setupState)
      else setState((current) => ({ ...current, currentStep: step === 2 ? 3 : step === 3 ? 4 : 5 }))
      if (step === 4) setState((current) => ({ ...current, data: { ...current.data, selectedModules } }))
      setErrors([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el paso.')
    } finally {
      setSaving(false)
    }
  }

  const finish = async (destination: '/dashboard' | '/dashboard/products/new' | '/dashboard/pos' = '/dashboard') => {
    setSaving(true)
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedSetup: true,
          displayName: state.data.businessName,
          currency: state.data.currency,
          timezone: state.data.timezone,
          language: state.data.locale?.split('-')[0] ?? 'es',
          confirmCurrencyChange: true,
          phone: state.data.primaryBranch.phone,
          address: state.data.primaryBranch.address,
          city: state.data.primaryBranch.city,
          weekdays: state.data.primaryBranch.hours,
          saturday: '',
          businessVertical: state.data.businessCategory,
          operatingModel: 'retail',
          storefrontPublic: false,
          confirmPublication: false,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'No se pudo finalizar la configuración.')
      setState((current) => ({ ...current, completed: true, currentStep: 5, completedAt: result.completedAt ?? new Date().toISOString() }))
      if (destination !== '/dashboard') router.push(destination)
      else toast.success('Tu negocio está listo.');
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo finalizar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (name: string) => errors.includes(name) ? 'Completá este dato para continuar.' : undefined

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-sm font-semibold text-primary">Configuración inicial · Plan {planName}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Dejá tu negocio listo para trabajar</h1>
        <p className="mt-2 text-muted-foreground">Guardamos cada paso para que puedas continuar desde la web o desde la app.</p>
      </header>

      <ol aria-label="Pasos de configuración" className="mb-8 grid grid-cols-5 gap-2">
        {STEP_NAMES.map((name, index) => {
          const number = index + 1
          const done = state.completedSteps.includes(['plan', 'business', 'branch', 'modules', 'ready'][index] as SharedOnboardingState['completedSteps'][number]) || (state.completed && number === 5)
          return <li key={name} aria-current={step === number ? 'step' : undefined} className={`rounded-lg border px-2 py-3 text-center text-xs sm:text-sm ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : step === number ? 'border-primary bg-primary/5 font-semibold text-primary' : 'text-muted-foreground'}`}>
            <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full border">{done ? <Check className="h-4 w-4" /> : number}</span>{name}
          </li>
        })}
      </ol>

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        {state.completed ? <div className="space-y-6">
          <div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-3 text-2xl font-bold">Tu negocio está listo</h2><p className="mt-1 text-muted-foreground">La configuración se guardó y ya podés continuar desde cualquier dispositivo.</p></div>
          <Summary state={state} planName={planName} />
          <div className="grid gap-3 sm:grid-cols-3"><Button onClick={() => router.push('/dashboard/products/new')}>Agregar primer producto</Button><Button variant="outline" onClick={() => router.push('/dashboard/pos')}>Hacer primera venta</Button><Button variant="outline" onClick={() => router.push('/dashboard')}>Ir al panel</Button></div>
        </div> : <>
          {step === 1 ? <div><h2 className="text-xl font-bold">Elegí tu plan</h2><p className="mt-2 text-muted-foreground">El plan {planName} quedó seleccionado al crear tu cuenta.</p></div> : null}
          {step === 2 ? <div className="space-y-5"><div><h2 className="text-xl font-bold">Contanos sobre tu negocio</h2><p className="mt-1 text-sm text-muted-foreground">Estos datos definen la moneda, el idioma y el horario de tu organización.</p></div>
            <Field label="Nombre del negocio" value={state.data.businessName} onChange={(value) => setBusiness({ businessName: value })} error={fieldError('businessName')} />
            <div className="space-y-2"><Label htmlFor="setup-country">País</Label><select id="setup-country" className="h-10 w-full rounded-md border bg-background px-3" value={state.data.countryCode ?? ''} onChange={(event) => { const value = event.target.value; const regional = value ? getRegionalSelection(value) : null; setBusiness({ countryCode: value || null, currency: regional?.baseCurrency ?? null, timezone: regional?.timezone ?? null, locale: regional?.locale ?? null, regionalConfirmed: false }) }}><option value="">Seleccioná un país</option><option value="PY">Paraguay</option><option value="BR">Brasil</option><option value="AR">Argentina</option><option value="US">Estados Unidos</option></select>{fieldError('countryCode') ? <p className="text-xs text-destructive">{fieldError('countryCode')}</p> : null}</div>
            <div className="space-y-2"><Label htmlFor="setup-category">Rubro</Label><select id="setup-category" className="h-10 w-full rounded-md border bg-background px-3" value={state.data.businessCategory ?? ''} onChange={(event) => { const category = (event.target.value || null) as SharedOnboardingState['data']['businessCategory']; setBusiness({ businessCategory: category, selectedModules: null }); setSelectedModules(suggestOnboardingPreferences(category, entitledModules)) }}><option value="">Seleccioná un rubro</option>{BUSINESS_VERTICALS.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value] ?? value}</option>)}</select>{fieldError('businessCategory') ? <p className="text-xs text-destructive">{fieldError('businessCategory')}</p> : null}</div>
            <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="setup-currency">Moneda sugerida</Label><select id="setup-currency" className="h-10 w-full rounded-md border bg-background px-3" value={state.data.currency ?? ''} onChange={(event) => setBusiness({ currency: event.target.value || null })}>{REGIONAL_CURRENCIES.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="setup-locale">Idioma sugerido</Label><Input id="setup-locale" value={state.data.locale ?? ''} onChange={(event) => setBusiness({ locale: event.target.value || null })} placeholder="es-PY" /></div><div className="space-y-2"><Label htmlFor="setup-timezone">Zona horaria</Label>{countryTimezoneNeedsChoice ? <select id="setup-timezone" className="h-10 w-full rounded-md border bg-background px-3" value={state.data.timezone ?? ''} onChange={(event) => setBusiness({ timezone: event.target.value || null })}><option value="">Seleccioná una zona</option>{TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select> : <Input id="setup-timezone" value={state.data.timezone ?? ''} onChange={(event) => setBusiness({ timezone: event.target.value || null })} />}</div></div>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={state.data.regionalConfirmed} onChange={(event) => setBusiness({ regionalConfirmed: event.target.checked })} /><span>Confirmo la moneda, el idioma y la zona horaria para este negocio.</span></label>{fieldError('regionalConfirmed') ? <p role="alert" className="text-xs text-destructive">Confirmá los datos regionales para continuar.</p> : null}
            {(fieldError('currency') || fieldError('locale') || fieldError('timezone')) ? <p role="alert" className="text-sm text-destructive">Revisá moneda, idioma y zona horaria.</p> : null}
          </div> : null}
          {step === 3 ? <div className="space-y-5"><div><h2 className="text-xl font-bold">Tu sucursal principal</h2><p className="mt-1 text-sm text-muted-foreground">La sucursal creada al registrarte se actualiza; no se crea otra.</p></div>
            <Field label="Nombre de la sucursal" value={state.data.primaryBranch.name} onChange={(value) => setBranch({ name: value })} error={fieldError('branchName')} />
            <p className="-mt-3 text-sm text-muted-foreground">Este nombre identifica el local o punto de atención. Si tenés un solo local, podés usar el mismo nombre del negocio; si tenés varios, elegí uno que los distinga, por ejemplo “Casa Central”.</p>
            <Field label="Ciudad o localidad" value={state.data.primaryBranch.city} onChange={(value) => setBranch({ city: value })} error={fieldError('city')} />
            <Field label="Dirección (opcional)" value={state.data.primaryBranch.address} onChange={(value) => setBranch({ address: value })} />
            <Field label="Teléfono (opcional)" value={state.data.primaryBranch.phone} onChange={(value) => setBranch({ phone: value })} />
            <div className="space-y-2"><Label htmlFor="setup-hours">Horario de atención (opcional)</Label><Textarea id="setup-hours" value={state.data.primaryBranch.hours} onChange={(event) => setBranch({ hours: event.target.value })} placeholder="Lun a sáb, de 8:00 a 18:00" /></div>
          </div> : null}
          {step === 4 ? <div className="space-y-5"><div><h2 className="text-xl font-bold">¿Qué querés usar?</h2><p className="mt-1 text-sm text-muted-foreground">Marcamos lo más útil para tu rubro según las funciones incluidas en el plan {planName}. Podés cambiar la selección; lo que el plan no incluye seguirá deshabilitado.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">{ONBOARDING_MODULE_PREFERENCES.map((preference) => { const entitled = !preference.entitlement || entitledModules.includes(preference.entitlement); const checked = selectedModules.includes(preference.key); const recommended = recommendedPreferences.has(preference.key); return <label key={preference.key} className={`flex items-center gap-3 rounded-xl border p-4 ${entitled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}><input type="checkbox" checked={checked} disabled={!entitled} onChange={() => setSelectedModules((current) => checked ? current.filter((item) => item !== preference.key) : [...current, preference.key])} /><span className="font-medium">{preference.label}</span>{recommended ? <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Recomendado</span> : !preference.entitlement ? <span className="ml-auto text-xs text-muted-foreground">Preferencia</span> : !entitled ? <span className="ml-auto text-xs text-muted-foreground">No incluido</span> : null}</label> })}</div>
          </div> : null}
          {step === 5 ? <div className="space-y-5"><div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-3 text-2xl font-bold">Tu negocio está listo</h2><p className="mt-1 text-muted-foreground">Revisá el resumen; al continuar se guarda la configuración y se habilita el panel.</p></div><Summary state={{ ...state, data: { ...state.data, selectedModules } }} planName={planName} /></div> : null}

          <div className="mt-8 flex justify-between gap-3 border-t pt-5">{step > 2 ? <Button type="button" variant="outline" disabled={saving} onClick={() => setState((current) => ({ ...current, currentStep: (step - 1) as SharedOnboardingState['currentStep'] }))}><ArrowLeft className="mr-2 h-4 w-4" />Atrás</Button> : <span />}{step < 5 ? <Button type="button" disabled={saving} onClick={() => void saveStep()}> {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar y continuar<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button type="button" disabled={saving} onClick={() => void finish()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Finalizar configuración</Button>}</div>
        </>}
      </section>
    </main>
  )
}

function Field({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const id = useId()
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}</div>
}

function Summary({ state, planName }: { state: SharedOnboardingState; planName: string }) {
  const category = state.data.businessCategory ? CATEGORY_LABELS[state.data.businessCategory] ?? state.data.businessCategory : '—'
  const modules = state.data.selectedModules?.map((key) => ONBOARDING_MODULE_PREFERENCES.find((item) => item.key === key)?.label ?? key) ?? []
  return <dl className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2"><SummaryItem label="Plan" value={planName} /><SummaryItem label="Negocio" value={state.data.businessName} /><SummaryItem label="País y rubro" value={`${state.data.countryCode ?? '—'} · ${category}`} /><SummaryItem label="Moneda" value={state.data.currency ?? '—'} /><SummaryItem label="Sucursal principal" value={`${state.data.primaryBranch.name || '—'} · ${state.data.primaryBranch.city || '—'}`} /><SummaryItem label="Módulos elegidos" value={modules.length ? modules.join(', ') : 'Ninguno por ahora'} /></dl>
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>
}
