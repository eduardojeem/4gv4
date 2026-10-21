import { describe, expect, it } from 'vitest'
import { importCostPayload } from './import-cost-payload'
describe('CSV cost write contract',()=>{
 it('omits absent cost for both create and update without write permission',()=>{expect(importCostPayload(undefined,false)).toEqual({})})
 it('rejects an explicit cost including zero without permission before constructing a mutation',()=>{
  expect(()=>importCostPayload(0,false)).toThrow('No tenés permiso para importar costos')
  expect(()=>importCostPayload(500,false)).toThrow('No tenés permiso para importar costos')
 })
 it('preserves legitimate zero and omits absent cost with write permission',()=>{
  expect(importCostPayload(0,true)).toEqual({purchase_price:0})
  expect(importCostPayload(500,true)).toEqual({purchase_price:500})
  expect(importCostPayload(undefined,true)).toEqual({})
 })
})
