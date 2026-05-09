import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/contexts/theme-context'

function ThemeProbe() {
  const { theme, isDark } = useTheme()

  return <div data-testid="theme-state">{`${theme}:${isDark ? 'dark' : 'light'}`}</div>
}

describe('ThemeProvider legacy admin theme sync', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-color-scheme')
  })

  it('migrates admin dark mode into the shared theme state', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'admin-dark-mode') return 'true'
      return null
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-state')).toHaveTextContent('dark:dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('admin-dark-mode')
  })

  it('keeps the saved shared theme when the legacy admin key still exists', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'theme') return 'light'
      if (key === 'admin-dark-mode') return 'true'
      return null
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-state')).toHaveTextContent('light:light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('admin-dark-mode')
  })
})
