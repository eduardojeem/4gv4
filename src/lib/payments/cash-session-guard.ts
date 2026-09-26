export const OPEN_CASH_SESSION_REQUIRED = 'OPEN_CASH_SESSION_REQUIRED' as const

export type PaymentCashSessionState = 'idle' | 'checking' | 'open' | 'closed'

export function isOpenCashSessionRequired(value: unknown): boolean {
  const text = value instanceof Error
    ? value.message
    : JSON.stringify(value ?? '')

  return text.includes(OPEN_CASH_SESSION_REQUIRED)
    || text.includes('open_cash_session_not_found')
}
