import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'
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
