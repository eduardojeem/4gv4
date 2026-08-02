import { describe, expect, it } from 'vitest'
import { validateGlobalNotification } from '@/lib/superadmin/notification-validation'

const validInput = {
  title: 'Mantenimiento',
  body: 'El sistema estara en mantenimiento.',
  type: 'warning',
  target: 'all',
  status: 'draft',
}

describe('validateGlobalNotification', () => {
  it('normalizes a valid draft', () => {
    expect(validateGlobalNotification({ ...validInput, title: '  Mantenimiento  ' })).toEqual({
      data: {
        title: 'Mantenimiento',
        body: validInput.body,
        type: 'warning',
        target: 'all',
        target_org_ids: null,
        status: 'draft',
        scheduled_at: null,
      },
      error: null,
    })
  })

  it('requires a date for scheduled notifications', () => {
    expect(validateGlobalNotification({ ...validInput, status: 'scheduled' })).toEqual({
      data: null,
      error: 'La fecha de programacion es obligatoria.',
    })
  })

  it('requires valid organization ids for a specific target', () => {
    expect(validateGlobalNotification({
      ...validInput,
      target: 'specific',
      target_org_ids: ['not-a-uuid'],
    })).toEqual({
      data: null,
      error: 'La lista de organizaciones contiene un identificador invalido.',
    })
  })
})
