'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { persistSharedDraft, SharedDraftSaveError } from '@/lib/onboarding/submit-shared-draft'
import { normalizeOnboardingState, filterOnboardingPreferences, visibleEntitledModules } from '@/lib/onboarding/shared-setup'
import { BUSINESS_VERTICALS, moduleDependencyProblems } from '@/lib/organization/business-profile'
import { getSupportedRegionalCountries, REGIONAL_CURRENCIES } from '@/lib/regional/contract'
import { BUSINESS_VERTICAL_LABELS } from '@/lib/organization/business-labels'
import {
  ONBOARDING_MODULE_PREFERENCES,
  suggestOnboardingPreferences,
  getRegionalSelection,
  validateBusinessStep,
  validateBranchStep,
  type SharedOnboardingState,
} from '@/lib/onboarding/shared-setup'

const CATEGORY_LABELS: Record<string, string> = BUSINESS_VERTICAL_LABELS
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu']
const STEP_NAMES = ['Plan', 'Negocio', 'Sucursal', 'Herramientas', 'Revisar']

export function SharedOnboardingWizard({
  organizationId,
  initialState,
  initialRevision,
  planName,
  entitledModules,
}: {
  organizationId?: string
  initialState: SharedOnboardingState
  initialRevision: number
  planName: string
  entitledModules: string[]
}) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [revision, setRevision] = useState(initialRevision)
  const [selectedModules, setSelectedModules] = useState<string[]>(() => initialState.data.selectedModules ?? suggestOnboardingPreferences(initialState.data.businessCategory, entitledModules))
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const draftLoaded = useRef(false)
  const [draftReady,setDraftReady] = useState(false)
  const [saveError,setSaveError] = useState<string | null>(null)
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

  useEffect(()=>{
    if(!organizationId||draftLoaded.current)return
    draftLoaded.current=true
    try{const raw=localStorage.getItem('onboarding:shared-draft:'+organizationId);if(raw){const draft=JSON.parse(raw);if(Date.now()-Number(draft.savedAt)<7*86400000){setState(normalizeOnboardingState(draft.state));setSelectedModules(Array.isArray(draft.selectedModules)?draft.selectedModules:[]);if(Number.isSafeInteger(draft.revision)&&draft.revision>=0)setRevision(draft.revision)}}}catch{}
    setDraftReady(true)
  },[organizationId])
  useEffect(()=>{
    if(!organizationId||!draftReady)return
    try{const key='onboarding:shared-draft:'+organizationId;if(state.completed)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({state,selectedModules,revision,savedAt:Date.now()}))}catch{}
  },[organizationId,state,selectedModules,revision,draftReady])
  const moduleProblem = filterOnboardingPreferences(selectedModules,entitledModules).length !== selectedModules.length ? 'Revisá las herramientas incluidas en tu plan.' : moduleDependencyProblems(visibleEntitledModules(selectedModules,entitledModules))[0] ?? null
  const saveStep = () => {
    if(saveLock.current)return
    if(step===4&&moduleProblem){setSaveError(moduleProblem);return}
    const validation=step===2?validateBusinessStep(state.data):step===3?validateBranchStep(state.data.primaryBranch):{valid:true,fields:[]}
    if(!validation.valid){setErrors(validation.fields);setSaveError('Completá los datos marcados antes de seguir.');return}
    setErrors([]);setSaveError(null)
    const key=step===2?'business':step===3?'branch':'modules'
    setState(current=>({...current,currentStep:Math.min(5,step+1) as SharedOnboardingState['currentStep'],completedSteps:[...new Set([...current.completedSteps,key])] as SharedOnboardingState['completedSteps'],data:{...current.data,selectedModules}}))
  }

  const finish = async (destination: '/dashboard' | '/dashboard/products/new' | '/dashboard/pos' = '/dashboard') => {
    if(saveLock.current)return
    if(moduleProblem){setSaveError(moduleProblem);setState(current=>({...current,currentStep:4}));return}
    const business=validateBusinessStep(state.data), branch=validateBranchStep(state.data.primaryBranch)
    if(!business.valid||!branch.valid){setErrors([...business.fields,...branch.fields]);setSaveError('Revisá los datos obligatorios antes de finalizar.');setState(current=>({...current,currentStep:!business.valid?2:3}));return}
    saveLock.current=true
    setSaving(true);setSaveError(null)
    try {
      const savedRevision=await persistSharedDraft(state,selectedModules,revision,setRevision)
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedSetup: true,
          expectedRevision: savedRevision,
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
      if (!response.ok) {
        if (response.status === 409 && result?.code === 'ONBOARDING_REVISION_CONFLICT') {
          const latestResponse = await fetch('/api/onboarding/status', { cache: 'no-store' })
          const latest = await latestResponse.json().catch(() => null)
          if (latestResponse.ok && latest?.setupState) {
            setSaveError('La configuración cambió en otro dispositivo. Conservamos tu borrador; revisá el resumen y volvé a confirmar.')
            setRevision(Number(latest.onboardingRevision ?? result.revision ?? revision))
            toast.info('Tu configuración fue actualizada desde otro dispositivo. Recargamos los datos más recientes; revisalos antes de finalizar.')
            return
          }
        }
        throw new Error(result?.error || 'No se pudo finalizar la configuración.')
      }
      if (Number.isSafeInteger(result?.revision)) setRevision(result.revision)
      setState((current) => ({ ...current, completed: true, currentStep: 5, completedAt: result.completedAt ?? new Date().toISOString() }))
      if (destination !== '/dashboard') router.push(destination)
      else toast.success('Configuración guardada.');
    } catch (error) {
      if(error instanceof SharedDraftSaveError && error.status===409){
        const latestResponse=await fetch('/api/onboarding/status',{cache:'no-store'}).catch(()=>null)
        const latest=await latestResponse?.json().catch(()=>null)
        if(latestResponse?.ok&&Number.isSafeInteger(latest?.onboardingRevision))setRevision(latest.onboardingRevision)
      }
      const message=error instanceof Error ? error.message : 'No se pudo finalizar la configuración.'
      setSaveError(message);toast.error(message)
    } finally {
      saveLock.current=false
      setSaving(false)
    }
  }

  const fieldError = (name: string) => errors.includes(name) ? 'Completá este dato para continuar.' : undefined

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-sm font-semibold text-primary">Configuración inicial · Plan {planName}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Dejá tu negocio listo para trabajar</h1>
        <p className="mt-2 text-muted-foreground">Avanzá con Siguiente y revisá el resumen. La configuración se aplica cuando confirmás el último paso.</p>
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

      {saveError&&<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{saveError}</p>}
      <p className="text-sm text-muted-foreground">El avance se conserva como borrador en este dispositivo. Guardá al finalizar todos los pasos.</p>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        {state.completed ? <div className="space-y-6">
          <div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-3 text-2xl font-bold">Configuración guardada</h2><p className="mt-1 text-muted-foreground">La configuración se guardó y ya podés continuar desde cualquier dispositivo.</p></div>
          <Summary state={state} planName={planName} />
          <div className="grid gap-3 sm:grid-cols-3"><Button onClick={() => router.push('/dashboard/products/new')}>Agregar primer producto</Button><Button variant="outline" onClick={() => router.push('/dashboard/pos')}>Hacer primera venta</Button><Button variant="outline" onClick={() => router.push('/dashboard')}>Ir al panel</Button></div>
        </div> : <>
          {step === 1 ? <div><h2 className="text-xl font-bold">Elegí tu plan</h2><p className="mt-2 text-muted-foreground">El plan {planName} quedó seleccionado al crear tu cuenta.</p></div> : null}
          {step === 2 ? <div className="space-y-5"><div><h2 className="text-xl font-bold">Contanos sobre tu negocio</h2><p className="mt-1 text-sm text-muted-foreground">Estos datos definen la moneda, el idioma y el horario de tu organización.</p></div>
            <Field label="Nombre del negocio" value={state.data.businessName} onChange={(value) => setBusiness({ businessName: value })} error={fieldError('businessName')} />
            <div className="space-y-2"><Label htmlFor="setup-country">País</Label><select id="setup-country" className="h-10 w-full rounded-md border bg-background px-3" value={state.data.countryCode ?? ''} onChange={(event) => { const value = event.target.value; const regional = value ? getRegionalSelection(value) : null; setBusiness({ countryCode: value || null, currency: regional?.baseCurrency ?? null, timezone: regional?.timezone ?? null, locale: regional?.locale ?? null, regionalConfirmed: false }) }}><option value="">Seleccioná un país</option>{getSupportedRegionalCountries().map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select>{fieldError('countryCode') ? <p className="text-xs text-destructive">{fieldError('countryCode')}</p> : null}</div>
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
            <Button type="button" variant="outline" disabled={saving} onClick={()=>setSelectedModules(suggestOnboardingPreferences(state.data.businessCategory,entitledModules))}>Usar recomendaciones del rubro</Button><div className="grid gap-3 sm:grid-cols-2">{ONBOARDING_MODULE_PREFERENCES.map((preference) => { const entitled = !preference.entitlement || entitledModules.includes(preference.entitlement); const checked = selectedModules.includes(preference.key); const recommended = recommendedPreferences.has(preference.key); return <label key={preference.key} className={`flex items-center gap-3 rounded-xl border p-4 ${entitled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}><input type="checkbox" checked={checked} disabled={!entitled && !checked} onChange={() => setSelectedModules((current) => checked ? current.filter((item) => item !== preference.key) : [...current, preference.key])} /><span className="font-medium">{preference.label}</span>{recommended ? <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Recomendado</span> : !preference.entitlement ? <span className="ml-auto text-xs text-muted-foreground">Preferencia</span> : !entitled ? <span className="ml-auto text-xs text-muted-foreground">No incluido</span> : null}</label> })}</div>
          </div> : null}
          {step === 5 ? <div className="space-y-5"><div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-3 text-2xl font-bold">Revisá antes de guardar</h2><p className="mt-1 text-muted-foreground">Estos cambios todavía son un borrador. Al finalizar se aplica la configuración y se habilita el panel.</p></div><Summary state={{ ...state, data: { ...state.data, selectedModules } }} planName={planName} /></div> : null}

          <div className="mt-8 flex justify-between gap-3 border-t pt-5">{step > 2 ? <Button type="button" variant="outline" disabled={saving} onClick={() => setState((current) => ({ ...current, currentStep: (step - 1) as SharedOnboardingState['currentStep'] }))}><ArrowLeft className="mr-2 h-4 w-4" />Atrás</Button> : <span />}{step < 5 ? <Button type="button" disabled={saving} onClick={() => void saveStep()}> {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Siguiente<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button type="button" disabled={saving} onClick={() => void finish()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Finalizar y guardar</Button>}</div>
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
