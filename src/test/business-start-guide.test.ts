import { describe, expect, it } from 'vitest'
import { evaluateStartGuide, type StartGuideEvidence, type StartGuidePreferences } from '@/lib/onboarding/start-guide'

const preferences: StartGuidePreferences = { version: 1, teamMode: 'solo', postponed: false }
const base: StartGuideEvidence = {
  businessVertical: 'general', operatingModel: 'retail', effectiveModules: ['pos', 'inventory', 'services', 'repairs'],
  permissions: ['settings.manage', 'products.create', 'services.manage', 'repairs.orders.create', 'pos.sales.create'],
  basics: true, activeBranch: true, sellableProduct: false, activeService: false, serviceAvailability: false, teamConfigured: false,
  firstSale: false, firstReservation: false, firstService: false, firstRepair: false, firstCollection: false,
}
describe('business start guide', () => {
  it('retail points to persisted product preparation, not a website requirement', () => {
    const result = evaluateStartGuide(base, preferences)
    expect(result.nextTaskId).toBe('catalog')
    expect(result.tasks.find(task => task.id === 'catalog')?.state).toBe('pending')
    expect(result.tasks.some(task => task.id === 'website' && task.required)).toBe(false)
  })
  it('service requires service and availability, never stock', () => {
    const result = evaluateStartGuide({ ...base, businessVertical: 'beauty_services', operatingModel: 'service', activeService: true, serviceAvailability: true }, preferences)
    expect(result.tasks.some(task => task.id === 'catalog')).toBe(false)
    expect(result.tasks.find(task => task.id === 'service')?.state).toBe('ready')
    expect(result.tasks.find(task => task.id === 'availability')?.state).toBe('ready')
  })
  it('repair reception is independent of collection', () => {
    const result = evaluateStartGuide({ ...base, operatingModel: 'repair', firstRepair: true }, preferences)
    expect(result.operationMilestones.repair).toBe(true)
    expect(result.operationMilestones.collection).toBe(false)
    expect(result.tasks.some(task => task.id === 'catalog' && task.required)).toBe(false)
  })
  it('a reservation never completes service or collection', () => {
    const result = evaluateStartGuide({ ...base, operatingModel: 'service', firstReservation: true }, preferences)
    expect(result.operationMilestones.reservation).toBe(true)
    expect(result.operationMilestones.service).toBe(false)
    expect(result.operationMilestones.collection).toBe(false)
  })
  it('a completed credit sale does not imply collection', () => {
    const result = evaluateStartGuide({ ...base, firstSale: true }, preferences)
    expect(result.operationMilestones.sale).toBe(true)
    expect(result.operationMilestones.collection).toBe(false)
  })
  it('unknown evidence cannot complete a task', () => {
    const result = evaluateStartGuide({ ...base, sellableProduct: null }, preferences)
    expect(result.tasks.find(task => task.id === 'catalog')?.state).toBe('unknown')
    expect(result.completed).toBe(2)
  })
  it('mixed only includes available channels', () => {
    const result = evaluateStartGuide({ ...base, operatingModel: 'mixed', effectiveModules: ['pos', 'inventory'] }, preferences)
    expect(result.tasks.some(task => task.id === 'service')).toBe(false)
    expect(result.tasks.some(task => task.id === 'catalog')).toBe(true)
  })
  it('solo does not require employees; team mode does', () => {
    expect(evaluateStartGuide(base, preferences).tasks.some(task => task.id === 'team')).toBe(false)
    expect(evaluateStartGuide({ ...base, permissions: [...base.permissions, 'users.manage'] }, { ...preferences, teamMode: 'team' }).tasks.find(task => task.id === 'team')?.state).toBe('pending')
  })
  it('inaccessible actions are not exposed', () => {
    expect(evaluateStartGuide({ ...base, permissions: [] }, preferences).tasks).toEqual([])
  })
  it('postponement does not change computed progress', () => {
    const result = evaluateStartGuide(base, preferences)
    expect(evaluateStartGuide(base, { ...preferences, postponed: true })).toEqual(result)
  })
  it('optional team and website tasks do not inflate readiness', () => {
    const result = evaluateStartGuide({ ...base, sellableProduct: true, permissions: [...base.permissions, 'users.manage'], effectiveModules: [...base.effectiveModules, 'ecommerce'] }, { ...preferences, teamMode: 'team' })
    expect(result.completed).toBe(3)
    expect(result.total).toBe(3)
    expect(result.nextTaskId).toBe('team')
  })
})
