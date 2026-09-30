import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegalContent, legalHeadings } from './LegalContent'
import { findPlaceholders, responsibleDataGaps, responsibleSection } from '@/lib/legal/shared'
import { DEFAULT_LEGAL_DOCUMENTS } from '@/lib/legal/defaults'
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

  /** El texto publicado en producción se veía con "# Título" suelto y párrafos en negrita. */
  it('un título es una sola línea aunque el párrafo siga sin línea en blanco', () => {
    const content = '# Términos y Condiciones de Uso\n\n**Última actualización:** 2026\n\nBienvenido.\n\n## 1. Objeto\nLa plataforma provee software.\n\n## 2. Cuentas\n- Datos verídicos\n- Credenciales propias'
    const { container } = render(<LegalContent content={content} title="Términos y Condiciones de Uso" />)

    expect(screen.getByRole('heading', { level: 2, name: '1. Objeto' })).toBeInTheDocument()
    expect(screen.getByText('La plataforma provee software.').tagName).toBe('P')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    // El título y la fecha ya los muestra la página.
    expect(container.textContent).not.toContain('# Términos')
    expect(container.textContent).not.toContain('Última actualización')
    expect(screen.getByRole('heading', { level: 2, name: '1. Objeto' })).toHaveAttribute('id', '1-objeto')
  })

  it('arma el índice con las secciones', () => {
    expect(legalHeadings('## 1. Datos\n\ntexto\n\n## 2. Derechos\n\ntexto').map((h) => h.text)).toEqual(['1. Datos', '2. Derechos'])
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

describe('responsable del documento', () => {
  it('avisa lo que falta y la sección sugerida bloquea hasta completarla', () => {
    expect(responsibleDataGaps('La plataforma opera como prestador tecnológico.')).toEqual(['razón social', 'RUC', 'domicilio', 'correo de contacto'])
    expect(responsibleDataGaps('Razón social: Mi Tienda SA. RUC 80012345-6. Domicilio: Asunción. hola@mitienda.com.py')).toEqual([])
    expect(findPlaceholders(responsibleSection('privacy'))).toHaveLength(4)
  })

  it('el texto base arranca sin "# Título" y con los títulos en su propia línea', () => {
    for (const document of Object.values(DEFAULT_LEGAL_DOCUMENTS)) {
      expect(document.content.startsWith('# ')).toBe(false)
      expect(document.content).not.toMatch(/^## [^\n]+\n[^\n]/m)
    }
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
