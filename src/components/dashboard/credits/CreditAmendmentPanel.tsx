'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import { creditCalendarDate } from '@/lib/credits/calendar'
import { amendmentActionLabels, creditAmendmentSchema, type CreditAmendmentState } from '@/lib/credits/amendment-contract'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'

type Action = 'edit_terms' | 'reschedule' | 'adjust_balance' | 'correct_payment_date'
type Props = { creditId: string; onUpdated?: () => void | Promise<void> }

function HistoryValues({ value, timeZone }: { value: unknown; timeZone: string }) {
  const snapshot = value as Pick<CreditAmendmentState, 'credit' | 'installments' | 'payments'>
  return <div className="max-h-64 space-y-2 overflow-auto rounded-md bg-muted p-3 text-xs">
    <p>Total financiado: <strong>{formatCurrency(snapshot.credit.principal)}</strong></p>
    <p>Interés: {snapshot.credit.interest_rate}% · Cuotas: {snapshot.credit.term_months}</p>
    <p className="font-medium">Plan de cuotas</p>
    {snapshot.installments.map(row => <p key={row.id}>
      Cuota {row.installment_number} · {creditCalendarDate(row.due_date, timeZone)} · {formatCurrency(row.amount)} · Cobrado {formatCurrency(row.amount_paid || 0)}
    </p>)}
    {snapshot.payments.length > 0 && <>
      <p className="font-medium">Cobros registrados</p>
      {snapshot.payments.map(row => <p key={row.id}>{new Date(row.created_at).toLocaleString(undefined,{timeZone})} · {formatCurrency(row.amount)}</p>)}
    </>}
  </div>
}

export function CreditAmendmentPanel({ creditId, onUpdated }: Props) {
  const [state, setState] = useState<CreditAmendmentState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<Action>('reschedule')
  const [reason, setReason] = useState('')
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('0')
  const [count, setCount] = useState('1')
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly')
  const [firstDue, setFirstDue] = useState('')
  const [dates, setDates] = useState<Record<string,string>>({})
  const [installmentId, setInstallmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const mounted = useRef(true)
  const submitting = useRef(false)
  const seq = useRef(0)
  useEffect(() => { mounted.current=true; return () => { mounted.current=false } },[])
  const load = useCallback(async () => {
    const request=++seq.current
    setLoading(true); setError('')
    try {
      const response=await fetch(`/api/credits/amendments?creditId=${encodeURIComponent(creditId)}`,{cache:'no-store'})
      const result=await response.json()
      if (!mounted.current || request!==seq.current) return
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo cargar el crédito.')
      const data=result.data as CreditAmendmentState
      setState(data)
      const base=data.installments.reduce((sum,row)=>sum+Number(row.principal_component),0)
      setPrincipal(String(base>0?base:Number(data.credit.principal)/(1+Number(data.credit.interest_rate)/100)))
      setRate(String(data.credit.interest_rate)); setCount(String(data.installments.length))
      const freq=data.credit.metadata?.frequency
      setFrequency(freq==='weekly'||freq==='biweekly'?freq:'monthly')
      setFirstDue(data.installments[0]?creditCalendarDate(data.installments[0].due_date,data.timeZone)||'':'')
      setDates(Object.fromEntries(data.installments.map(row=>[row.id,creditCalendarDate(row.due_date,data.timeZone)||''])))
      setInstallmentId(''); setPaymentId(''); setPaidAt(''); setReason(''); setAmount('')
    } catch (cause) { if(mounted.current && request===seq.current) { setState(null); setError(cause instanceof Error?cause.message:'No se pudo cargar el crédito.') } }
    finally { if(mounted.current && request===seq.current) setLoading(false) }
  },[creditId])
  useEffect(()=>{ void load() },[load])
  const pending=state?.installments.filter(row=>row.status!=='paid' && Number(row.amount)>Number(row.amount_paid||0))||[]
  const hasPayments=!!state && (state.payments.length>0 || state.installments.some(row=>Number(row.amount_paid)>0 || row.status==='paid'))
  const active=state?.credit.status==='active'||state?.credit.status==='defaulted'
  let preview: ReturnType<typeof buildCreditInstallmentPlan> | null=null
  if(action==='edit_terms' && Number(principal)>0 && Number(count)>=1 && Number(count)<=60 && firstDue && Number.isFinite(Date.parse(firstDue))) {
    preview=buildCreditInstallmentPlan({principalAmount:Number(principal),interestRate:Number(rate),installmentCount:Number(count),frequency,firstDueDate:new Date(firstDue+'T12:00:00Z'),fractionDigits:state?.fractionDigits??0})
  }
  async function save() {
    if (!state || submitting.current) return
    let fields: Record<string,unknown>
    if(action==='edit_terms') fields={principalAmount:Number(principal),interestRate:Number(rate),installmentCount:Number(count),frequency,firstDueDate:firstDue}
    else if(action==='reschedule') fields={installments:pending.filter(row=>dates[row.id]!==creditCalendarDate(row.due_date,state.timeZone)).map(row=>({id:row.id,dueDate:dates[row.id]}))}
    else if(action==='adjust_balance') fields={installmentId,amount:Number(amount)}
    else fields={paymentId,paidAt:paidAt?new Date(paidAt).toISOString():''}
    const parsed=creditAmendmentSchema.safeParse({creditId,expectedVersion:state.version,reason,action,...fields})
    if(!parsed.success) { setError(action==='reschedule' && Array.isArray(fields.installments) && !fields.installments.length?'Cambiá al menos un vencimiento.':parsed.error.issues[0]?.message||'Revisá los datos.'); return }
    submitting.current=true; setBusy(true); setError('')
    try {
      const response=await fetch('/api/credits/amendments',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)})
      const result=await response.json()
      if(!mounted.current) return
      if(!response.ok || !result.success) throw new Error(result.error||'No se pudo confirmar la corrección. Recargá para verificar el resultado.')
      toast.success('Corrección registrada en el historial del crédito.')
      await load()
      await onUpdated?.()
    } catch(cause) { if(mounted.current) setError(cause instanceof Error?cause.message:'No se pudo confirmar la corrección. Recargá para verificar el resultado.') }
    finally { submitting.current=false; if(mounted.current) setBusy(false) }
  }
  const selectClass='min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm'
  return <div className="space-y-4 text-left">
    <p className="text-sm text-muted-foreground">Solo propietario y administrador. Cada cambio conserva los cobros y registra quién lo hizo, el motivo y los valores anteriores.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading?<p role="status">Cargando condiciones e historial…</p>:!state?<Button onClick={()=>void load()}>Reintentar carga</Button>:<>
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="credit-amend-action">Qué querés corregir</Label>
          <select id="credit-amend-action" className={selectClass} value={action} onChange={e=>{setAction(e.target.value as Action);setError('')}}>
            <option value="reschedule" disabled={!active}>Vencimientos de cuotas pendientes</option>
            <option value="edit_terms" disabled={hasPayments||!active}>Condiciones completas (sin pagos)</option>
            <option value="adjust_balance" disabled={!active}>Ajustar deuda de una cuota pendiente</option>
            <option value="correct_payment_date" disabled={!state.payments.length}>Corregir fecha de un pago registrado</option>
          </select>
        </div>
        {hasPayments && <p className="text-xs text-muted-foreground">Las condiciones completas están bloqueadas porque hay pagos registrados.</p>}
        {action==='edit_terms' && <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="credit-base">Capital sin interés</Label><Input id="credit-base" type="number" min="0.01" step="0.01" value={principal} onChange={e=>setPrincipal(e.target.value)}/></div>
            <div><Label htmlFor="credit-rate">Interés total (%)</Label><Input id="credit-rate" type="number" min="0" max="100" step="0.01" value={rate} onChange={e=>setRate(e.target.value)}/></div>
            <div><Label htmlFor="credit-count">Cantidad de cuotas</Label><Input id="credit-count" type="number" min="1" max="60" value={count} onChange={e=>setCount(e.target.value)}/></div>
            <div><Label htmlFor="credit-frequency">Frecuencia</Label><select id="credit-frequency" className={selectClass} value={frequency} onChange={e=>setFrequency(e.target.value as typeof frequency)}><option value="weekly">Semanal</option><option value="biweekly">Cada 15 días</option><option value="monthly">Mensual</option></select></div>
            <div><Label htmlFor="credit-first-date">Primer vencimiento</Label><Input id="credit-first-date" type="date" value={firstDue} onChange={e=>setFirstDue(e.target.value)}/></div>
          </div>
          {preview && <div className="rounded-md bg-muted p-3 text-sm"><p>Total financiado: <strong>{formatCurrency(preview.financedTotal)}</strong> · Interés: {formatCurrency(preview.interestAmount)}</p><ul className="mt-2 max-h-40 overflow-y-auto">{preview.installments.map(row=><li key={row.installmentNumber}>Cuota {row.installmentNumber}: {row.dueDate.toISOString().slice(0,10)} · {formatCurrency(row.amount)}</li>)}</ul></div>}
        </div>}
        {action==='reschedule' && <div className="max-h-64 space-y-3 overflow-y-auto">{pending.length?pending.map(row=><div key={row.id}><Label htmlFor={`due-${row.id}`}>Cuota {row.installment_number} · pendiente {formatCurrency(Number(row.amount)-Number(row.amount_paid||0))}</Label><Input id={`due-${row.id}`} type="date" value={dates[row.id]||''} onChange={e=>setDates(previous=>({...previous,[row.id]:e.target.value}))}/></div>):<p>No hay cuotas pendientes para reprogramar.</p>}</div>}
        {action==='adjust_balance' && <div className="space-y-3">
          <p className="text-sm">Este ajuste cambia la deuda del crédito y queda separado de la venta original. No registra un ingreso ni modifica los cobros.</p>
          <Label htmlFor="adjust-installment">Cuota pendiente</Label><select id="adjust-installment" className={selectClass} value={installmentId} onChange={e=>{setInstallmentId(e.target.value);setAmount(String(state.installments.find(row=>row.id===e.target.value)?.amount||''))}}><option value="">Elegí una cuota</option>{pending.map(row=><option key={row.id} value={row.id}>Cuota {row.installment_number} · total {formatCurrency(row.amount)} · cobrado {formatCurrency(row.amount_paid||0)}</option>)}</select>
          <div><Label htmlFor="adjust-amount">Nuevo importe total de la cuota (incluye lo ya cobrado)</Label><Input id="adjust-amount" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          {installmentId && Number(amount)>0 && <p className="text-sm">Variación de deuda: {formatCurrency(Number(amount)-Number(state.installments.find(row=>row.id===installmentId)?.amount||0))}</p>}
        </div>}
        {action==='correct_payment_date' && <div className="space-y-3">
          <p className="text-sm">No admite períodos cerrados, pagos sin vínculo comprobable ni comprobantes con varias deudas o saldo a favor. El comprobante original se conserva; la corrección queda en este historial.</p>
          <Label htmlFor="correct-payment">Pago registrado</Label><select id="correct-payment" className={selectClass} value={paymentId} onChange={e=>{setPaymentId(e.target.value);setPaidAt('')}}><option value="">Elegí un pago</option>{state.payments.map(row=><option key={row.id} value={row.id}>{new Date(row.created_at).toLocaleString()} · {formatCurrency(row.amount)} · {row.payment_method}</option>)}</select>
          <div><Label htmlFor="correct-payment-date">Fecha y hora correctas (hora de tu dispositivo)</Label><Input id="correct-payment-date" type="datetime-local" value={paidAt} onChange={e=>setPaidAt(e.target.value)}/></div>
        </div>}
        <div><Label htmlFor="credit-amend-reason">Motivo obligatorio</Label><Textarea id="credit-amend-reason" value={reason} maxLength={500} placeholder="Explicá por qué se corrige el crédito o pago" onChange={e=>setReason(e.target.value)}/></div>
        <div className="flex flex-wrap gap-2"><Button onClick={()=>void save()} disabled={busy || (action!=='correct_payment_date'&&!active) || (action==='edit_terms'&&hasPayments)}>{busy?'Guardando corrección…':'Guardar corrección'}</Button><Button variant="outline" onClick={()=>void load()}>Recargar datos</Button></div>
      </fieldset>
      <div className="space-y-2 border-t pt-4"><h4 className="font-semibold">Historial de correcciones</h4><p className="text-xs text-muted-foreground">Últimas 100 correcciones. Las fechas del historial usan la zona horaria de la tienda.</p>{state.history.length?state.history.map(row=><div key={row.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{amendmentActionLabels[row.action]||row.action} · {new Date(row.created_at).toLocaleString(undefined,{timeZone:state.timeZone})}</p><p>{row.reason}</p><p className="text-xs text-muted-foreground break-all">Responsable: {row.actor_id} · Variación: {formatCurrency(row.debt_delta)}</p><Button variant="ghost" size="sm" onClick={()=>setExpandedHistory(expandedHistory===row.id?null:row.id)}>{expandedHistory===row.id?'Ocultar valores':'Ver valores anteriores y posteriores'}</Button>{expandedHistory===row.id && <div className="grid gap-2 sm:grid-cols-2"><div><p>Antes</p><HistoryValues value={row.before_state} timeZone={state.timeZone}/></div><div><p>Después</p><HistoryValues value={row.after_state} timeZone={state.timeZone}/></div></div>}</div>):<p className="text-sm text-muted-foreground">Este crédito todavía no tiene correcciones.</p>}</div>
    </>}
  </div>
}
