import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/contexts/theme-context'
import { PanelAppearanceSettings } from '@/components/admin/settings/PanelAppearanceSettings'

beforeEach(() => {
  vi.mocked(localStorage.getItem).mockReturnValue(null)
})
it('combina paleta, acabado y modo y permite restablecerlos', () => {
  render(<ThemeProvider><PanelAppearanceSettings /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: /Violeta/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Con color/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Modo oscuro/ }))
  expect(document.documentElement).toHaveAttribute('data-color-scheme', 'purple')
  expect(document.documentElement).toHaveAttribute('data-panel-style', 'tinted')
  expect(document.documentElement).toHaveClass('dark')
  expect(screen.getByRole('status')).toHaveTextContent('Violeta · Con color · Oscuro')
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer apariencia' }))
  expect(document.documentElement).toHaveAttribute('data-color-scheme', 'blue')
  expect(document.documentElement).toHaveAttribute('data-panel-style', 'neutral')
  expect(document.documentElement).toHaveClass('light')
})
it('la vista previa indica que son ejemplos y abre un diálogo', () => {
  render(<ThemeProvider><PanelAppearanceSettings /></ThemeProvider>)
  expect(screen.getByText(/no son datos reales del negocio/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Probar un diálogo' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Así se verá un diálogo')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar ejemplo' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
