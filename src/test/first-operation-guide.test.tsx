// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FirstOperationGuide } from '@/components/dashboard/onboarding/FirstOperationGuide'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('illustrative demo never registers operations or makes API writes', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  render(<FirstOperationGuide kind="sale" />)
  fireEvent.click(screen.getByRole('button', { name: 'Ver demostración' }))
  expect(screen.getByText('Demostración: no registra operaciones')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente ejemplo' }))
  expect(fetch).not.toHaveBeenCalled()
})
it('a reservation is never described as a completed collection', () => {
  render(<FirstOperationGuide kind="reservation" />)
  expect(screen.getByText(/reservar no significa cobrar/i)).toBeTruthy()
})
