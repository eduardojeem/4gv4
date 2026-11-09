import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionCard } from '@/components/superadmin/subscriptions/subscription-card'
import { SubscriptionTable } from '@/components/superadmin/subscriptions/subscription-table'
import { ManualPaymentForm } from '@/components/superadmin/subscriptions/manual-payment-form'
import type { SuperAdminSubscription } from '@/components/superadmin/subscriptions/types'
import { getAttentionLevel } from '@/components/superadmin/subscriptions/utils'
const date = (days: number) => new Date(Date.now() + days * 86400000).toISOString()
const sub = (over: Partial<SuperAdminSubscription> = {}): SuperAdminSubscription => ({
 id:'s1',organization_id:'org1',organization_name:'4G Technology',organization_slug:'4g-technology',organization_plan:'PRO',owner_id:null,owner_name:null,owner_email:null,plan:'PRO',plan_details:{code:'PRO',name:'Profesional',price_monthly:150000,currency:'PYG',limits:{},modules:[],is_active:true},status:'active',provider:'bancard',provider_customer_id:null,provider_subscription_id:null,trial_ends_at:null,current_period_starts_at:date(-20),current_period_ends_at:date(20),cancel_at_period_end:false,created_at:date(-30),updated_at:date(-2),products_count:30,sales_count:2,...over
})
describe('Lista y tarjetas de suscripciones', () => {
 it('no presenta una fecha ausente como acceso perpetuo', () => {
  render(<SubscriptionCard subscription={sub({current_period_ends_at:null})} onOpenDetail={vi.fn()}/> )
  expect(screen.queryByText('Perpetuo')).not.toBeInTheDocument()
  expect(screen.getByText('Sin fecha definida')).toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
 })
 it('el teclado de un enlace dentro de la tarjeta no abre la ficha', () => {
  const open=vi.fn();render(<SubscriptionCard subscription={sub()} onOpenDetail={open}/> )
  fireEvent.keyDown(screen.getByRole('link',{name:/Tienda/}),{key:'Enter'})
  expect(open).not.toHaveBeenCalled()
 })
 it.each(['card','table'])('%s diferencia proveedor de cobros confirmados', view => {
  const props={subscription:sub(),onOpenDetail:vi.fn()}
  if(view==='card')render(<SubscriptionCard {...props}/>);else render(<SubscriptionTable items={[props.subscription]} onOpenDetail={props.onOpenDetail} onCopyValue={vi.fn()}/> )
  expect(screen.getByText('Bancard')).toBeInTheDocument()
  expect(screen.getByRole('link',{name:/Historial de cobros/})).toHaveAttribute('href','/superadmin/invoices?q=4g-technology')
 })
 it('abrir el historial en tabla no dispara también la ficha', () => {
  const open=vi.fn();render(<SubscriptionTable items={[sub()]} onOpenDetail={open} onCopyValue={vi.fn()}/> )
  const history = screen.getByRole('link',{name:/Historial de cobros/})
  history.addEventListener('click', event => event.preventDefault())
  fireEvent.click(history)
  expect(open).not.toHaveBeenCalled()
 })
 it('una prueba vigente no se marca vencida por el ciclo anterior', () => {
  const trial=sub({status:'trialing',trial_ends_at:date(20),current_period_ends_at:date(-20)})
  expect(getAttentionLevel(trial)).toBe('none')
  render(<SubscriptionTable items={[trial]} onOpenDetail={vi.fn()} onCopyValue={vi.fn()}/> )
  const row=screen.getByRole('button',{name:'4G Technology'}).closest('tr')!
  expect(within(row).queryByText(/vencido/)).not.toBeInTheDocument()
 })
 it('una fecha de prueba residual no genera una alerta en cuentas activas', () => {
  expect(getAttentionLevel(sub({trial_ends_at:date(2)}))).toBe('none')
 })
})
describe('Selección de medios para registrar un cobro', () => {
 it('permite elegir el medio de cobro y explica que no realiza cargos', () => {
  render(<ManualPaymentForm subscriptionId="s1" currentPlan="PRO" suggestedAmount={150000} onRecorded={vi.fn()}/> )
  fireEvent.click(screen.getByRole('radio',{name:/Transferencia/}))
  expect(screen.getByRole('radio',{name:/Transferencia/})).toBeChecked()
  expect(screen.getByText(/no realiza cargos/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Revisar pago'}))
  expect(screen.getByText(/PRO ·.*Transferencia/)).toBeInTheDocument()
 })
 it('al cambiar de plan no conserva silenciosamente el importe del plan anterior', () => {
  render(<ManualPaymentForm subscriptionId="s1" currentPlan="PRO" suggestedAmount={150000} onRecorded={vi.fn()}/> )
  fireEvent.change(screen.getByRole('combobox',{name:'Plan a activar'}),{target:{value:'ENTERPRISE'}})
  expect(screen.getByLabelText('Monto cobrado (₲)')).toHaveValue('')
 })
})
