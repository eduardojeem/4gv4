import { act, cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallPrompt } from '@/components/pwa/install-prompt'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('hidratacion de instalacion', () => {
  it('oculta el boton en SSR, lo muestra en iPhone y lo quita al instalar', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('iPhone')
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    expect(renderToString(<InstallPrompt variant="icon" />)).toBe('')
    render(<InstallPrompt variant="icon" />)
    expect(screen.getByRole('button', { name: 'Instalar app' })).toBeTruthy()
    act(() => window.dispatchEvent(new Event('appinstalled')))
    expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull()
  })

  it('no ofrece instalar si ya esta en modo standalone', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('iPhone')
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    render(<InstallPrompt variant="icon" />)
    expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull()
  })
})
