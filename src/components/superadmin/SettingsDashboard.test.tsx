import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsDashboard, summarizeEnvChecks, type SettingsData } from './SettingsDashboard'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const initial: SettingsData = {
  system: {
    companyName: '4G', companyEmail: 'admin@example.com', maintenanceMode: false,
    allowRegistration: true, requireEmailVerification: false, requireTwoFactor: false,
    autoBackup: false, emailNotifications: true, smsNotifications: false,
    maxLoginAttempts: 5, sessionTimeout: 60, retentionDays: 90, passwordMinLength: 8,
    currency: 'PYG', taxRate: 10, timezone: 'America/Asuncion', updatedAt: null, updatedBy: null,
  },
  platformStats: {
    totalOrgs: 3, topCurrency: 'PYG', topTimezone: 'America/Asuncion',
    currencyDistribution: [{ value: 'PYG', count: 3 }],
  },
  envChecks: [{ key: 'NEXT_PUBLIC_SITE_URL', configured: false, required: true }],
  loadIssues: ['No se pudo leer la configuración global.'],
}

describe('SettingsDashboard', () => {
  beforeEach(() => {
    refresh.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }))
  })

  it('expone los errores parciales de carga y no presenta datos degradados como confiables', () => {
    render(<SettingsDashboard initial={initial} />)

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer la configuración global.')
    expect(screen.getByText('Datos incompletos')).toBeInTheDocument()
  })

  it('pide confirmación antes de activar el modo mantenimiento global', async () => {
    render(<SettingsDashboard initial={{ ...initial, loadIssues: [] }} />)

    fireEvent.click(screen.getByRole('switch', { name: /Modo mantenimiento/i }))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('no bloquea actualmente')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(fetch).toHaveBeenCalledWith('/api/admin/system/settings', expect.objectContaining({ method: 'PUT' }))
  })

  it('identifica las opciones almacenadas que aún no tienen aplicación operativa', () => {
    render(<SettingsDashboard initial={{ ...initial, loadIssues: [] }} />)

    expect(screen.getAllByText('Integración pendiente').length).toBeGreaterThan(0)
    expect(screen.getByRole('switch', { name: /Backup automático/i })).toBeDisabled()
  })

  it('no presenta una integración opcional ausente como fallo crítico de entorno', () => {
    expect(summarizeEnvChecks([
      { key: 'NEXT_PUBLIC_SITE_URL', configured: true, required: true },
      { key: 'PAGOPAR_PRIVATE_KEY', configured: false, required: false },
    ])).toEqual({ requiredConfigured: 1, requiredTotal: 1, requiredMissing: 0, optionalMissing: 1 })
  })
})
