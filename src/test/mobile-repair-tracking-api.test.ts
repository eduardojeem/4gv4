import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const state=vi.hoisted(()=>({valid:true,storeError:false,tables:[] as string[],eq:[] as unknown[][]}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:null}})}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{
 state.tables.push(table)
 const data=table==='repairs'?{id:'repair-one',ticket_number:'R-2026-00042',organization_id:'org-real',customer_id:'customer-one',created_at:'2026-11-16T12:00:00Z',status:'pausado',device_brand:'Marca',device_model:'Modelo',technician_id:null}:table==='customers'?{name:'Cliente',phone:'0981000000'}:table==='organizations'?{name:'Taller real',slug:'taller-real'}:[]
 const result=()=>({data,error:table==='organizations'&&state.storeError?{message:'offline'}:null})
 const builder={select:()=>builder,eq:(...args:unknown[])=>{state.eq.push([table,...args]);return builder},single:async()=>result(),order:async()=>result()};return builder
}})}))
vi.mock('@/lib/public-session',()=>({extractBearerToken:()=>null,isPublicRepairSessionAuthorized:()=>false,verifyPublicToken:async()=>null}))
vi.mock('@/lib/repair-qr-hash',()=>({verifyRepairHash:()=>state.valid}))
vi.mock('@/lib/saas/public-tenant',()=>({resolvePublicOrganizationBySlug:async()=>({id:'org-real'})}))
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn()}}))
import {GET} from '@/app/api/public/repairs/[ticketId]/route'
const request=(query='?verify=abcdef0123456789&org=taller-real')=>GET(new NextRequest('https://fixture.test/api/public/repairs/R-2026-00042'+query),{params:Promise.resolve({ticketId:'R-2026-00042'})})
beforeEach(()=>{state.valid=true;state.storeError=false;state.tables=[];state.eq=[]})
describe('detalle público para QR móvil',()=>{
 it('devuelve comercio real y estado solo después de validar el QR',async()=>{const response=await request();expect(response.status).toBe(200);const body=await response.json();expect(body.data).toMatchObject({status:'pausado',store:{name:'Taller real',slug:'taller-real'}});expect(state.eq).toContainEqual(['organizations','id','org-real']);expect(state.eq).toContainEqual(['repairs','organization_id','org-real']);expect(response.headers.get('cache-control')).toContain('no-store')})
 it('un QR inválido no consulta ni expone el comercio',async()=>{state.valid=false;expect((await request()).status).toBe(403);expect(state.tables).not.toContain('organizations')})
 it('sin prueba de acceso no consulta la reparación ni el comercio',async()=>{expect((await request('')).status).toBe(401);expect(state.tables).toEqual([])})
 it('no inventa el comercio si la consulta falla',async()=>{state.storeError=true;expect((await request()).status).toBe(500)})
})
