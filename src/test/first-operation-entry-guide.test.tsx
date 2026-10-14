// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ guide: null as string | null }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => state.guide }) }))
import { FirstOperationEntryGuide } from '@/components/dashboard/onboarding/FirstOperationEntryGuide'
afterEach(() => { cleanup(); state.guide = null })
it('does not intrude on normal operations', () => {
  render(<FirstOperationEntryGuide kind="sale" />)
  expect(screen.queryByText('Cómo comenzar tu primera operación')).toBeNull()
})
it('opens only the requested operation guide', () => {
  state.guide = 'first-reservation'
  const { rerender } = render(<FirstOperationEntryGuide kind="sale" />)
  expect(screen.queryByText('Cómo comenzar tu primera operación')).toBeNull()
  rerender(<FirstOperationEntryGuide kind="reservation" />)
  expect(screen.getByText('Cómo comenzar tu primera operación')).toBeTruthy()
})
