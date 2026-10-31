import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePromotions } from '@/hooks/use-promotions'
import { toast } from 'sonner'
vi.mock('@/hooks/use-tenant-scope', () => { const currentScope={current:'user:org'};return {useTenantScope:()=>({scope:'user:org',currentScope})} })
vi.mock('sonner',()=>({toast:{error:vi.fn(),success:vi.fn()}}))
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.clearAllMocks()})
describe('disponibilidad del módulo de promociones',()=>{
 it.each([[402,'MODULE_NOT_ENTITLED','Tu plan no incluye el módulo de promociones.'],[403,'MODULE_DISABLED','El módulo de promociones está desactivado para esta organización.']])('muestra el motivo para %s sin fallo técnico',async(status,code,message)=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status,json:async()=>({code,error:'Module unavailable'})}))
  const {result}=renderHook(()=>usePromotions())
  await waitFor(()=>expect(result.current.loading).toBe(false))
  expect(result.current.error).toBe(message)
  expect(result.current.allPromotions).toEqual([])
  expect(log).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
 })
 it('vacía datos anteriores si el módulo deja de estar disponible',async()=>{
  vi.spyOn(console,'error').mockImplementation(()=>{})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({promotions:[{id:'one',name:'Test',code:'TEST',is_active:false}],pagination:{total:1}})}).mockResolvedValue({ok:false,status:402,json:async()=>({code:'MODULE_NOT_ENTITLED'})}))
  const {result}=renderHook(()=>usePromotions())
  await waitFor(()=>expect(result.current.allPromotions).toHaveLength(1))
  await act(async()=>{await result.current.fetchPromotions()})
  expect(result.current.allPromotions).toEqual([])
  expect(result.current.error).toBe('Tu plan no incluye el módulo de promociones.')
 })
 it.each([500,403])('mantiene visibles los errores técnicos o permisos inesperados %s',async status=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status,json:async()=>({code:'UNEXPECTED',error:'Failure'})}))
  const {result}=renderHook(()=>usePromotions())
  await waitFor(()=>expect(result.current.loading).toBe(false))
  expect(log).toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalled()
 })
})
