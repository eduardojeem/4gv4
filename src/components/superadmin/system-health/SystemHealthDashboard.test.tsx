import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { HealthReport } from '@/lib/health/types'

const runSystemHealthAction = vi.fn()
const readHealthHistoryAction = vi.fn()

vi.mock('@/app/superadmin/system-health/actions', () => ({
  runSystemHealthAction: () => runSystemHealthAction(),
  readHealthHistoryAction: (filters: unknown) => readHealthHistoryAction(filters),
}))

import { SystemHealthDashboard } from './SystemHealthDashboard'

const emptyHistory = { available: true, entries: [] }

function report(overrides: Partial<HealthReport> = {}): HealthReport {
  const now = new Date('2026-09-27T17:30:00Z').toISOString()
  return {
    runId: 'r1',
    startedAt: now,
    finishedAt: now,
    durationMs: 1200,
    target: 'https://www.mitiendapy.com',
    environment: 'production',
    checks: [
      {
        id: 'security.rate_limiting', category: 'security', name: 'Rate limiting', status: 'warning', severity: 'medium',
        summary: '8/14 endpoints con rate limit', description: 'desc', method: 'método', findings: ['/api/x sin límite'],
        recommendation: 'Aplicar límites', checkedAt: now,
      },
      {
        id: 'supabase.database', category: 'supabase', name: 'Base de datos', status: 'healthy', severity: 'info',
        summary: 'Responde en 100 ms', description: 'd', method: 'm', findings: [], checkedAt: now,
      },
      {
        id: 'ux.contrast', category: 'ux', name: 'Contraste', status: 'unknown', severity: 'info',
        summary: 'No disponible', description: 'd', method: 'm', findings: [], checkedAt: now,
      },
    ],
    metrics: [{ id: 'growth', title: 'Crecimiento', metrics: [{ label: 'Tamaño', value: null, unavailableReason: 'Sin snapshots' }] }],
    tenantTables: [],
    counts: { healthy: 1, warning: 1, error: 0, unknown: 1, not_configured: 0 },
    overall: 'warning',
    historyPersisted: false,
    historyError: 'Historial desactivado: falta la tabla system_health_checks',
    ...overrides,
  }
}

describe('SystemHealthDashboard', () => {
  beforeEach(() => {
    runSystemHealthAction.mockReset()
    readHealthHistoryAction.mockReset()
  })

  it('ejecuta el diagnóstico al montar, bloquea el botón mientras corre y muestra resultados', async () => {
    let resolve: (value: unknown) => void = () => undefined
    runSystemHealthAction.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<SystemHealthDashboard initialHistory={emptyHistory} severityRules={{ medium: ['Rate limiting ausente'] }} />)

    const button = await screen.findByRole('button', { name: /comprobando/i })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(runSystemHealthAction).toHaveBeenCalledTimes(1)

    resolve({ ok: true, data: report() })
    expect(await screen.findByText('CON ADVERTENCIAS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ejecutar diagnóstico/i })).toBeEnabled()
    expect(screen.getByText(/Historial desactivado/)).toBeInTheDocument()
    // Métrica sin fuente confiable: se muestra "No disponible", nunca un número inventado.
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    expect(screen.getByText('Sin snapshots')).toBeInTheDocument()
    expect(screen.getByText('2/3 controles verificados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Contraste/ })).toBeInTheDocument()
  }, 30_000)

  it('abre el detalle con qué se comprobó y la recomendación', async () => {
    runSystemHealthAction.mockResolvedValue({ ok: true, data: report() })
    render(<SystemHealthDashboard initialHistory={emptyHistory} severityRules={{}} />)
    fireEvent.click(await screen.findByRole('button', { name: /Rate limiting/ }))
    expect(await screen.findByText('Aplicar límites')).toBeInTheDocument()
    expect(screen.getByText('/api/x sin límite')).toBeInTheDocument()
    expect(screen.getByText('método')).toBeInTheDocument()
  })

  it('muestra el error saneado y permite reintentar', async () => {
    runSystemHealthAction.mockResolvedValueOnce({ ok: false, error: 'Acceso denegado' })
    render(<SystemHealthDashboard initialHistory={emptyHistory} severityRules={{}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado')

    runSystemHealthAction.mockResolvedValueOnce({ ok: true, data: report({ overall: 'healthy' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('OPERATIVO')).toBeInTheDocument())
  })

  it('muestra el motivo cuando el historial no está disponible', async () => {
    runSystemHealthAction.mockResolvedValue({ ok: true, data: report() })
    render(
      <SystemHealthDashboard
        initialHistory={{ available: false, reason: 'Historial no disponible: aplicar la migración.', entries: [] }}
        severityRules={{}}
      />,
    )
    expect(await screen.findByText('Historial no disponible: aplicar la migración.')).toBeInTheDocument()
  })
})
