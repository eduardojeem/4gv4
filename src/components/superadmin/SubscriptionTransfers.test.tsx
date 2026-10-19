import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionTransfers } from './SubscriptionTransfers'
const settings={enabled:false,bankName:'',accountHolder:'',accountNumber:'',accountAlias:'',currency:'PYG',instructions:'',updatedAt:'2026-10-18T10:00:00Z'}
const request={id:'req-1',organization_name:'Tienda Uno',organization_id:'org-1',reference:'TR-123',plan_code:'PRO',plan_name:'Pro Max',amount:200000,currency:'PYG',status:'pending_review',bank_snapshot:{...settings,bankName:'Banco Uno',accountHolder:'Plataforma',accountNumber:'1234'},created_at:'2026-10-18T10:00:00Z',receipt_path:'private/org/file.pdf',operation_reference:'CLIENT-9'}
let calls:Array<{url:string;init?:RequestInit}>=[]
const response=(data:unknown,status=200)=>Promise.resolve({ok:status<400,status,json:async()=>data})
beforeEach(()=>{
 calls=[];vi.spyOn(window,'confirm').mockReturnValue(true)
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{
  calls.push({url,init})
  if(url.includes('subscription-transfer-settings'))return response({settings})
  if(url.endsWith('/receipt'))return response({url:'https://storage.example/signed/short-lived'})
  if(url.endsWith('/review'))return response({request:{...request,status:JSON.parse(String(init?.body)).decision==='approve'?'approved':'rejected'},applied:true})
  return response({requests:[request],hasMore:false})
 }))
})
afterEach(async()=>{cleanup();await Promise.resolve();vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('subscription bank transfer administration',()=>{
 it('requires bank verification and reference, never preloads a private receipt, and submits approval once',async()=>{
  render(<SubscriptionTransfers />)
  fireEvent.click(await screen.findByRole('button',{name:'Ver detalle TR-123'}))
  const approve=screen.getByRole('button',{name:'Aprobar y activar período'})
  expect(approve).toBeDisabled()
  expect(calls.some(c=>c.url.endsWith('/receipt'))).toBe(false)
  fireEvent.change(screen.getByLabelText('Referencia bancaria verificada'),{target:{value:' BANK-42 '}})
  expect(approve).toBeDisabled()
  fireEvent.click(screen.getByLabelText(/Verifiqué la acreditación/))
  fireEvent.click(approve);fireEvent.click(approve)
  await waitFor(()=>expect(calls.filter(c=>c.url.endsWith('/review'))).toHaveLength(1))
  expect(JSON.parse(String(calls.find(c=>c.url.endsWith('/review'))?.init?.body))).toEqual({decision:'approve',bankOperationReference:'BANK-42'})
  expect(await screen.findByText('Transferencia aprobada y período activado.')).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Aprobar y activar período'})).not.toBeInTheDocument()
 })
 it('fetches the signed receipt only when requested and requires a rejection reason',async()=>{
  render(<SubscriptionTransfers />)
  fireEvent.click(await screen.findByRole('button',{name:'Ver detalle TR-123'}))
  fireEvent.click(screen.getByRole('button',{name:'Consultar comprobante privado'}))
  expect(await screen.findByRole('link',{name:'Abrir comprobante privado'})).toHaveAttribute('href','https://storage.example/signed/short-lived')
  expect(screen.queryByText('private/org/file.pdf')).not.toBeInTheDocument()
  const reject=screen.getByRole('button',{name:'Rechazar solicitud'});expect(reject).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Motivo del rechazo'),{target:{value:'No se acreditó'}});fireEvent.click(reject)
  await waitFor(()=>expect(calls.some(c=>c.url.endsWith('/review'))).toBe(true))
  expect(JSON.parse(String(calls.find(c=>c.url.endsWith('/review'))?.init?.body))).toEqual({decision:'reject',reason:'No se acreditó'})
  expect(await screen.findByText('Solicitud rechazada.')).toBeInTheDocument()
 })
 it('validates enabled bank details and sends only editable settings with fixed currency',async()=>{
  render(<SubscriptionTransfers />)
  await screen.findByRole('button',{name:'Ver detalle TR-123'})
  fireEvent.click(screen.getByLabelText('Habilitar transferencias bancarias'))
  fireEvent.click(screen.getByRole('button',{name:'Guardar datos bancarios'}))
  expect(calls.filter(c=>c.init?.method==='PUT')).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Banco'),{target:{value:'Banco Uno'}})
  fireEvent.change(screen.getByLabelText('Titular de la cuenta'),{target:{value:'Plataforma'}})
  fireEvent.change(screen.getByLabelText('Número de cuenta'),{target:{value:'1234'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar datos bancarios'}))
  await waitFor(()=>expect(calls.filter(c=>c.init?.method==='PUT')).toHaveLength(1))
  const body=JSON.parse(String(calls.find(c=>c.init?.method==='PUT')?.init?.body))
  expect(body.currency).toBe('PYG');expect(body).not.toHaveProperty('updatedAt')
 })
})

it('shows a request error with retry instead of a fake empty list',async()=>{
 let failed=true
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('subscription-transfer-settings')?response({settings}):failed?response({error:'No se pudieron consultar las solicitudes'},500):response({requests:[],hasMore:false})))
 render(<SubscriptionTransfers />)
 expect(await screen.findByText('No se pudieron consultar las solicitudes')).toBeInTheDocument()
 expect(screen.queryByText('No hay solicitudes en este estado.')).not.toBeInTheDocument()
 failed=false;fireEvent.click(screen.getByRole('button',{name:'Reintentar solicitudes'}))
 expect(await screen.findByText('No hay solicitudes en este estado.')).toBeInTheDocument()
})
it('does not allow overwriting unknown bank settings after a failed initial read',async()=>{
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('subscription-transfer-settings')?response({error:'Configuración no disponible'},503):response({requests:[],hasMore:false})))
 render(<SubscriptionTransfers />)
 expect(await screen.findByText('Configuración no disponible')).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Guardar datos bancarios'})).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Volver a cargar datos bancarios'})).toBeEnabled()
})
it('paginates and resets to page one when changing the status filter',async()=>{
 vi.stubGlobal('fetch',vi.fn((url:string)=>{
  calls.push({url})
  if(url.includes('subscription-transfer-settings'))return response({settings})
  return response({requests:[],hasMore:true})
 }))
 render(<SubscriptionTransfers />)
 await screen.findByText('No hay solicitudes en este estado.')
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}))
 await waitFor(()=>expect(calls.some(c=>c.url.includes('page=2'))).toBe(true))
 fireEvent.change(screen.getByLabelText('Estado de solicitud'),{target:{value:'awaiting_receipt'}})
 await waitFor(()=>expect(calls.some(c=>c.url.includes('status=awaiting_receipt&page=1'))).toBe(true))
})

it('shows a failed review and permits retry without claiming activation',async()=>{
 let reviews=0
 vi.stubGlobal('fetch',vi.fn((url:string)=>{
  if(url.includes('subscription-transfer-settings'))return response({settings})
  if(url.endsWith('/review')){reviews++;return response({error:'La referencia bancaria ya fue utilizada'},409)}
  return response({requests:[request],hasMore:false})
 }))
 render(<SubscriptionTransfers />)
 fireEvent.click(await screen.findByRole('button',{name:'Ver detalle TR-123'}))
 fireEvent.change(screen.getByLabelText('Referencia bancaria verificada'),{target:{value:'REF-1'}})
 fireEvent.click(screen.getByLabelText(/Verifiqué la acreditación/))
 fireEvent.click(screen.getByRole('button',{name:'Aprobar y activar período'}))
 expect(await screen.findByText('La referencia bancaria ya fue utilizada')).toBeInTheDocument()
 expect(screen.queryByText('Transferencia aprobada y período activado.')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Aprobar y activar período'})).toBeEnabled()
 fireEvent.click(screen.getByRole('button',{name:'Aprobar y activar período'}))
 await waitFor(()=>expect(reviews).toBe(2))
})

it('allows rejecting an abandoned request awaiting receipt without exposing approval',async()=>{
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{
  calls.push({url,init})
  if(url.includes('subscription-transfer-settings'))return response({settings})
  if(url.endsWith('/review'))return response({request:{...request,status:'rejected'},applied:false})
  return response({requests:[{...request,status:'awaiting_receipt',receipt_path:null}],hasMore:false})
 }))
 render(<SubscriptionTransfers />)
 fireEvent.click(await screen.findByRole('button',{name:'Ver detalle TR-123'}))
 expect(screen.queryByRole('button',{name:'Aprobar y activar período'})).not.toBeInTheDocument()
 expect(screen.queryByLabelText('Referencia bancaria verificada')).not.toBeInTheDocument()
 expect(screen.queryByLabelText(/Verifiqué la acreditación/)).not.toBeInTheDocument()
 const reject=screen.getByRole('button',{name:'Rechazar solicitud'})
 expect(reject).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Motivo del rechazo'),{target:{value:' Solicitud abandonada '}})
 fireEvent.click(reject)
 expect(await screen.findByText('Solicitud rechazada.')).toBeInTheDocument()
 expect(JSON.parse(String(calls.find(c=>c.url.endsWith('/review'))?.init?.body))).toEqual({decision:'reject',reason:'Solicitud abandonada'})
 expect(screen.queryByRole('button',{name:'Rechazar solicitud'})).not.toBeInTheDocument()
})
