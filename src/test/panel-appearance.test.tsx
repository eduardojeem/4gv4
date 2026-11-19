import { fireEvent, render, screen, act } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from '@/contexts/theme-context'

function Probe() {
  const theme = useTheme()
  return <><output>{theme.theme}:{theme.colorScheme}:{theme.panelStyle}</output><button onClick={() => theme.setPanelStyle('tinted')}>Con color</button><button onClick={theme.resetAppearance}>Restablecer</button><button onClick={() => theme.setCustomPalette?.({ primary: '#123456', accent: '#abcdef' })}>Preparar paleta</button><button onClick={() => theme.setColorScheme('custom')}>Activar paleta</button><button onClick={() => theme.setCustomPalette?.({ primary: '#654321' })}>Reemplazar paleta</button></>
}
beforeEach(() => {
  vi.mocked(localStorage.getItem).mockReturnValue(null)
  vi.mocked(localStorage.setItem).mockImplementation(() => {})
})
it('aplica el acabado al instante y lo conserva como preferencia local', () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  fireEvent.click(screen.getByText('Con color'))
  expect(document.documentElement).toHaveAttribute('data-panel-style', 'tinted')
  expect(localStorage.setItem).toHaveBeenCalledWith('panelStyle', 'tinted')
})
it('restablece modo, paleta y acabado sin cambiar datos de la empresa', () => {
  vi.mocked(localStorage.getItem).mockImplementation(key => ({ theme: 'dark', colorScheme: 'purple', panelStyle: 'contrast' })[key as 'theme'] ?? null)
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('dark:purple:contrast')
  fireEvent.click(screen.getByText('Restablecer'))
  expect(screen.getByRole('status')).toHaveTextContent('light:blue:neutral')
})
it('sigue funcionando cuando el navegador bloquea el almacenamiento', () => {
  vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('Bloqueado') })
  vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Bloqueado') })
  expect(() => render(<ThemeProvider><Probe /></ThemeProvider>)).not.toThrow()
})
it('descarta preferencias dañadas y sincroniza el cambio entre pestañas', () => {
  vi.mocked(localStorage.getItem).mockReturnValue('invalido')
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('light:blue:neutral')
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'panelStyle', newValue: 'contrast' })))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' })))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'colorScheme', newValue: 'green' })))
  expect(document.documentElement).toHaveAttribute('data-panel-style', 'contrast')
  expect(screen.getByRole('status')).toHaveTextContent('dark:green:contrast')
})
it('una paleta personalizada no pisa un esquema activo y no deja colores obsoletos', () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  fireEvent.click(screen.getByText('Preparar paleta'))
  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('')
  fireEvent.click(screen.getByText('Activar paleta'))
  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#123456')
  expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#abcdef')
  fireEvent.click(screen.getByText('Reemplazar paleta'))
  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#654321')
  expect(document.documentElement.style.getPropertyValue('--accent')).toBe('')
})
