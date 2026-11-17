import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ existing: null as {id:string}|null, writeError: null as {message:string}|null, authorized: true, inserts: [] as unknown[], updates: [] as unknown[], orgUpdates: [] as unknown[], aliases: [] as unknown[] }))
function query(table: string) {
  const q: Record<string, unknown> = {}
  for (const key of ['select','eq']) q[key] = vi.fn(() => q)
  q.update = vi.fn((value) => { if(table==='subscriptions') state.updates.push(value); if(table==='organizations') state.orgUpdates.push(value); return q })
  q.delete = vi.fn(() => q)
  q.upsert = vi.fn((value) => { if(table==='organization_slug_aliases') state.aliases.push(value); return q })
  q.insert = vi.fn((value) => { if(table==='subscriptions') state.inserts.push(value); return q })
  q.maybeSingle = vi.fn(async () => ({data:table==='organizations'?{id:'11111111-2222-4333-8444-555555555555',name:'Demo',slug:'demo',plan:'PRO'}:state.existing,error:null}))
  q.then = (resolve: (value: unknown)=>unknown) => Promise.resolve({data:null,error:table==='subscriptions'?state.writeError:null}).then(resolve)
  return q
}
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:query})}))
vi.mock('@/lib/superadmin/auth',()=>({getSuperAdminUser:async()=>state.authorized?{id:'superadmin',email:'admin@example.test'}:null}))
vi.mock('@/lib/superadmin/audit',()=>({logSuperAdminAction:vi.fn()}))
import { PATCH } from '@/app/api/superadmin/organizations/[id]/route'
const patch=(body:unknown)=>PATCH(new NextRequest('http://localhost/api/superadmin/organizations/demo',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:'11111111-2222-4333-8444-555555555555'})})
beforeEach(()=>{state.existing=null;state.writeError=null;state.authorized=true;state.inserts=[];state.updates=[];state.orgUpdates=[];state.aliases=[]})
describe('cambios parciales de suscripción',()=>{
 it('guarda el estado solicitado aunque no exista suscripción y conserva el plan',async()=>{
  const response=await patch({status:'suspended'})
  expect(response.status).toBe(200)
  expect(state.inserts).toHaveLength(1)
  expect(state.inserts[0]).toMatchObject({plan:'PRO',status:'suspended'})
 })
 it('informa un error real de persistencia en lugar de anunciar éxito',async()=>{
  state.existing={id:'sub-1'};state.writeError={message:'No se pudo guardar'}
  const response=await patch({status:'suspended'})
  expect(response.status).toBe(500)
  expect(await response.json()).toMatchObject({error:expect.any(String)})
 })
 it('editar solo el nombre no crea ni actualiza una suscripción',async()=>{
  expect((await patch({name:'Nombre nuevo'})).status).toBe(200)
  expect(state.inserts).toHaveLength(0);expect(state.updates).toHaveLength(0)
 })
 it('mantiene la autorización superadmin',async()=>{
  state.authorized=false;expect((await patch({status:'suspended'})).status).toBe(403)
  expect(state.inserts).toHaveLength(0)
 })
})

describe('arreglos de la auditoría',()=>{
 it('si falla la suscripción se deshace el cambio de la empresa',async()=>{
  state.existing={id:'sub-1'};state.writeError={message:'falló'}
  const response=await patch({name:'Nombre nuevo',status:'suspended'})
  expect(response.status).toBe(500)
  expect(state.orgUpdates).toHaveLength(2)
  expect(state.orgUpdates[1]).toEqual({name:'Demo'})
 })
 it('rechaza una dirección reservada sin escribir nada',async()=>{
  const response=await patch({slug:'admin'})
  expect(response.status).toBe(400)
  expect(state.orgUpdates).toHaveLength(0)
 })
 it('al cambiar la dirección guarda la vieja para redirigir',async()=>{
  const response=await patch({slug:'demo-nueva'})
  expect(response.status).toBe(200)
  expect(state.aliases[0]).toMatchObject({old_slug:'demo',new_slug:'demo-nueva'})
 })
 it('«Activa» sin fecha se rechaza antes de escribir',async()=>{
  state.existing={id:'sub-1'}
  const response=await patch({status:'active'})
  expect(response.status).toBe(400)
  expect(state.updates).toHaveLength(0)
 })
})
