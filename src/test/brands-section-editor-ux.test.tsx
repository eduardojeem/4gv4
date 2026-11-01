import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrandsSectionEditor } from '@/components/admin/website/BrandsSectionEditor'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
const state = vi.hoisted(() => ({ vertical: 'electronics', update: vi.fn(), settings: {} as ReturnType<typeof getWebsiteSettingsDefaults> }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useAdminWebsiteSettings: () => ({ settings: state.settings, isSaving: false, updateSetting: state.update }) }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ businessVertical: state.vertical }) }))
vi.mock('@/hooks/useWebsiteMediaQuota', () => ({ useWebsiteMediaQuota: () => ({ isAtLimit: false }) }))
vi.mock('@/components/admin/website/WebsiteMediaLibraryDialog', () => ({ WebsiteMediaLibraryDialog: () => null }))
vi.mock('@/components/admin/website/WebsiteMediaQuotaBanner', () => ({ WebsiteMediaQuotaBanner: () => null }))
beforeEach(() => {
 state.vertical = 'electronics'
 state.update.mockReset().mockResolvedValue({ success: true })
 state.settings = getWebsiteSettingsDefaults()
 state.settings.brands_section = { ...state.settings.brands_section!, enabled: false, items: [{id:'one', name:'Marca propia', active:true}, {id:'two', name:'Oculta', active:false}] }
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => ({ok:true, json:async () => String(url).includes('/api/brands') ? {success:true,data:[{id:'optica',name:'Óptica Central'}]} : {success:true,data:{products:[]}}})))
})
afterEach(() => vi.unstubAllGlobals())
describe('editor de marcas por rubro', () => {
 it('muestra solo activas en preview sin publicar ni guardar automáticamente', () => {
  render(<BrandsSectionEditor />)
  const preview = within(screen.getByRole('region',{name:'Vista previa de marcas'}))
  expect(preview.getByText('Marca propia')).toBeInTheDocument()
  expect(preview.queryByText('Oculta')).not.toBeInTheDocument()
  expect(preview.getByText('Desactivada: no se publica')).toBeInTheDocument()
  expect(state.update).not.toHaveBeenCalled()
  expect(screen.queryByRole('button',{name:/Nike/})).not.toBeInTheDocument()
 })
 it('busca marcas detectadas y permite recuperar el listado', async () => {
  render(<BrandsSectionEditor />)
  await screen.findByRole('button',{name:/Óptica Central/})
  fireEvent.change(screen.getByLabelText('Buscar marcas detectadas'),{target:{value:'otra'}})
  expect(screen.queryByRole('button',{name:/Óptica Central/})).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('No hay coincidencias')
  fireEvent.change(screen.getByLabelText('Buscar marcas detectadas'),{target:{value:'optica'}})
  expect(screen.getByRole('button',{name:/Óptica Central/})).toBeInTheDocument()
 })
 it('cancelar restablecimiento conserva la selección sin guardar', () => {
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<BrandsSectionEditor />)
  fireEvent.click(screen.getByRole('button',{name:'Restablecer sección'}))
  expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('logos, textos y ubicaciones'))
  expect(within(screen.getByRole('region',{name:'Vista previa de marcas'})).getByText('Marca propia')).toBeInTheDocument()
  expect(state.update).not.toHaveBeenCalled()
  confirmation.mockRestore()
 })
 it('conserva marcas ocultas y orden al guardar un cambio de título', async () => {
  render(<BrandsSectionEditor />)
  fireEvent.change(screen.getByLabelText(/Título de la sección/),{target:{value:'Nuestras marcas'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}))
  expect(state.update).toHaveBeenCalledWith('brands_section',expect.objectContaining({title:'Nuestras marcas',items:state.settings.brands_section!.items}))
 })
})
