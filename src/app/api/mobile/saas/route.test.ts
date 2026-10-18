import { beforeEach, describe, expect, it, vi } from 'vitest'
const control=vi.hoisted(()=>({plans:vi.fn(),branding:vi.fn()}))
vi.mock('@/lib/saas/public-plans',()=>({getPublicSubscriptionPlansStrict:control.plans}))
vi.mock('@/lib/platform/branding',()=>({getPlatformBranding:control.branding}))
import { GET } from './route'
const branding={platformName:'Marca configurada',logoUrl:'/logo.png',platformTagline:'Tu negocio',primaryCtaLabel:'Crear negocio',primaryCtaHref:'/register',secondaryCtaLabel:'Contactar',secondaryCtaHref:'https://wa.me/595123456789'}
const plan={id:'plan-1',tier:'pro',public_slug:'pro-max',name:'Pro Max',price:200000,price_note:'por mes',description:'Plan vigente',is_active:true,is_popular:true,trial_days:0,limits:{users:5,products:70,branches:null,repairPhotos:0},modules:['pos','inventory'],features:[{label:'Delivery',value:true}],highlights:['Todo ilimitado']}
beforeEach(()=>{control.plans.mockReset().mockResolvedValue([plan]);control.branding.mockReset().mockResolvedValue(branding)})
describe('public mobile SaaS catalog',()=>{
 it('uses operational limits, included features, configured CTAs and no invented trial',async()=>{
  const response=await GET();const body=await response.json()
  expect(response.status).toBe(200)
  expect(body.plans[0]).toMatchObject({price:200000,trial_days:0,ctaHref:'/register?plan=pro-max'})
  expect(body.plans[0].limits).toContainEqual({key:'products',label:'Productos',value:'70'})
  expect(body.plans[0].limits).toContainEqual({key:'repairPhotos',label:'Fotos por reparación',value:'No incluye'})
  expect(body.plans[0].limits.find((l:{key:string})=>l.key==='cashRegisters').value).toBe('No especificado')
  expect(body.plans[0].features.some((f:{key:string})=>f.key==='delivery')).toBe(false)
  expect(body.plans[0]).not.toHaveProperty('highlights')
  expect(body.branding).toMatchObject({name:branding.platformName,secondaryCtaHref:branding.secondaryCtaHref})
 })
 it('distinguishes an empty current catalog from a temporary failure',async()=>{
  control.plans.mockResolvedValueOnce([])
  const empty=await GET();expect(empty.status).toBe(200);expect((await empty.json()).plans).toEqual([])
  control.plans.mockRejectedValueOnce(new Error('database unavailable'))
  const failed=await GET();expect(failed.status).toBe(503);expect(failed.headers.get('cache-control')).toContain('no-store');expect(await failed.json()).not.toHaveProperty('plans')
 })
 it('never converts an invalid price to free or sends an invalid destination',async()=>{
  control.plans.mockResolvedValueOnce([{...plan,price:null}])
  expect((await GET()).status).toBe(503)
  control.plans.mockResolvedValueOnce([plan]);control.branding.mockResolvedValueOnce({...branding,secondaryCtaHref:'javascript:alert(1)'})
  expect((await GET()).status).toBe(503)
 })
})
