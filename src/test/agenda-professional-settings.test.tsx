import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { ProfessionalScheduleEditor } from '@/components/dashboard/agenda/ProfessionalScheduleEditor'
import { ProfessionalRatesEditor } from '@/components/dashboard/agenda/ProfessionalRatesEditor'
import { TimeOffEditor } from '@/components/dashboard/agenda/TimeOffEditor'
const toast=vi.hoisted(()=>({success:vi.fn(),error:vi.fn()}))
vi.mock('sonner',()=>({toast}))
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks()})
const professional={id:'prof',name:'Ana',color:'#000000',phone:null,is_active:true,sort_order:0}
const services=[{product_id:'service',name:'Corte',price:30000,duration_minutes:30,online:true,configured:true,hide_price:false}]
describe('professional settings editors',()=>{
  it('distinguishes inherited hours from all days closed',async()=>{
    const save=vi.fn(async()=>true)
    render(<ProfessionalScheduleEditor name="Ana" value={null} onSave={save}/>)
    const inherit=screen.getByRole('checkbox',{name:'Heredar horario de la tienda'})
    expect(inherit).toBeChecked()
    fireEvent.click(inherit)
    fireEvent.click(screen.getByRole('button',{name:'Guardar horario'}))
    await waitFor(()=>expect(save).toHaveBeenCalledWith({}))
  })
  it('sends explicit zero and then a blank inherited price as null',async()=>{
    const fetchMock=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify({ok:true})))
    vi.stubGlobal('fetch',fetchMock)
    render(<ProfessionalRatesEditor professional={professional} services={services} rates={[]} currency="PYG" onSaved={vi.fn()}/>)
    fireEvent.change(screen.getByLabelText('Precio de Corte'),{target:{value:'0'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar tarifas'}))
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).rates[0].price).toBe(0)
    await waitFor(()=>expect(screen.getByRole('button',{name:'Guardar tarifas'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Precio de Corte'),{target:{value:''}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar tarifas'}))
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).rates[0].price).toBeNull()
  })
  it('does not report success when saving fails',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Sin permiso'}),{status:403})))
    const onSaved=vi.fn()
    render(<ProfessionalRatesEditor professional={professional} services={services} rates={[]} currency="PYG" onSaved={onSaved}/>)
    fireEvent.click(screen.getByRole('button',{name:'Guardar tarifas'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso')
    expect(onSaved).not.toHaveBeenCalled();expect(toast.success).not.toHaveBeenCalled()
  })
  it('shows conflicting bookings and does not allow creating the absence',async()=>{
    const fetchMock=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify(String(input).includes('?')?{conflicts:[{id:'appointment',customer_name:'Cliente afectado',service_name:'Corte',starts_at:'2026-10-10T09:00:00Z'}],total:1}:{blocks:[]})))
    vi.stubGlobal('fetch',fetchMock)
    render(<TimeOffEditor professionals={[professional]} timeZone="UTC"/>)
    fireEvent.change(screen.getByLabelText('Inicio de la ausencia'),{target:{value:'2026-10-10T09:00'}})
    fireEvent.change(screen.getByLabelText('Fin de la ausencia'),{target:{value:'2026-10-10T10:00'}})
    fireEvent.click(screen.getByRole('button',{name:'Revisar turnos afectados'}))
    expect(await screen.findByText(/Cliente afectado/)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Guardar ausencia'})).toBeDisabled()
    expect(fetchMock.mock.calls.every(([,init])=>!init?.method || init.method==='GET')).toBe(true)
  })
})
