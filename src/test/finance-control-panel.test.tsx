import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {controlFixture} from './fixtures/finance-control'
const state=vi.hoisted(()=>({data:null as unknown,mutate:vi.fn()}))
vi.mock('swr',()=>({default:()=>({data:state.data,error:null,isLoading:false,mutate:state.mutate})}))
vi.mock('next/dynamic',()=>({default:()=>()=>null}))
import {FinanceControlPanel} from '@/components/admin/finances/FinanceControlPanel'
const renderPanel=()=>{const report=controlFixture();return render(<FinanceControlPanel organizationId={report.organizationId} filters={report.filters}/>)}
beforeEach(()=>{state.data=controlFixture();state.mutate.mockClear()})
afterEach(()=>{vi.unstubAllGlobals()})
describe('finance control user flows',()=>{
 it('shows actual source lines and a forecast without inventing available cash',async()=>{const user=userEvent.setup();renderPanel();expect(screen.getByText('Venta de prueba')).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Proyección',exact:true}));expect(screen.getByText(/Saldo bancario disponible: no verificado/)).toBeInTheDocument();expect(screen.getByText(/Alquiler/)).toBeInTheDocument()})
 it('disables writes and explains the missing migration',async()=>{state.data={...controlFixture(),persistenceAvailable:false};const user=userEvent.setup();renderPanel();await user.click(screen.getByRole('button',{name:'Presupuestos',exact:true}));expect(screen.getByRole('button',{name:'Editar límites'})).toBeDisabled();expect(screen.getByText(/necesitan habilitar la migración/)).toBeInTheDocument()})
 it('uses the same request key when retrying an uncertain closure',async()=>{const fetcher=vi.fn().mockRejectedValueOnce(new Error('Conexión interrumpida')).mockResolvedValueOnce({ok:true,json:async()=>({saved:{id:'closed'}})});vi.stubGlobal('fetch',fetcher);const user=userEvent.setup();renderPanel();await user.click(screen.getByRole('button',{name:'Cierre mensual',exact:true}));await user.type(screen.getByLabelText('Motivo del cierre'),'Revisión del mes');const button=screen.getByRole('button',{name:'Guardar nueva versión del cierre'});await user.click(button);await screen.findByText('Conexión interrumpida');await user.click(screen.getByRole('button',{name:'Recuperar guardado pendiente'}));await screen.findByText(/Cierre guardado con autor/);expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].headers['x-idempotency-key']).toBe(fetcher.mock.calls[1][1].headers['x-idempotency-key']);expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body)})
})
