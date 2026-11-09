import { describe, expect, it } from 'vitest'
import { summarizeTemplateUsage } from '@/lib/website/template-usage'
describe('template usage', () => {
 it('counts organizations once, excludes orphan settings, and separates missing and unknown selections', () => {
  const result = summarizeTemplateUsage(['a', 'b', 'c', 'd', 'e'], [
   { organization_id: 'a', value: { storefrontStyle: 'tech' } },
   { organization_id: 'a', value: { storefrontStyle: 'tech' } },
   { organization_id: 'b', value: { storefrontStyle: 'auto' } },
   { organization_id: 'c', value: { storefrontStyle: 'obsolete' } },
   { organization_id: 'd', value: {} },
   { organization_id: 'orphan', value: { storefrontStyle: 'tech' } },
  ])
  expect(result.counts.tech).toBe(1)
  expect(result.counts.auto).toBe(1)
  expect(result.counts.barber).toBe(0)
  expect(result.unconfigured).toBe(2)
  expect(result.unknown).toBe(1)
  expect(result.total).toBe(5)
 })
})
