import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({authorized:true,active:null as unknown,end:vi.fn(),create:vi.fn(),read:vi.fn(),deleted:vi.fn(),set:vi.fn()}))
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'session-1'}),delete:state.deleted,set:state.set})}))
vi.mock('@/lib/superadmin/auth',()=>({getSuperAdminUser:async()=>state.authorized?{id:'admin-a',email:'admin@example.test'}:null}))
vi.mock('@/lib/superadmin/audit',()=>({logSuperAdminAction:vi.fn()}))
vi.mock('@/lib/rate-limiter',()=>({getClientIp:()=>null}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:'org-a',name:'Demo',slug:'demo'},error:null})};return q}})}))
vi.mock('@/lib/superadmin/support-session',()=>({SUPPORT_COOKIE:'sa_support_session',SUPPORT_SESSION_TTL_MINUTES:30,createSupportSession:state.create,endSupportSession:state.end,getActiveSupportSession:state.read,SupportSessionsTableMissingError:class extends Error{}}))
import { GET, POST, DELETE } from '@/app/api/superadmin/support-session/route'
const request=(method:string,body?:unknown)=>new NextRequest('http://localhost/api/superadmin/support-session',{method,...(body?{body:JSON.stringify(body)}:{})})
beforeEach(()=>{state.authorized=true;state.active=null;state.deleted.mockReset();state.set.mockReset();state.end.mockReset().mockResolvedValue(undefined);state.create.mockReset().mockResolvedValue({id:'session-new',expiresAt:new Date(Date.now()+1800000).toISOString()});state.read.mockReset().mockResolvedValue(null)})
describe('API de soporte sin ampliar permisos',()=>{
 it('lee la sesión únicamente para el actor autenticado y evita cachear el motivo',async()=>{
  const response=await GET();expect(state.read).toHaveBeenCalledWith('admin-a');expect(response.headers.get('cache-control')).toContain('no-store');
 })
 it('conserva la cookie y devuelve un error recuperable si falla el cierre',async()=>{
  state.end.mockRejectedValue(new Error('persistencia'));
  const response=await DELETE(request('DELETE'));
  expect(response.status).toBe(500);expect(state.deleted).not.toHaveBeenCalled();
 })
 it('cierra con el actor actual antes de borrar la cookie',async()=>{
  const response=await DELETE(request('DELETE'));
  expect(response.status).toBe(200);expect(state.end).toHaveBeenCalledWith('session-1','admin-a');expect(state.deleted).toHaveBeenCalledWith('sa_support_session');
 })
 it('rechaza motivos mayores al límite del formulario',async()=>{
  const response=await POST(request('POST',{organizationId:'org-a',reason:'x'.repeat(301)}));
  expect(response.status).toBe(400);expect(state.create).not.toHaveBeenCalled();
 })
 it.each([null, [], 'texto'])('rechaza un cuerpo que no sea objeto: %j',async body=>{
  const response=await POST(new NextRequest('http://localhost/api/superadmin/support-session',{method:'POST',body:JSON.stringify(body)}));
  expect(response.status).toBe(400);expect(state.create).not.toHaveBeenCalled();
 });
 it('mantiene cookie protegida y duración de 30 minutos al iniciar',async()=>{
  const response=await POST(request('POST',{organizationId:'org-a',reason:'Revisión solicitada'}));
  expect(response.status).toBe(201);expect(state.create).toHaveBeenCalledWith(expect.objectContaining({superAdminId:'admin-a',organizationId:'org-a'}));
  expect(state.set).toHaveBeenCalledWith('sa_support_session','session-new',expect.objectContaining({httpOnly:true,sameSite:'lax',maxAge:1800}));
 })
 it('deniega inicio, consulta y cierre a usuarios que no sean superadmin',async()=>{
  state.authorized=false;
  expect((await GET()).status).toBe(403);expect((await POST(request('POST',{organizationId:'org-a',reason:'Revisión'}))).status).toBe(403);expect((await DELETE(request('DELETE'))).status).toBe(403);
  expect(state.create).not.toHaveBeenCalled();expect(state.end).not.toHaveBeenCalled();
 })
})
