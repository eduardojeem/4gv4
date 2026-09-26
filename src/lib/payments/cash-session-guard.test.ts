import { describe, expect, it } from 'vitest'

import { isOpenCashSessionRequired } from './cash-session-guard'

describe('isOpenCashSessionRequired', () => {
  it.each([
    { code: 'OPEN_CASH_SESSION_REQUIRED' },
    { error: 'OPEN_CASH_SESSION_REQUIRED' },
    new Error('open_cash_session_not_found'),
  ])('recognizes a closed-cash-session response', (value) => {
    expect(isOpenCashSessionRequired(value)).toBe(true)
  })

  it('does not classify unrelated validation errors as a closed cash session', () => {
    expect(isOpenCashSessionRequired({ error: 'validation_failed' })).toBe(false)
  })
})
