import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({refresh:vi.fn()}))
vi.mock('next/navigation',()=>{const router={refresh:state.refresh};return{useRouter:()=>router}})
import { SupportSessionBanner } from '@/components/superadmin/SupportSessionBanner'
const session=()=>({organizationName:'Empresa Demo',organizationSlug:'demo',reason:'Revisión solicitada',expiresAt:new Date(Date.now()+60000).toISOString()})
beforeEach(()=>state.refresh.mockClear())
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
describe('salida recuperable de soporte',()=>{
 it('muestra el fallo HTTP y permite reintentar sin refrescar como si hubiera cerrado',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,json:async()=>({error:'No se pudo cerrar'})}).mockResolvedValueOnce({ok:true,json:async()=>({success:true})})
  vi.stubGlobal('fetch',fetcher);render(<SupportSessionBanner session={session()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Salir de soporte'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar');expect(state.refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Salir de soporte'}));
  await waitFor(()=>expect(state.refresh).toHaveBeenCalledTimes(1));
 })
 it('recupera el botón después de un error de red',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));render(<SupportSessionBanner session={session()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Salir de soporte'}));
  expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Salir de soporte'})).toBeEnabled();
 })
 it('refresca una sola vez al vencer, aunque el layout no se desmonte inmediatamente',()=>{
  vi.useFakeTimers();render(<SupportSessionBanner session={{...session(),expiresAt:new Date(Date.now()+1000).toISOString()}}/>);
  act(()=>vi.advanceTimersByTime(5000));expect(state.refresh).toHaveBeenCalledTimes(1);
 })
})
