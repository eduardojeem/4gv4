import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessagesPanel } from '@/components/superadmin/communications/MessagesPanel'
import { AnnouncementsPanel } from '@/components/superadmin/communications/AnnouncementsPanel'
import { EmailSetupPanel } from '@/components/superadmin/communications/EmailSetupPanel'
import { validateGlobalNotification } from '@/lib/superadmin/notification-validation'
const mocks=vi.hoisted(()=>({content:vi.fn(),success:vi.fn(),error:vi.fn()}))
vi.mock('@/app/superadmin/communications/actions',()=>({getMessageContentAction:mocks.content}))
vi.mock('sonner',()=>({toast:{success:mocks.success,error:mocks.error}}))
vi.mock('@/hooks/useUrlListState',async()=>{const {useState}=await import('react');return {useUrlListState:(defaults:Record<string,string>)=>{const [state,setState]=useState(defaults);return {state,setValue:(key:string,value:string)=>setState(s=>({...s,[key]:value}))}}}})
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
const message=(id:string)=>({id,organizationName:'Demo',recipientName:null,recipient:id+'@example.test',subject:'Email '+id,channel:'email',status:'sent',error:null,sentAt:'2026-01-01T12:00:00Z'})
describe('Comunicaciones: regresiones',()=>{
 it('descarta respuestas de emails anteriores',async()=>{
  let resolveA!:(value:unknown)=>void
  mocks.content.mockImplementation((id:string)=>id==='A'?new Promise(r=>{resolveA=r}):Promise.resolve({ok:true,data:{html:'<p>Contenido B</p>'}}))
  render(<MessagesPanel messages={[message('A'),message('B')]} channelStats={[]}/>)
  fireEvent.click(screen.getByText('Email A'));fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'})
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  fireEvent.click(screen.getByText('Email B'))
  await act(async()=>{resolveA({ok:true,data:{html:'<p>Contenido A</p>'}})})
  await waitFor(()=>expect(screen.getByTitle('Contenido del email')).toHaveAttribute('srcdoc','<p>Contenido B</p>'))
 })
 it('empieza en borrador y solicita confirmación antes de publicar',()=>{
  const request=vi.fn();vi.stubGlobal('fetch',request)
  render(<AnnouncementsPanel announcements={[]} organizations={[{id:'org1',name:'Demo'}]}/>)
  fireEvent.click(screen.getByRole('button',{name:/Nuevo aviso/}))
  fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Aviso'}})
  fireEvent.change(screen.getByLabelText('Mensaje'),{target:{value:'Contenido'}})
  expect(screen.getByRole('button',{name:'Guardar borrador'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Publicar ya'}))
  fireEvent.click(screen.getByRole('button',{name:'Revisar publicación'}))
  expect(screen.getByRole('alertdialog')).toHaveTextContent(/Todas las tiendas/i)
  expect(request).not.toHaveBeenCalled()
 })
 it('mantiene el formulario abierto durante un guardado y conserva el error',async()=>{
  let done!:(value:unknown)=>void
  const request=vi.fn(()=>new Promise(resolve=>{done=resolve}));vi.stubGlobal('fetch',request)
  render(<AnnouncementsPanel announcements={[]} organizations={[]}/>)
  fireEvent.click(screen.getByRole('button',{name:/Nuevo aviso/}))
  fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Aviso'}})
  fireEvent.change(screen.getByLabelText('Mensaje'),{target:{value:'Contenido'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}))
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'})
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(request).toHaveBeenCalledTimes(1)
  await act(async()=>done({ok:false,json:async()=>({error:'No se pudo guardar'})}))
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.getByLabelText('Título')).toHaveValue('Aviso')
 })
 it('un pendiente no se muestra enviado',()=>{
  render(<MessagesPanel messages={[{...message('A'),status:'queued'}]} channelStats={[{channel:'email',sent:0,failed:0,pending:1}]}/>)
  expect(screen.getByText('En cola')).toBeInTheDocument()
  expect(screen.queryByText('Enviado')).not.toBeInTheDocument()
 })
 it('rechaza una programación nueva en el pasado',()=>{
  expect(validateGlobalNotification({title:'Aviso',body:'Contenido',type:'info',target:'all',status:'scheduled',scheduled_at:'2000-01-01T12:00:00Z'}).error).toMatch(/futura/i)
 })
 it('captura errores de conexión al probar email',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
  render(<EmailSetupPanel checks={[{key:'RESEND_API_KEY',label:'Resend',configured:true,critical:true,description:''}]} templates={[]} supabaseProjectRef={null}/>)
  fireEvent.change(screen.getByLabelText('Enviar a'),{target:{value:'demo@example.test'}})
  fireEvent.click(screen.getByRole('button',{name:'Enviar'}))
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/conexión/i))
 })
})
