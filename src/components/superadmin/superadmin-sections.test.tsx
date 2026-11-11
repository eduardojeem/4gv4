import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/superadmin/test',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AnnouncementsPanel } from './communications/AnnouncementsPanel'
import { SettingsCenter, type PlatformSettingsData } from './settings/SettingsCenter'
import type { Announcement } from '@/lib/superadmin/communications'

const announcement = (overrides: Partial<Announcement>): Announcement => ({
  id: 'a1', title: 'Aviso', body: 'Cuerpo', type: 'info', target: 'all', targetOrgIds: [], status: 'sent',
  scheduledAt: null, sentAt: '2026-09-20T10:00:00Z', createdAt: '2026-09-20T09:00:00Z', readCount: 3, dismissedCount: 1,
  ...overrides,
})

describe('AnnouncementsPanel', () => {
  const items = [
    announcement({ id: 'a1', title: 'Mantenimiento', status: 'sent' }),
    announcement({ id: 'a2', title: 'Promo futura', status: 'scheduled', scheduledAt: '2026-10-01T10:00:00Z', sentAt: null }),
    announcement({ id: 'a3', title: 'Idea', status: 'draft', sentAt: null, target: 'specific', targetOrgIds: ['o1'] }),
  ]

  it('filtra por estado y por texto, mostrando el destino y las lecturas', () => {
    render(<AnnouncementsPanel announcements={items} organizations={[{ id: 'o1', name: 'Tienda Uno' }]} />)
    expect(screen.getByText(/3 lecturas/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Programados/ }))
    expect(screen.getByText('Promo futura')).toBeInTheDocument()
    expect(screen.queryByText('Mantenimiento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Todos/ }))
    fireEvent.change(screen.getByLabelText('Buscar aviso'), { target: { value: 'idea' } })
    expect(screen.getByText('Idea')).toBeInTheDocument()
    expect(screen.getByText(/Tienda Uno/)).toBeInTheDocument()
  })

  it('no permite programar sin fecha', async () => {
    render(<AnnouncementsPanel announcements={[]} organizations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo aviso/ }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Hola' } })
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Texto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Programar' }))
    const submit = screen.getAllByRole('button', { name: 'Programar' }).at(-1)!
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fireEvent.click(submit)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('SettingsCenter', () => {
  const data: PlatformSettingsData = {
    defaults: { companyName: 'MiTiendaPy', companyEmail: '', companyPhone: '', companyRuc: '', companyAddress: '', currency: 'PYG', taxRate: 10, timeZone: 'America/Asuncion' },
    policies: { maintenanceMode: false, allowRegistration: true, requireTwoFactor: false, passwordMinLength: 8 },
    storedFlags: { maintenanceMode: true, allowRegistration: true, requireEmailVerification: false, requireTwoFactor: false, autoBackup: true, smsNotifications: false, maxLoginAttempts: 5, passwordMinLength: 8, sessionTimeout: 60, retentionDays: 90 },
    usage: {
      totalOrganizations: 7, withoutOwnTaxRate: 5, withoutOwnCurrency: 2, withoutOwnTimezone: 3,
      currencies: [['PYG', 5]], timezones: [['America/Asuncion', 4]],
    },
    updatedAt: '2026-11-01T10:00:00+00:00',
    updatedByEmail: null,
    loadErrors: [],
  }

  const ok = (defaults = data.defaults) => new Response(JSON.stringify({ success: true, data: { defaults, updatedAt: '2026-11-09T10:00:00+00:00' } }))
  const openCompanySection = () => fireEvent.click(screen.getByRole('button', { name: /Sin efecto actualmente/ }))
  const bodyOf = (spy: { mock: { calls: unknown[][] } }, call = 0) => JSON.parse(String((spy.mock.calls[call][1] as RequestInit | undefined)?.body))
  const saveButton = () => screen.getAllByRole('button', { name: /Guardar/ })[0]

  beforeEach(() => refresh.mockReset())

  it('no dice que falta la 2FA: ya hay TOTP y exigencia por tienda', () => {
    render(<SettingsCenter data={data} />)
    expect(screen.queryByText(/Requiere activar MFA en Supabase Auth/)).not.toBeInTheDocument()
    expect(screen.getByText(/Cada tienda decide desde su Seguridad/)).toBeInTheDocument()
  })

  it('aclara que el único valor por defecto real es el IVA y cuántas tiendas lo usan', () => {
    render(<SettingsCenter data={data} />)
    expect(screen.getByText(/es el único valor por defecto que se usa hoy/)).toBeInTheDocument()
    expect(screen.getByText(/\(5 de 7\)/)).toBeInTheDocument()
    expect(screen.getByText(/2 sin moneda y 3 sin zona horaria/)).toBeInTheDocument()
  })

  it('los selects de moneda y zona horaria tienen su label', () => {
    render(<SettingsCenter data={data} />)
    expect(screen.getByLabelText('Moneda')).toHaveAttribute('id', 'settings-currency')
    expect(screen.getByLabelText('Zona horaria')).toHaveAttribute('id', 'settings-timezone')
  })

  it('los datos de empresa quedan plegados en «Sin efecto actualmente»', () => {
    render(<SettingsCenter data={data} />)
    expect(screen.queryByLabelText('RUC')).not.toBeInTheDocument()
    openCompanySection()
    expect(screen.getByLabelText('RUC')).toBeInTheDocument()
    expect(screen.getByText(/no se usan en ninguna parte/)).toBeInTheDocument()
  })

  it('no deja guardar el IVA vacío ni fuera de 0–100', () => {
    render(<SettingsCenter data={data} />)
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '' } })
    expect(screen.getAllByText('El IVA no puede quedar vacío.').length).toBeGreaterThan(0)
    expect(saveButton()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '150' } })
    expect(screen.getAllByText('El IVA tiene que estar entre 0 y 100.').length).toBeGreaterThan(0)
    expect(saveButton()).toBeDisabled()
  })

  it('pide confirmación antes de cambiar el IVA global y la manda al servidor', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ ...data.defaults, taxRate: 5 }))
    render(<SettingsCenter data={data} />)
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '5' } })
    fireEvent.click(saveButton())
    expect(fetchSpy).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Lo usan 5 de 7 tiendas/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cambiar el IVA' }))
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(bodyOf(fetchSpy)).toEqual({ settings: { taxRate: 5 }, revision: '2026-11-01T10:00:00+00:00', confirmTaxRateChange: true })
    fetchSpy.mockRestore()
  })

  it('ante un conflicto conserva el borrador y ofrece recargar', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ success: false, code: 'SETTINGS_REVISION_CONFLICT', error: 'Otra persona cambió la configuración; recargá.' }),
      { status: 409 },
    ))
    render(<SettingsCenter data={data} />)
    openCompanySection()
    fireEvent.change(screen.getByLabelText('RUC'), { target: { value: '80000000-1' } })
    fireEvent.click(saveButton())
    expect(await screen.findByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(screen.getAllByText(/Otra persona cambió la configuración/).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('RUC')).toHaveValue('80000000-1')
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    fetchSpy.mockRestore()
  })

  it('con cambios muestra la barra de guardado móvil y avisa al salir', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    render(<SettingsCenter data={data} />)
    expect(screen.queryByRole('region', { name: 'Cambios sin guardar' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '5' } })
    expect(screen.getByRole('region', { name: 'Cambios sin guardar' })).toBeInTheDocument()
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    addSpy.mockRestore()
  })

  it('ya no muestra nada como «no implementado»: dice dónde se configura cada cosa', () => {
    render(<SettingsCenter data={data} />)
    expect(screen.queryByText('No implementado')).not.toBeInTheDocument()
    expect(screen.getAllByText('En Supabase').length).toBe(4)
    expect(screen.getByText('No disponible')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Mantenimiento' })).toHaveAttribute('href', '/superadmin/maintenance')
  })

  it('las políticas de la plataforma se pueden cambiar y se mandan a su ruta', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { policies: { ...data.policies, allowRegistration: false }, updatedAt: '2026-11-10T10:00:00+00:00' },
    })))
    render(<SettingsCenter data={data} />)
    const save = screen.getByRole('button', { name: 'Guardar políticas' })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('switch', { name: 'Registro público de empresas' }))
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/superadmin/settings/policies')
    expect(bodyOf(fetchSpy)).toEqual({ allowRegistration: false })
    fetchSpy.mockRestore()
  })

  it('no deja guardar un largo de contraseña fuera de rango', () => {
    render(<SettingsCenter data={data} />)
    fireEvent.change(screen.getByLabelText('Largo mínimo de contraseña'), { target: { value: '4' } })
    expect(screen.getByText('Entre 8 y 32 caracteres.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar políticas' })).toBeDisabled()
  })

  it('solo habilita Guardar con cambios, recorta espacios y manda lo cambiado con la revisión', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok())
    render(<SettingsCenter data={data} />)
    const save = saveButton()
    expect(save).toBeDisabled()
    openCompanySection()
    // Solo espacios alrededor del mismo valor: no es un cambio.
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  MiTiendaPy ' } })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('RUC'), { target: { value: ' 80000000-1 ' } })
    expect(within(save).getByText(/\(1\)/)).toBeInTheDocument()
    fireEvent.click(save)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/superadmin/settings')
    expect(bodyOf(fetchSpy)).toEqual({ settings: { companyRuc: '80000000-1' }, revision: '2026-11-01T10:00:00+00:00' })
    fetchSpy.mockRestore()
  })
})
