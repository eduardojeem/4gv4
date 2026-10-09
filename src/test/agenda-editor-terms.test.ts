import { expect,it } from 'vitest'
import { editorServiceTerms } from '@/lib/agenda/editor-terms'
it('preserves a moved appointment snapshot and derives accepted changes from professional terms',()=>{
  const service={product_id:'s',price:30000,duration_minutes:30,buffer_minutes:0}
  const rates=[{product_id:'s',professional_id:'p',price:40000,duration_minutes:45,buffer_minutes:5}]
  const original={service_product_id:'s',professional_id:'p',price:0,starts_at:'2026-10-10T09:00:00Z',ends_at:'2026-10-10T09:20:00Z',buffer_minutes:2}
  expect(editorServiceTerms(service,'p',rates,original)).toEqual({price:0,durationMinutes:20,bufferMinutes:2})
  expect(editorServiceTerms(service,'p',rates,null)).toEqual({price:40000,durationMinutes:45,bufferMinutes:5})
})
