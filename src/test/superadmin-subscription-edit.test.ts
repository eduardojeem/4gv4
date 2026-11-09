import { describe, expect, it } from 'vitest'
import { toSubscriptionEditForm, buildSubscriptionUpdate, subscriptionChanges, parseManualPaymentAmount, manualPaymentDateIso } from '@/components/superadmin/subscriptions/subscription-edit'
import { isRunningTrial } from '@/components/superadmin/subscriptions/utils'
import type { SuperAdminSubscription } from '@/components/superadmin/subscriptions/types'
const sub={plan:'PRO',status:'active',trial_ends_at:null,current_period_starts_at:'2026-11-01T13:26:59.123Z',current_period_ends_at:'2026-12-01T13:26:59.123Z',cancel_at_period_end:false,storefront_public:null,marketplace_public:null} as SuperAdminSubscription
describe('edición de suscripción',()=>{
 it('conserva instante, segundos y publicación cuando no se modifican',()=>{
  const form=toSubscriptionEditForm(sub);expect(subscriptionChanges(sub,form)).toEqual([]);
  const body=buildSubscriptionUpdate(sub,{...form,cancel_at_period_end:true});
  expect(body.current_period_ends_at).toBe(sub.current_period_ends_at);expect(body.current_period_starts_at).toBe(sub.current_period_starts_at);
  expect(body).not.toHaveProperty('storefront_public');expect(body).not.toHaveProperty('marketplace_public');
 });
 it('envía una fecha modificada con zona explícita y solo la publicación que cambió',()=>{
  const date='2026-12-02T15:30';const body=buildSubscriptionUpdate(sub,{...toSubscriptionEditForm(sub),current_period_ends_at:date,storefront_public:true});
  expect(body.current_period_ends_at).toBe(new Date(date).toISOString());expect(body.storefront_public).toBe(true);expect(body).not.toHaveProperty('marketplace_public');
 });
 it('rechaza fechas inválidas antes de enviar',()=>{
  expect(()=>buildSubscriptionUpdate(sub,{...toSubscriptionEditForm(sub),current_period_ends_at:'fecha inválida'})).toThrow();
 });
 it('una fecha residual no convierte una cuenta activa o cancelada en prueba',()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  expect(isRunningTrial({...sub,trial_ends_at:future})).toBe(false);expect(isRunningTrial({...sub,status:'canceled',trial_ends_at:future})).toBe(false);
 });
});
describe('revisión de un cobro manual',()=>{
 it('interpreta miles en guaraníes sin convertir negativos o decimales en otro monto',()=>{
  expect(parseManualPaymentAmount('150.000')).toBe(150000);expect(parseManualPaymentAmount('150000')).toBe(150000);
  for(const value of ['-100','1.5','0','abc','1000000001'])expect(()=>parseManualPaymentAmount(value)).toThrow();
 });
 it('exige una fecha real y no futura, manteniendo el horario ya usado por el cobro',()=>{
  expect(manualPaymentDateIso('2026-11-07','2026-11-07')).toBe('2026-11-07T15:00:00.000Z');
  for(const value of ['','2026-02-31','2026-11-08'])expect(()=>manualPaymentDateIso(value,'2026-11-07')).toThrow();
 });
});
