import type { EditForm, SuperAdminSubscription } from './types'
import { toDateTimeLocalValue } from './utils'
export function toSubscriptionEditForm(sub: SuperAdminSubscription): EditForm {
  return { plan:sub.plan.toUpperCase(),status:sub.status,trial_ends_at:toDateTimeLocalValue(sub.trial_ends_at),current_period_starts_at:toDateTimeLocalValue(sub.current_period_starts_at),current_period_ends_at:toDateTimeLocalValue(sub.current_period_ends_at),cancel_at_period_end:sub.cancel_at_period_end,storefront_public:Boolean(sub.storefront_public),marketplace_public:Boolean(sub.marketplace_public) }
}
export const SUBSCRIPTION_EDIT_LABELS: Record<keyof EditForm,string> = { plan:'Plan',status:'Estado',trial_ends_at:'Fin de prueba',current_period_starts_at:'Inicio del período',current_period_ends_at:'Fin del período',cancel_at_period_end:'Cancelación al terminar',storefront_public:'Tienda pública',marketplace_public:'Visible en marketplace' }
export function subscriptionChanges(sub: SuperAdminSubscription, form: EditForm): (keyof EditForm)[] {
  const original=toSubscriptionEditForm(sub)
  return (Object.keys(original) as (keyof EditForm)[]).filter(key=>original[key]!==form[key])
}
export function buildSubscriptionUpdate(sub: SuperAdminSubscription,form:EditForm) {
  const original=toSubscriptionEditForm(sub)
  function date(key:'trial_ends_at'|'current_period_starts_at'|'current_period_ends_at') {
    if(form[key]===original[key])return sub[key]
    if(!form[key])return null
    const parsed=new Date(form[key])
    if(!Number.isFinite(parsed.getTime()) || toDateTimeLocalValue(parsed.toISOString())!==form[key]) throw new Error('Revisá la fecha de '+SUBSCRIPTION_EDIT_LABELS[key].toLowerCase()+'.')
    return parsed.toISOString()
  }
  return {plan:form.plan,status:form.status,trial_ends_at:date('trial_ends_at'),current_period_starts_at:date('current_period_starts_at'),current_period_ends_at:date('current_period_ends_at'),cancel_at_period_end:form.cancel_at_period_end,...(form.storefront_public!==original.storefront_public?{storefront_public:form.storefront_public}:{}),...(form.marketplace_public!==original.marketplace_public?{marketplace_public:form.marketplace_public}:{})}
}
export function parseManualPaymentAmount(raw:string):number {
  const text=raw.trim()
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text))throw new Error('Ingresá un monto entero y positivo en guaraníes.')
  const value=Number(text.replace(/\./g,''))
  if(!Number.isSafeInteger(value)||value<=0||value>1_000_000_000)throw new Error('El monto debe estar entre Gs. 1 y Gs. 1.000.000.000.')
  return value
}
export function manualPaymentDateIso(value:string,today:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>today)throw new Error('Elegí una fecha de cobro válida, hasta hoy.')
  const date=new Date(value+'T12:00:00-03:00')
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('Elegí una fecha de cobro válida.')
  return date.toISOString()
}
export const SUBSCRIPTION_STATUS_LABELS:Record<string,string>={active:'Activa',trialing:'En prueba',past_due:'Pago vencido',unpaid:'Impaga',suspended:'Suspendida',canceled:'Cancelada',cancelled:'Cancelada',expired:'Vencida',sin_estado:'Sin estado'}
export const SUBSCRIPTION_PROVIDER_LABELS:Record<string,string>={manual:'Manual',bank_transfer:'Transferencia bancaria',transfer:'Transferencia bancaria',stripe:'Stripe',bancard:'Bancard',paypal:'PayPal'}
export function subscriptionPriceLabel(sub:SuperAdminSubscription):string {
  const price=sub.plan_details?.price_monthly
  if(price==null)return 'Precio sin definir'
  if(price===0)return 'Gratuito'
  return new Intl.NumberFormat('es-PY',{style:'currency',currency:sub.plan_details?.currency||'PYG',maximumFractionDigits:0}).format(price)
}
