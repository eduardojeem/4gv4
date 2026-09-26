/**
 * Tipo de negocio, movido de /admin/website a Configuración › Empresa.
 *
 * Lo que se movió es la ubicación, no el almacenamiento: sigue guardándose en
 * `website_settings.company_info`. El resto de Configuración persiste en
 * `system_settings`, otra tabla; si este campo se hubiera mudado también de
 * store, se guardaría donde ni el onboarding ni el sitio público lo leen.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

const updateSetting = vi.fn()

let hookState: {
  settings: WebsiteSettings | null
  isLoading: boolean
  error: string | null
  isSaving: boolean
}

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({ ...hookState, updateSetting, refetch: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { BusinessTypeCard } from '@/components/admin/settings/BusinessTypeCard'

function settingsWith(companyInfo: Partial<WebsiteSettings['company_info']>): WebsiteSettings {
  const base = getWebsiteSettingsDefaults()
  return { ...base, company_info: { ...base.company_info, ...companyInfo } }
}

describe('BusinessTypeCard', () => {
  beforeAll(() => {
    // Radix Select no abre en jsdom sin estas APIs de puntero.
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    updateSetting.mockResolvedValue({ success: true })
    hookState = {
      settings: settingsWith({ businessType: 'retail', name: 'Mi Empresa', phone: '0981' }),
      isLoading: false,
      error: null,
      isSaving: false,
    }
  })

  it('muestra el tipo de negocio ya guardado', () => {
    render(<BusinessTypeCard />)

    expect(screen.getByText('Minorista (tienda física)')).toBeInTheDocument()
  })

  it('guarda en company_info, no en otra clave', async () => {
    render(<BusinessTypeCard />)

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByText('Reparaciones técnicas'))
    fireEvent.click(screen.getByRole('button', { name: /Guardar tipo de negocio/i }))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))
    expect(updateSetting.mock.calls[0][0]).toBe('company_info')
    expect(updateSetting.mock.calls[0][1].businessType).toBe('repair')
  })

  it('conserva el resto de los datos de la empresa al guardar', async () => {
    // El PUT reemplaza company_info entero: si solo se mandara businessType,
    // guardar el rubro borraria el nombre, el telefono y todo lo demas.
    render(<BusinessTypeCard />)

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByText('Mayorista / distribución'))
    fireEvent.click(screen.getByRole('button', { name: /Guardar tipo de negocio/i }))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))
    const saved = updateSetting.mock.calls[0][1]
    expect(saved.name).toBe('Mi Empresa')
    expect(saved.phone).toBe('0981')
  })

  it('el botón queda inhabilitado hasta que haya un cambio real', async () => {
    render(<BusinessTypeCard />)

    const save = screen.getByRole('button', { name: /Guardar tipo de negocio/i })
    expect(save).toBeDisabled()

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByText('Servicios profesionales'))

    await waitFor(() => expect(save).toBeEnabled())
  })

  it('funciona con una empresa que todavía no eligió rubro', () => {
    hookState.settings = settingsWith({ businessType: '' })

    render(<BusinessTypeCard />)

    expect(screen.getByText('Seleccionar...')).toBeInTheDocument()
  })

  it('avisa en vez de romper si no se pueden cargar los datos', () => {
    hookState = { settings: null, isLoading: false, error: '403 Forbidden', isSaving: false }

    render(<BusinessTypeCard />)

    expect(screen.getByText(/No se pudo cargar el tipo de negocio/i)).toBeInTheDocument()
  })
})
