import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegalContent } from './LegalContent'
import { findPlaceholders } from '@/lib/legal/shared'
import {
  COOKIE_CONSENT_KEY,
  getCookieConsent,
  isAnalyticsAllowed,
  setCookieConsent,
} from '@/lib/consent/cookie-consent'

describe('LegalContent', () => {
  it('renderiza títulos, listas y negrita', () => {
    render(<LegalContent content={'## Datos\n\nTratamos **datos de contacto**.\n\n- Nombre\n- Email'} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Datos' })).toBeInTheDocument()
    expect(screen.getByText('datos de contacto').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('nunca interpreta HTML guardado en la base', () => {
    const { container } = render(<LegalContent content={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>')
  })
})

describe('findPlaceholders', () => {
  it('detecta los datos pendientes que bloquean la publicación', () => {
    expect(findPlaceholders('Razón social: [RAZÓN SOCIAL], RUC [RUC]. Contacto: [EMAIL de contacto]')).toEqual([
      '[RAZÓN SOCIAL]', '[RUC]', '[EMAIL de contacto]',
    ])
    expect(findPlaceholders('Texto completo sin pendientes.')).toEqual([])
  })
})

describe('cookie consent', () => {
  afterEach(() => localStorage.clear())

  it('sin elección se muestra el aviso y la analítica sigue activa', () => {
    expect(getCookieConsent()).toBeNull()
    expect(isAnalyticsAllowed()).toBe(true)
  })

  it('"Solo esenciales" desactiva la analítica y borra sus identificadores', () => {
    localStorage.setItem('site-analytics:vid', 'v1')
    localStorage.setItem('site-analytics:sid', 's1')
    setCookieConsent('essential')
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('essential')
    expect(isAnalyticsAllowed()).toBe(false)
    expect(localStorage.getItem('site-analytics:vid')).toBeNull()
    expect(localStorage.getItem('site-analytics:sid')).toBeNull()
  })

  it('"Aceptar" permite la analítica', () => {
    setCookieConsent('all')
    expect(isAnalyticsAllowed()).toBe(true)
  })
})
