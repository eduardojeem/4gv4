import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'
const account=vi.hoisted(()=>({user:null as null | {id:string;email:string;profile:{name:string;phone:string}}}))
vi.mock('@/contexts/auth-context',()=>({useAuth:()=>({user:account.user,loading:false})}))
beforeEach(()=>{account.user=null})
afterEach(()=>{ cleanup(); vi.unstubAllGlobals() })
const info = { storeName:'Barbería',currency:'PYG',today:'2026-10-10',maxDaysAhead:1,requireConfirmation:true,openDays:[6],message:null,
  professionalBookingAvailable:true,professionalSelection:'required',services:[{id:'service',name:'Corte',duration:30,price:30000,professionalIds:['prof']}],professionals:[{id:'prof',name:'Ana',color:'#000000'}] }
describe('public professional booking',()=>{
  it('requires choosing a professional even when there is only one',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(info))))
    render(<PublicBooking slug="store" initialServiceId="service" />)
    expect(await screen.findByRole('button',{name:'Ana'})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Cualquiera'})).not.toBeInTheDocument()
  })
  it('requires accepting the server quote and submits its opaque id, not a price',async()=>{
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input)
      if(init?.method==='POST' && url.endsWith('/quote')) return new Response(JSON.stringify({quoteId:'quote',expiresAt:'2099-10-10T09:10:00Z',startsAt:'2026-10-10T09:00:00Z',endsAt:'2026-10-10T09:45:00Z',professionalName:'Ana',professionalId:'prof',duration:45,price:40000}))
      if(init?.method==='POST') return new Response(JSON.stringify({token:'token',status:'pending'}),{status:201})
      if(url.includes('?')) return new Response(JSON.stringify({slots:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}))
      return new Response(JSON.stringify({...info,professionalSelection:'optional'}))
    })
    vi.stubGlobal('fetch',fetchMock)
    render(<PublicBooking slug="store" initialServiceId="service" />)
    fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
    fireEvent.click(await screen.findByRole('button',{name:'09:00'}))
    expect(await screen.findByText(/45 min/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Cliente'}})
    fireEvent.change(screen.getByLabelText('WhatsApp'),{target:{value:'0981000000'}})
    const book=screen.getByRole('button',{name:'Pedir el turno'})
    expect(book).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox',{name:/Acepto/}))
    fireEvent.click(book)
    await waitFor(()=>expect(fetchMock.mock.calls.some(([,init])=>init?.body && JSON.parse(String(init.body)).quote_id==='quote')).toBe(true))
    const posted=fetchMock.mock.calls.find(([,init])=>init?.body && JSON.parse(String(init.body)).quote_id==='quote')!
    expect(JSON.parse(String(posted[1]?.body))).not.toHaveProperty('price')
    expect(JSON.parse(String(posted[1]?.body)).idempotency_key).toBeTruthy()
  })
})

describe('availability errors', () => {
 it('distinguishes a failed query from an empty day and allows retry', async () => {
  let fail = true
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
   if (String(input).includes('?')) return fail ? new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 }) : new Response(JSON.stringify({ slots: [] }))
   return new Response(JSON.stringify({ ...info, professionalSelection: 'optional' }))
  }))
  render(<PublicBooking slug="store" initialServiceId="service" />)
  fireEvent.click(await screen.findByRole('button', { name: /Hoy/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar los horarios')
  expect(screen.queryByText('No quedan horarios libres ese día. Probá con otro.')).not.toBeInTheDocument()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar horarios' }))
  expect(await screen.findByText('No quedan horarios libres ese día. Probá con otro.')).toBeInTheDocument()
 })
})

describe('professional became busy',()=>{
 it('keeps the conflict visible, refreshes availability and preserves contact details',async()=>{
  let taken=false
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input)
   if(init?.method==='POST'&&url.endsWith('/quote'))return new Response(JSON.stringify({quoteId:'q',expiresAt:'2099-10-10T09:10:00Z',startsAt:'2026-10-10T09:00:00Z',endsAt:'2026-10-10T09:30:00Z',professionalId:'prof',professionalName:'Ana',duration:30,price:30000}))
   if(init?.method==='POST'){taken=true;return new Response(JSON.stringify({code:'APPOINTMENT_OVERLAP',error:'Ana ya tiene una reserva en ese horario. Elegí otro.'}),{status:409})}
   if(url.includes('?'))return new Response(JSON.stringify({slots:taken?[]:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}))
   return new Response(JSON.stringify({...info,professionalSelection:'optional'}))
  }))
  render(<PublicBooking slug="store" initialServiceId="service"/> )
  fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
  fireEvent.click(await screen.findByRole('button',{name:'09:00'}))
  fireEvent.change(await screen.findByLabelText('Nombre'),{target:{value:'Cliente'}})
  fireEvent.change(screen.getByLabelText('WhatsApp'),{target:{value:'0981000000'}})
  fireEvent.click(await screen.findByRole('checkbox',{name:/Acepto/}))
  fireEvent.click(screen.getByRole('button',{name:'Pedir el turno'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('ya tiene una reserva')
  await waitFor(()=>expect(screen.queryByRole('button',{name:'09:00'})).not.toBeInTheDocument())
 })
})

describe('busy professional while checking price',()=>{
 it('blocks confirmation and offers other available slots',async()=>{
  const api=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input)
   if(init?.method==='POST')return new Response(JSON.stringify({code:'APPOINTMENT_OVERLAP',error:'Ese horario ya está ocupado. Elegí otro.'}),{status:409})
   if(url.includes('?'))return new Response(JSON.stringify({slots:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}))
   return new Response(JSON.stringify({...info,professionalSelection:'optional'}))
  })
  vi.stubGlobal('fetch',api)
  render(<PublicBooking slug="store" initialServiceId="service"/> )
  fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
  fireEvent.click(await screen.findByRole('button',{name:'09:00'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('ya está ocupado')
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Cliente'}})
  fireEvent.change(screen.getByLabelText('WhatsApp'),{target:{value:'0981000000'}})
  expect(screen.getByRole('button',{name:'Pedir el turno'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Ver horarios disponibles'}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Pedir el turno'})).not.toBeInTheDocument())
  expect(api.mock.calls.filter(([url,init])=>init?.method==='POST'&&!String(url).endsWith('/quote'))).toHaveLength(0)
 })
})

describe('booking for the signed-in account',()=>{
 it('offers account contact and prefills it only when requested',async()=>{
  account.user={id:'u1',email:'ana@example.test',profile:{name:'Ana Pérez',phone:'0981123456'}}
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes('?')?{slots:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}:{...info,professionalBookingAvailable:false,professionalSelection:'optional'}))))
  render(<PublicBooking slug="store" initialServiceId="service"/> )
  fireEvent.click(await screen.findByRole('button',{name:'Reservar para mí'}))
  fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
  fireEvent.click(await screen.findByRole('button',{name:'09:00'}))
  expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Pérez')
  expect(screen.getByLabelText('WhatsApp')).toHaveValue('0981123456')
 })
})

describe('account contact safeguards',()=>{
 it('asks for missing contact fields and clears account-prefilled values after logout',async()=>{
  account.user={id:'u1',email:'ana@example.test',profile:{name:'Ana Pérez',phone:''}}
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes('?')?{slots:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}:{...info,professionalBookingAvailable:false,professionalSelection:'optional'}))))
  const view=render(<PublicBooking slug="store" initialServiceId="service"/> )
  fireEvent.click(await screen.findByRole('button',{name:'Reservar para mí'}))
  expect(screen.getByText(/Completá los campos faltantes/)).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
  fireEvent.click(await screen.findByRole('button',{name:'09:00'}))
  expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Pérez')
  expect(screen.getByLabelText('WhatsApp')).toHaveValue('')
  expect(screen.getByRole('button',{name:'Pedir el turno'})).toBeDisabled()
  account.user=null
  view.rerender(<PublicBooking slug="store" initialServiceId="service"/>)
  await waitFor(()=>expect(screen.getByLabelText('Nombre')).toHaveValue(''))
  expect(screen.queryByRole('button',{name:'Reservar para mí'})).not.toBeInTheDocument()
 })
})

describe('visible unavailable hours',()=>{
 it('strikes and disables unavailable times for a selected professional',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes('?')?{slots:[{startsAt:'2026-10-10T10:00:00Z',time:'10:00',professionalIds:['prof']}],unavailableSlots:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}:info))))
  render(<PublicBooking slug="store" initialServiceId="service"/> )
  fireEvent.click(await screen.findByRole('button',{name:'Ana'}))
  fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
  expect(await screen.findByRole('button',{name:'09:00 · No disponible'})).toBeDisabled()
  expect(screen.getByRole('button',{name:'10:00'})).toBeEnabled()
  expect(screen.getByText('Ana tiene 1 horario disponible para este día.')).toBeInTheDocument()
 })
})

it('shows disabled blocked hours when choosing any professional too',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes('?')?{slots:[],unavailableSlots:[{startsAt:'2026-10-10T09:00:00Z',time:'09:00'}]}:{...info,professionalSelection:'optional'}))))
 render(<PublicBooking slug="store" initialServiceId="service"/> )
 fireEvent.click(await screen.findByRole('button',{name:/Hoy/}))
 expect(await screen.findByRole('button',{name:'09:00 · No disponible'})).toBeDisabled()
})
