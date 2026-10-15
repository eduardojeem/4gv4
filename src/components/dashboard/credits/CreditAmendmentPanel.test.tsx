import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreditAmendmentPanel } from './CreditAmendmentPanel'
import type { CreditAmendmentState } from '@/lib/credits/amendment-contract'

vi.mock('sonner',()=>({toast:{success:vi.fn()}}))
const creditId='00000000-0000-4000-8000-000000000001'
const installmentId='00000000-0000-4000-8000-000000000002'
let state:CreditAmendmentState
const fetchMock=vi.fn()
beforeEach(()=>{
  state={version:'a'.repeat(32),timeZone:'America/Asuncion',fractionDigits:0,credit:{id:creditId,principal:1000,interest_rate:0,term_months:1,status:'active'},
    installments:[{id:installmentId,installment_number:1,due_date:'2026-11-01T15:00:00Z',amount:1000,amount_paid:200,principal_component:1000,interest_component:0,status:'pending'}],
    payments:[{id:creditId,amount:200,created_at:'2026-10-14T13:00:00Z',payment_method:'cash'}],history:[]}
  fetchMock.mockReset();fetchMock.mockImplementation(async()=>({ok:true,json:async()=>({success:true,data:state})}))
  vi.stubGlobal('fetch',fetchMock)
})
afterEach(()=>vi.unstubAllGlobals())
describe('credit amendment editor',()=>{
  it('locks complete terms once payments exist and requires a reason before sending edits',async()=>{
    render(<CreditAmendmentPanel creditId={creditId}/>)
    await screen.findByLabelText('Qué querés corregir')
    expect(screen.getByRole('option',{name:'Condiciones completas (sin pagos)'})).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Cuota 1 · pendiente/),{target:{value:'2026-12-01'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar corrección'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('motivo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('submits changed pending dates, version and reason, then refreshes the consumer',async()=>{
    const updated=vi.fn()
    render(<CreditAmendmentPanel creditId={creditId} onUpdated={updated}/>)
    fireEvent.change(await screen.findByLabelText(/Cuota 1 · pendiente/),{target:{value:'2026-12-01'}})
    fireEvent.change(screen.getByLabelText('Motivo obligatorio'),{target:{value:'Acuerdo con el cliente'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar corrección'}))
    await waitFor(()=>expect(updated).toHaveBeenCalledTimes(1))
    const call=fetchMock.mock.calls.find(([,options])=>options?.method==='PATCH')
    expect(JSON.parse(call![1].body)).toEqual({creditId,expectedVersion:state.version,reason:'Acuerdo con el cliente',action:'reschedule',installments:[{id:installmentId,dueDate:'2026-12-01'}]})
  })
  it('shows conflicts without claiming success or refreshing away the error',async()=>{
    fetchMock.mockImplementation(async(_url:string,options?:RequestInit)=>({ok:!options?.method,json:async()=>options?.method?{success:false,error:'El crédito cambió mientras lo editabas.'}:{success:true,data:state}}))
    const updated=vi.fn()
    render(<CreditAmendmentPanel creditId={creditId} onUpdated={updated}/>)
    fireEvent.change(await screen.findByLabelText(/Cuota 1 · pendiente/),{target:{value:'2026-12-01'}})
    fireEvent.change(screen.getByLabelText('Motivo obligatorio'),{target:{value:'Acuerdo con el cliente'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar corrección'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('El crédito cambió')
    expect(updated).not.toHaveBeenCalled()
  })
})
