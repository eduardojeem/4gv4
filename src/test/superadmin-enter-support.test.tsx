import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({refresh:vi.fn(),success:vi.fn()}))
vi.mock('next/navigation',()=>{const router={refresh:state.refresh};return{useRouter:()=>router}})
vi.mock('sonner',()=>({toast:{success:state.success}}))
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
beforeEach(()=>{state.refresh.mockClear();state.success.mockClear()})
function open(){render(<EnterSupportButton organizationId="org-a" organizationName="Empresa Demo"/>);fireEvent.click(screen.getByRole('button',{name:'Modo soporte'}))}
describe('inicio de soporte sin accesos nuevos',()=>{
 it('exige motivo y comunica que se conserva la cuenta de superadmin',()=>{
  open();expect(screen.getByRole('button',{name:'Iniciar sesión de soporte'})).toBeDisabled();
  expect(screen.getByText(/Seguís usando tu cuenta y tus permisos de superadministrador/)).toBeInTheDocument();
 })
 it('inicia una vez con motivo recortado y organización explícita',async()=>{
  let resolve: (value: unknown)=>void=()=>{};const fetcher=vi.fn((_url: string, _init: {body:string})=>new Promise(done=>{resolve=done}));vi.stubGlobal('fetch',fetcher);open();
  fireEvent.change(screen.getByLabelText('Motivo del acceso'),{target:{value:'  Diagnóstico solicitado  '}});
  const button=screen.getByRole('button',{name:'Iniciar sesión de soporte'});fireEvent.click(button);fireEvent.click(button);
  expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({organizationId:'org-a',reason:'Diagnóstico solicitado'});
  resolve({ok:true,json:async()=>({session:{id:'new-session'}})});
  await waitFor(()=>expect(state.refresh).toHaveBeenCalledTimes(1));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 })
 it('preserva el motivo y permite reintentar cuando falla la conexión',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));open();fireEvent.change(screen.getByLabelText('Motivo del acceso'),{target:{value:'Diagnóstico solicitado'}});
  fireEvent.click(screen.getByRole('button',{name:'Iniciar sesión de soporte'}));expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Motivo del acceso')).toHaveValue('Diagnóstico solicitado');expect(screen.getByRole('button',{name:'Iniciar sesión de soporte'})).toBeEnabled();
 })
})
