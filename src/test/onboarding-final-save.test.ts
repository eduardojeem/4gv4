import { afterEach, describe, expect, it, vi } from 'vitest'
import { persistSharedDraft } from '@/lib/onboarding/submit-shared-draft'
import { createInitialOnboardingState } from '@/lib/onboarding/shared-setup'
afterEach(()=>vi.unstubAllGlobals())
describe('Guardado del borrador compartido',()=>{
 it('encadena revisiones y solo escribe los pasos al invocarlo explícitamente',async()=>{
  const request=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({revision:2})}).mockResolvedValueOnce({ok:true,json:async()=>({revision:3})}).mockResolvedValueOnce({ok:true,json:async()=>({revision:4})});vi.stubGlobal('fetch',request)
  const revisions=vi.fn();await expect(persistSharedDraft(createInitialOnboardingState({plan:'pro',businessName:'Demo'}),['pos'],1,revisions)).resolves.toBe(4)
  expect(request.mock.calls.map(c=>JSON.parse(c[1].body).expectedRevision)).toEqual([1,2,3])
  expect(revisions.mock.calls.flat()).toEqual([2,3,4])
 })
 it('si falla un paso, detiene el guardado y conserva la revisión confirmada',async()=>{
  const request=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({revision:2})}).mockResolvedValueOnce({ok:false,status:500,json:async()=>({error:'No se pudo guardar la sucursal'})});vi.stubGlobal('fetch',request)
  const revisions=vi.fn();await expect(persistSharedDraft(createInitialOnboardingState({plan:'pro',businessName:'Demo'}),['pos'],1,revisions)).rejects.toThrow('No se pudo guardar la sucursal')
  expect(request).toHaveBeenCalledTimes(2);expect(revisions).toHaveBeenCalledWith(2)
 })
})
