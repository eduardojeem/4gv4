import { describe, expect, it } from 'vitest'
import {
  REPAIRS_GUIDE_VERSION,
  getRepairGuideTracks,
  repairsGuide,
  searchRepairGuide,
} from './repairs-guide'

describe('repairs guide content', () => {
  it('exposes a versioned guide with the two approved tracks', () => {
    expect(REPAIRS_GUIDE_VERSION).toMatch(/^\d+\.\d+$/)
    expect(getRepairGuideTracks('admin').map(track => track.id)).toEqual([
      'daily-work',
      'admin-payments',
    ])
  })

  it('finds actions using normalized keywords', () => {
    expect(searchRepairGuide('abrir caja', 'operator')[0]?.id).toBe('open-cash-register')
    expect(searchRepairGuide('credito y cuotas', 'admin')[0]?.id).toBe('finance-balance')
  })

  it('filters administrative audit content by audience', () => {
    const technicianTasks = getRepairGuideTracks('technician').flatMap(track => track.tasks)
    const adminTasks = getRepairGuideTracks('admin').flatMap(track => track.tasks)

    expect(technicianTasks).not.toContainEqual(expect.objectContaining({ id: 'audit-payments' }))
    expect(adminTasks).toContainEqual(expect.objectContaining({ id: 'audit-payments' }))
  })

  it('provides a fallback for every contextual step', () => {
    const steps = getRepairGuideTracks('admin').flatMap(track => track.tasks.flatMap(task => task.steps))
    expect(steps.length).toBeGreaterThan(0)
    expect(steps.every(step => step.fallback.trim().length > 0)).toBe(true)
  })

  it('declares an executable transition from the new repair button into the form', () => {
    const createTask = repairsGuide.tracks
      .flatMap(track => track.tasks)
      .find(task => task.id === 'create-repair')

    expect(createTask?.steps[0].navigationAction).toEqual({
      id: 'open-new-repair',
      label: 'Abrir nueva reparación',
      successAnchorId: 'repair-form-device',
    })

    const actions = repairsGuide.tracks
      .flatMap(track => track.tasks)
      .flatMap(task => task.steps)
      .flatMap(step => step.navigationAction ? [step.navigationAction] : [])
    expect(actions.every(action => action.label.trim().length > 0)).toBe(true)
  })
})
