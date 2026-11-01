import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const control=vi.hoisted(()=>{const refresh=vi.fn();return {scope:'user:org',currentScope:{current:'user:org'},refresh,router:{refresh}}})
vi.mock('next/navigation',()=>({useRouter:()=>control.router}))
vi.mock('@/hooks/use-tenant-scope',()=>({useTenantScope:()=>({scope:control.scope,currentScope:control.currentScope})}))
import { BankTransferPayment } from './BankTransferPayment'
const bank={enabled:true,bankName:'Banco de prueba',accountHolder:'Titular de prueba',accountNumber:'123-test',accountAlias:'alias.test',currency:'PYG',instructions:'Usar la referencia de la solicitud.'}
const request={id:'r1',reference:'TR-TEST',plan_code:'pro',plan_name:'Pro',amount:200000,currency:'PYG',status:'awaiting_receipt',bank_snapshot:{...bank,bankName:'Banco de la solicitud'},created_at:'2026-10-18T12:00:00Z',operation_reference:null}
const payload=(requests:unknown[]=[])=>({settings:bank,plans:[{code:'pro',name:'Pro',price:200000,currency:'PYG'}],requests})
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{control.scope='user:org';control.currentScope.current='user:org';control.refresh.mockReset()})
afterEach(()=>vi.unstubAllGlobals())
it('does not fetch or show payment controls without billing authorization',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const {container}=render(<BankTransferPayment canPay={false}/>);expect(container).toBeEmptyDOMElement();expect(fetch).not.toHaveBeenCalled()
})
it('creates only the server-selected plan and displays the returned amount, bank snapshot and reference',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response(payload())).mockResolvedValueOnce(response({request:{...request,amount:210000}}));vi.stubGlobal('fetch',fetch)
 render(<BankTransferPayment canPay/>);await screen.findByText('Todavía no tenés solicitudes de transferencia.')
 fireEvent.change(screen.getByLabelText('Plan para un período mensual'),{target:{value:'pro'}})
 fireEvent.click(screen.getByRole('button',{name:'Generar solicitud de transferencia'}))
 await screen.findByText('TR-TEST')
 expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({planCode:'pro'})
 expect(screen.getByText('Banco de la solicitud')).toBeInTheDocument();expect(screen.queryByText('Banco de prueba')).not.toBeInTheDocument()
 expect(screen.getAllByText(/210[.\s]000/).length).toBeGreaterThan(0);expect(screen.getByText(/todavía no registra un pago/i)).toBeInTheDocument()
 expect(control.refresh).not.toHaveBeenCalled()
})
it('cancels an open request so another can be created',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response(payload([request]))).mockResolvedValueOnce(response({request:{...request,status:'cancelled'}}));vi.stubGlobal('fetch',fetch)
 render(<BankTransferPayment canPay/>);await screen.findByText('TR-TEST')
 fireEvent.click(screen.getByRole('button',{name:'Cancelar solicitud'}))
 await screen.findByText('Cancelada')
 expect(String(fetch.mock.calls[1][0]).endsWith('/cancel')).toBe(true)
 expect(screen.getByText(/Solicitud cancelada/)).toBeInTheDocument()
})
it('rejects an invalid or oversized receipt and uploads a valid receipt for review',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response(payload([request]))).mockResolvedValueOnce(response({request:{...request,status:'pending_review',receipt_path:'private/r1.pdf',operation_reference:'OP-123'}}));vi.stubGlobal('fetch',fetch)
 render(<BankTransferPayment canPay/>);await screen.findByText('TR-TEST')
 const input=screen.getByLabelText(/Comprobante \(JPEG/)
 fireEvent.change(input,{target:{files:[new File(['x'],'bad.txt',{type:'text/plain'})]}})
 expect(await screen.findByRole('alert')).toHaveTextContent('3 MB')
 const tooLarge=new File(['x'],'big.pdf',{type:'application/pdf'});Object.defineProperty(tooLarge,'size',{value:3*1024*1024+1})
 fireEvent.change(input,{target:{files:[tooLarge]}});expect(fetch).toHaveBeenCalledTimes(1)
 const valid=new File(['receipt'],'receipt.pdf',{type:'application/pdf'})
 fireEvent.change(input,{target:{files:[valid]}})
 expect(screen.getByRole('button',{name:'Enviar comprobante para revisión'})).toBeEnabled()
 fireEvent.change(screen.getByLabelText('Referencia de la operación bancaria (opcional)'),{target:{value:' OP-123 '}})
 fireEvent.click(screen.getByRole('button',{name:'Enviar comprobante para revisión'}))
 await screen.findByText('En revisión')
 const form=fetch.mock.calls[1][1].body as FormData
 expect(form.get('file')).toBe(valid);expect(form.get('operationReference')).toBe('OP-123')
 expect(fetch.mock.calls[1][1].headers).toBeUndefined();expect(control.refresh).not.toHaveBeenCalled()
 expect(screen.queryByRole('button',{name:'Enviar comprobante para revisión'})).not.toBeInTheDocument()
})
it('keeps rejected requests terminal and allows a new request; approved reload refreshes subscription',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response(payload([{...request,status:'rejected',rejection_reason:'Importe no identificado'}]))).mockResolvedValueOnce(response(payload([{...request,status:'approved',period_ends_at:'2026-11-18T12:00Z'}])));vi.stubGlobal('fetch',fetch)
 render(<BankTransferPayment canPay/>);await screen.findByText(/Importe no identificado/)
 expect(screen.queryByLabelText(/Comprobante \(JPEG/)).not.toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Plan para un período mensual'),{target:{value:'pro'}})
 expect(screen.getByRole('button',{name:'Generar solicitud de transferencia'})).toBeEnabled()
 fireEvent.click(screen.getByRole('button',{name:'Actualizar'}))
 await screen.findByText('Aprobada');expect(control.refresh).toHaveBeenCalledTimes(1)
})
it('shows load errors and permits retry, without inventing bank details',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({error:'Servicio no disponible'},503)).mockResolvedValueOnce(response({...payload(),settings:{...bank,enabled:false}}));vi.stubGlobal('fetch',fetch)
 render(<BankTransferPayment canPay/>);expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
 fireEvent.click(screen.getByRole('button',{name:'Actualizar'}))
 await screen.findByText('El pago por transferencia no está disponible en este momento.')
 expect(screen.queryByText('Banco de prueba')).not.toBeInTheDocument()
})
it('does not publish an earlier organization response after switching scope',async()=>{
 let finish!:(value:Response)=>void
 const fetch=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve})).mockResolvedValueOnce(response(payload()));vi.stubGlobal('fetch',fetch)
 const {rerender}=render(<BankTransferPayment canPay/>);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1))
 control.scope='user:other';control.currentScope.current='user:other';rerender(<BankTransferPayment canPay/>)
 await screen.findByText('Todavía no tenés solicitudes de transferencia.')
 await act(async()=>finish(response(payload([request]))))
 expect(screen.queryByText('TR-TEST')).not.toBeInTheDocument()
})

it('loads older requests when the server reports a paginated history',async()=>{
 const first={...request,status:'rejected'}
 const older={...request,id:'older',reference:'TR-OLDER',status:'approved'}
 const fetch=vi.fn().mockResolvedValueOnce(response({...payload([first]),pagination:{page:1,pageSize:25,total:26,hasMore:true}})).mockResolvedValueOnce(response({...payload([older]),pagination:{page:2,pageSize:25,total:26,hasMore:false}}))
 vi.stubGlobal('fetch',fetch);render(<BankTransferPayment canPay/>);await screen.findByText('TR-TEST')
 fireEvent.click(screen.getByRole('button',{name:'Ver solicitudes anteriores'}))
 await screen.findByText('TR-OLDER');expect(screen.getByText('TR-TEST')).toBeInTheDocument()
 expect(fetch.mock.calls[1][0]).toBe('/api/admin/subscriptions/transfers?page=2')
 expect(screen.queryByRole('button',{name:'Ver solicitudes anteriores'})).not.toBeInTheDocument()
})

it('requests an authorized short-lived receipt URL instead of using the private path directly',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response(payload([{...request,status:'pending_review',receipt_path:'private/org/r1.pdf'}]))).mockResolvedValueOnce(response({url:'https://storage.example.test/receipt?token=short'}))
 vi.stubGlobal('fetch',fetch);render(<BankTransferPayment canPay/>);await screen.findByText('TR-TEST')
 fireEvent.click(screen.getByRole('button',{name:'Consultar comprobante'}))
 const link=await screen.findByRole('link',{name:'Abrir comprobante'})
 expect(link).toHaveAttribute('href','https://storage.example.test/receipt?token=short')
 expect(link).toHaveAttribute('rel','noopener noreferrer')
 expect(fetch.mock.calls[1][0]).toBe('/api/admin/subscriptions/transfers/r1/receipt')
})
