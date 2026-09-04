import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'

const state = vi.hoisted(() => ({ settings: {} as ReturnType<typeof getWebsiteSettingsDefaults>, refetch: vi.fn() }))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({ settings: state.settings, isLoading: false, error: null, isSaving: false, refetch: state.refetch }),
}))

beforeEach(() => {
  state.settings = getWebsiteSettingsDefaults()
  state.settings.company_info = { ...state.settings.company_info, name: 'Mi tienda', slug: 'mi-tienda', phone: '0981123456', whatsapp: '595981123456', storefrontPublic: false, marketplacePublic: false }
  state.settings.checkout.commerceMode = 'whatsapp'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))
})
afterEach(() => vi.unstubAllGlobals())

describe('company publication confirmation', () => {
  it('requires review and explicit confirmation before sending a publication request', async () => {
    render(<CompanyInfoForm />)
    expect(screen.getByRole('switch', { name: 'Alternar visualización de Visibilidad en Marketplace General' })).toBeDisabled()
    fireEvent.click(screen.getByRole('switch', { name: 'Alternar visualización de Publicar tienda' }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Revisar y publicar tienda')
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicación' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/sync-company', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('"publicationConfirmed":true'),
    })))
    const request = vi.mocked(fetch).mock.calls[0][1]
    expect(JSON.parse(String(request?.body))).toMatchObject({ storefrontPublic: true, marketplacePublic: false })
  })

  it('does not publish when the confirmation is canceled', async () => {
    render(<CompanyInfoForm />)
    fireEvent.click(screen.getByRole('switch', { name: 'Alternar visualización de Publicar tienda' }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a revisar' }))
    expect(fetch).not.toHaveBeenCalled()
  })
})
