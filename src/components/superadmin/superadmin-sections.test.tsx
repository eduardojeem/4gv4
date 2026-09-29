import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/superadmin/test',
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
    fireEvent.click(screen.getByRole('tab', { name: /Programados/ }))
    expect(screen.getByText('Promo futura')).toBeInTheDocument()
    expect(screen.queryByText('Mantenimiento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Todos/ }))
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
    storedFlags: { maintenanceMode: true, allowRegistration: true, requireEmailVerification: false, requireTwoFactor: false, autoBackup: true, smsNotifications: false, maxLoginAttempts: 5, passwordMinLength: 8, sessionTimeout: 60, retentionDays: 90 },
    usage: { organizationsWithSettings: 2, currencies: [['PYG', 2]], timezones: [['America/Asuncion', 2]] },
    updatedAt: null,
    updatedByEmail: null,
    loadErrors: [],
  }

  beforeEach(() => refresh.mockReset())

  it('muestra deshabilitadas las opciones que ninguna parte de la app aplica', () => {
    render(<SettingsCenter data={data} />)
    const switchInput = screen.getByRole('switch', { name: /Modo mantenimiento de la plataforma \(no implementado\)/ })
    expect(switchInput).toBeDisabled()
    expect(screen.getAllByText('No implementado').length).toBe(10)
  })

  it('solo habilita Guardar cuando hay cambios y envía únicamente lo cambiado', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true })))
    render(<SettingsCenter data={data} />)
    const save = screen.getByRole('button', { name: /Guardar/ })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('RUC'), { target: { value: '80000000-1' } })
    expect(within(save).getByText(/\(1\)/)).toBeInTheDocument()
    fireEvent.click(save)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ settings: { companyRuc: '80000000-1' } })
    fetchSpy.mockRestore()
  })
})
