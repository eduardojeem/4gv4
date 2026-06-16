'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgePercent, Building2, CalendarClock, CheckCircle2, Copy, Loader2, Plus, Power, Sparkles, TicketPercent } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type PromoCode = {
  id: string
  code: string
  name: string
  description: string | null
  benefit_type: string
  discount_percent: number | null
  discount_amount: number | null
  target_plan: string | null
  duration_days: number | null
  duration_unit: string | null
  max_redemptions: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  redemption_count: number
}

type Organization = { id: string; name: string; slug: string; plan: string }
type Plan = { tier: string; name: string }

const benefitLabels: Record<string, string> = {
  discount_percent: 'Descuento porcentual',
  discount_fixed: 'Descuento fijo',
  activate_plan: 'Activación de plan',
  extend_trial: 'Extensión de prueba',
  extend_period: 'Extensión de suscripción',
}

type Redemption = {
  id: string
  promo_code_id: string
  organization_id: string
  organization_name: string
  redeemed_at: string
}

function codeStatus(code: PromoCode): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const now = Date.now()
  if (!code.is_active) return { label: 'Inactivo', variant: 'secondary' }
  if (code.expires_at && new Date(code.expires_at).getTime() < now) return { label: 'Vencido', variant: 'destructive' }
  if (code.max_redemptions && code.redemption_count >= code.max_redemptions) return { label: 'Agotado', variant: 'destructive' }
  if (code.starts_at && new Date(code.starts_at).getTime() > now) return { label: 'Programado', variant: 'outline' }
  return { label: 'Vigente', variant: 'default' }
}

function benefitSummary(code: PromoCode) {
  if (code.benefit_type === 'discount_percent') return `${code.discount_percent}% de descuento`
  if (code.benefit_type === 'discount_fixed') return `${Number(code.discount_amount).toLocaleString('es-PY')} de descuento`
  const unit = code.duration_unit === 'months' ? 'mes(es)' : 'días'
  if (code.benefit_type === 'activate_plan') return `${code.target_plan} por ${code.duration_days} ${unit}`
  return `${code.duration_days} ${unit} adicionales`
}

export function PromoCodesDashboard() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [detailCode, setDetailCode] = useState<PromoCode | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [applyCode, setApplyCode] = useState<PromoCode | null>(null)
  const [organizationId, setOrganizationId] = useState('')
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    benefitType: 'discount_percent',
    discountPercent: '',
    discountAmount: '',
    targetPlan: '',
    durationDays: '',
    durationUnit: 'days',
    maxRedemptions: '',
    expiresAt: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/superadmin/promo-codes')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setCodes(data.codes)
      setRedemptions(data.redemptions ?? [])
      setOrganizations(data.organizations)
      setPlans(data.plans)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las promociones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const stats = useMemo(() => ({
    active: codes.filter(code => code.is_active).length,
    redemptions: codes.reduce((sum, code) => sum + code.redemption_count, 0),
    expiring: codes.filter(code => code.expires_at && new Date(code.expires_at) > new Date() && new Date(code.expires_at).getTime() < Date.now() + 7 * 86_400_000).length,
  }), [codes])

  async function createCode() {
    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discountPercent: form.discountPercent || null,
          discountAmount: form.discountAmount || null,
          targetPlan: form.targetPlan || null,
          durationDays: form.durationDays || null,
          maxRedemptions: form.maxRedemptions || null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      toast.success('Código promocional creado.')
      setCreateOpen(false)
      setForm({ code: '', name: '', description: '', benefitType: 'discount_percent', discountPercent: '', discountAmount: '', targetPlan: '', durationDays: '', durationUnit: 'days', maxRedemptions: '', expiresAt: '' })
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el código.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleCode(code: PromoCode) {
    const response = await fetch(`/api/superadmin/promo-codes/${code.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !code.is_active }),
    })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error)
    setCodes(current => current.map(item => item.id === code.id ? { ...item, is_active: data.code.is_active } : item))
    toast.success(data.code.is_active ? 'Código activado.' : 'Código desactivado.')
  }

  async function applyPromotion() {
    if (!applyCode || !organizationId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/promo-codes/${applyCode.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      toast.success(data.requiresBillingAction ? 'Descuento registrado para facturación.' : 'Promoción aplicada a la suscripción.')
      setApplyCode(null)
      setOrganizationId('')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar la promoción.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge className="border-white/15 bg-white/10 text-indigo-100 hover:bg-white/10"><Sparkles className="mr-1 h-3 w-3" />Facturación SaaS</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Códigos promocionales</h1>
            <p className="text-sm leading-6 text-slate-300">Crea descuentos, activa planes o extiende períodos de organizaciones con trazabilidad por redención.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-white text-slate-950 hover:bg-indigo-50"><Plus className="mr-2 h-4 w-4" />Nueva promoción</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Promociones activas', value: stats.active, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Redenciones totales', value: stats.redemptions, icon: Building2, color: 'text-indigo-600' },
          { label: 'Vencen en 7 días', value: stats.expiring, icon: CalendarClock, color: 'text-amber-600' },
        ].map(stat => <Card key={stat.label} className="rounded-2xl"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p><p className="mt-1 text-3xl font-bold">{stat.value}</p></div><stat.icon className={`h-7 w-7 ${stat.color}`} /></CardContent></Card>)}
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>
      ) : codes.length === 0 ? (
        <Card className="rounded-2xl border-dashed"><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><TicketPercent className="h-10 w-10 text-slate-400" /><h2 className="font-semibold">Todavía no hay promociones</h2><p className="max-w-md text-sm text-muted-foreground">Crea el primer código para descuentos o activaciones controladas.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {codes.map(code => (
            <Card key={code.id} className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg">{code.name}</CardTitle><Badge variant={codeStatus(code).variant}>{codeStatus(code).label}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{code.description || benefitLabels[code.benefit_type]}</p></div>
                  <Switch checked={code.is_active} onCheckedChange={() => void toggleCode(code)} aria-label={`Cambiar estado de ${code.code}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <button onClick={() => void navigator.clipboard.writeText(code.code).then(() => toast.success('Código copiado.'))} className="flex w-full items-center justify-between rounded-xl border bg-muted/40 px-4 py-3 text-left"><span className="font-mono text-lg font-bold tracking-wider">{code.code}</span><Copy className="h-4 w-4 text-muted-foreground" /></button>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-muted-foreground">Beneficio</p><p className="mt-1 font-semibold">{benefitSummary(code)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-muted-foreground">Usos</p><p className="mt-1 font-semibold">{code.redemption_count} / {code.max_redemptions ?? 'Sin límite'}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-muted-foreground">Vence</p><p className="mt-1 font-semibold">{code.expires_at ? new Date(code.expires_at).toLocaleDateString('es-PY') : 'Sin vencimiento'}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-muted-foreground">Creado</p><p className="mt-1 font-semibold">{new Date(code.created_at).toLocaleDateString('es-PY')}</p></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDetailCode(code)} className="flex-1"><Building2 className="mr-2 h-4 w-4" />Ver usos ({code.redemption_count})</Button>
                  <Button disabled={codeStatus(code).label !== 'Vigente'} onClick={() => setApplyCode(code)} className="flex-1"><BadgePercent className="mr-2 h-4 w-4" />Aplicar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Nueva promoción</DialogTitle><DialogDescription>Configura un beneficio de uso único por organización.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label>Código</Label><Input value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="BIENVENIDA-2026" /></div>
            <div className="space-y-2"><Label>Nombre interno</Label><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Descripción</Label><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Tipo de beneficio</Label><Select value={form.benefitType} onValueChange={value => setForm({ ...form, benefitType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(benefitLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            {form.benefitType === 'discount_percent' && <div className="space-y-2"><Label>Porcentaje</Label><Input type="number" min="1" max="100" value={form.discountPercent} onChange={event => setForm({ ...form, discountPercent: event.target.value })} /></div>}
            {form.benefitType === 'discount_fixed' && <div className="space-y-2"><Label>Monto</Label><Input type="number" min="1" value={form.discountAmount} onChange={event => setForm({ ...form, discountAmount: event.target.value })} /></div>}
            {form.benefitType === 'activate_plan' && <div className="space-y-2"><Label>Plan de destino</Label><Select value={form.targetPlan} onValueChange={value => setForm({ ...form, targetPlan: value })}><SelectTrigger><SelectValue placeholder="Seleccionar plan" /></SelectTrigger><SelectContent>{plans.map(plan => <SelectItem key={plan.tier} value={plan.tier}>{plan.name}</SelectItem>)}</SelectContent></Select></div>}
            {['activate_plan', 'extend_trial', 'extend_period'].includes(form.benefitType) && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Duración</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    className="flex-1"
                    placeholder={form.durationUnit === 'months' ? 'cant. de meses' : 'cant. de días'}
                    value={form.durationDays}
                    onChange={event => setForm({ ...form, durationDays: event.target.value })}
                  />
                  <Select value={form.durationUnit} onValueChange={value => setForm({ ...form, durationUnit: value })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Días</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { l: '1 mes', v: '1', u: 'months' },
                    { l: '3 meses', v: '3', u: 'months' },
                    { l: '6 meses', v: '6', u: 'months' },
                    { l: '1 año', v: '12', u: 'months' },
                    { l: '15 días', v: '15', u: 'days' },
                    { l: '30 días', v: '30', u: 'days' },
                  ].map(p => (
                    <Button
                      key={p.l}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setForm({ ...form, durationDays: p.v, durationUnit: p.u })}
                    >
                      {p.l}
                    </Button>
                  ))}
                </div>
                {form.durationUnit === 'months' && (
                  <p className="text-xs text-muted-foreground">El período vence el mismo día del mes (sin desfase por meses de 28/30/31).</p>
                )}
              </div>
            )}
            <div className="space-y-2"><Label>Máximo de usos</Label><Input type="number" min="1" value={form.maxRedemptions} onChange={event => setForm({ ...form, maxRedemptions: event.target.value })} placeholder="Sin límite" /></div>
            <div className="space-y-2"><Label>Fecha de expiración</Label><Input type="datetime-local" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => void createCode()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear código</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(applyCode)} onOpenChange={open => !open && setApplyCode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aplicar {applyCode?.code}</DialogTitle><DialogDescription>{applyCode && benefitSummary(applyCode)}. Esta acción quedará registrada en auditoría.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-3"><Label>Organización</Label><Select value={organizationId} onValueChange={setOrganizationId}><SelectTrigger><SelectValue placeholder="Seleccionar organización" /></SelectTrigger><SelectContent>{organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name} · {org.plan}</SelectItem>)}</SelectContent></Select></div>
          <DialogFooter><Button variant="outline" onClick={() => setApplyCode(null)}>Cancelar</Button><Button onClick={() => void applyPromotion()} disabled={saving || !organizationId}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}Confirmar aplicación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle de usos: qué organizaciones activaron el código y cuándo */}
      <Dialog open={Boolean(detailCode)} onOpenChange={open => !open && setDetailCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usos de {detailCode?.code}</DialogTitle>
            <DialogDescription>Organizaciones que activaron este código y la fecha de canje.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {(() => {
              const rows = redemptions.filter(r => r.promo_code_id === detailCode?.id)
              if (rows.length === 0) {
                return <p className="py-6 text-center text-sm text-muted-foreground">Todavía nadie usó este código.</p>
              }
              return rows.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{r.organization_name}</span>
                  <span className="text-muted-foreground">{new Date(r.redeemed_at).toLocaleString('es-PY')}</span>
                </div>
              ))
            })()}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDetailCode(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
