import { describe, expect, it } from 'vitest'
import { isStartGuideComplete, type StartGuideTask } from '@/lib/onboarding/start-guide'

const task = (id: string, required: boolean, state: StartGuideTask['state']): StartGuideTask => ({ id, label: id, description: '', href: '/', required, state })

describe('isStartGuideComplete', () => {
  it('está lista con todo lo obligatorio comprobado, aunque falten opcionales', () => {
    const tasks = [task('basics', true, 'ready'), task('branch', true, 'ready'), task('website', false, 'unknown'), task('first-sale', false, 'pending')]
    expect(isStartGuideComplete({ tasks, completed: 2, total: 2 })).toBe(true)
  })
  it('no está lista si falta un paso obligatorio', () => {
    const tasks = [task('basics', true, 'ready'), task('catalog', true, 'pending')]
    expect(isStartGuideComplete({ tasks, completed: 1, total: 2 })).toBe(false)
  })
  it('no está lista si un obligatorio no se pudo comprobar', () => {
    expect(isStartGuideComplete({ tasks: [task('basics', true, 'unknown')], completed: 0, total: 1 })).toBe(false)
  })
  it('sin pasos obligatorios no se da por lista', () => {
    expect(isStartGuideComplete({ tasks: [], completed: 0, total: 0 })).toBe(false)
  })
})
