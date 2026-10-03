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
import { HealthHistoryPanel } from './HealthHistoryPanel'

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
        guidedActions: [{ type: 'file', label: 'Revisar limitador compartido', target: 'src/lib/rate-limiter.ts' }],
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
    comparison: {
      previousRunId: 'r0', previousCheckedAt: now,
      changes: [
        { checkId: 'security.rate_limiting', kind: 'worsened', currentStatus: 'warning', previousStatus: 'healthy', currentSeverity: 'medium', previousSeverity: 'info' },
        { checkId: 'supabase.database', kind: 'unchanged', currentStatus: 'healthy', previousStatus: 'healthy', currentSeverity: 'info', previousSeverity: 'info' },
        { checkId: 'ux.contrast', kind: 'not_comparable', currentStatus: 'unknown', previousStatus: null, currentSeverity: 'info', previousSeverity: null },
      ],
      counts: { new_issue: 0, worsened: 1, improved: 0, resolved: 0, unchanged: 1, not_comparable: 1 },
      executiveSummary: { critical: 0, warnings: 1, newOrWorsened: 1, resolved: 0 },
    },
    executiveSummary: { critical: 0, warnings: 1, newOrWorsened: 1, resolved: 0 },
    deployment: null,
    serviceHealth: [
      { id: 'supabase', name: 'Supabase', status: 'healthy', configured: 'configured', summary: 'Base accesible', source: 'Consulta', checkedAt: now, latencyMs: 100 },
      { id: 'telegram', name: 'Telegram', status: 'unknown', configured: 'configured', summary: 'Sin prueba', source: 'Variables', checkedAt: null, latencyMs: null, unavailableReason: 'No verificado' },
    ],
    scheduledTasks: [
      { id: 'subscription-lifecycle', name: 'Ciclo de suscripciones', status: 'unknown', summary: 'Sin bitácora', source: 'Efecto observado', lastRunAt: null, nextRunAt: null, durationMs: null },
    ],
    scope: { complete: false, unavailableSources: ['ux.contrast'] },
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
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    runSystemHealthAction.mockResolvedValue({ ok: true, data: report() })
    render(<SystemHealthDashboard initialHistory={emptyHistory} severityRules={{}} />)
    fireEvent.click(await screen.findByRole('button', { name: /Rate limiting/ }))
    expect(await screen.findByText('Aplicar límites')).toBeInTheDocument()
    expect(screen.getByText('/api/x sin límite')).toBeInTheDocument()
    expect(screen.getByText('método')).toBeInTheDocument()
    expect(screen.getByText('Impacto potencial')).toBeInTheDocument()
    expect(screen.getByText('Revisar limitador compartido')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(writeText).toHaveBeenCalledWith('src/lib/rate-limiter.ts')
    expect(runSystemHealthAction).toHaveBeenCalledTimes(1)
  })

  it('muestra resumen ejecutivo, cambios y paneles operativos sin aprobar lo no verificable', async () => {
    runSystemHealthAction.mockResolvedValue({ ok: true, data: report() })
    render(<SystemHealthDashboard initialHistory={emptyHistory} severityRules={{}} />)

    expect(await screen.findByText('Comprobación parcial')).toBeInTheDocument()
    expect(screen.getByText('Empeoró')).toBeInTheDocument()
    expect(screen.getByText('Servicios externos')).toBeInTheDocument()
    expect(screen.getByText('Tareas programadas')).toBeInTheDocument()
    expect(screen.getAllByText('No verificable').length).toBeGreaterThan(0)
  })

  it('identifica cambios nuevos, resueltos y sin comparación en todas las comprobaciones', async () => {
    const current = report()
    current.checks.push({
      id: 'security.unverified', category: 'security', name: 'Control nuevo', status: 'unknown', severity: 'info',
      summary: 'No disponible', description: 'd', method: 'm', findings: [], checkedAt: current.finishedAt,
    })
    current.comparison.changes = [
      { ...current.comparison.changes[0], kind: 'new_issue', previousStatus: null, previousSeverity: null },
      { ...current.comparison.changes[1], kind: 'resolved', previousStatus: 'error', previousSeverity: 'high' },
      { ...current.comparison.changes[2], checkId: 'security.unverified' },
    ]
    runSystemHealthAction.mockResolvedValue({ ok: true, data: current })
    render(<SystemHealthDashboard initialHistory={emptyHistory} severityRules={{}} />)

    const allChecksTab = await screen.findByRole('tab', { name: /Todas/ })
    fireEvent.mouseDown(allChecksTab)
    fireEvent.click(allChecksTab)
    await waitFor(() => expect(allChecksTab).toHaveAttribute('data-state', 'active'))
    expect(await screen.findByText('Nuevo')).toBeInTheDocument()
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
    expect(screen.getByText('Sin comparación anterior')).toBeInTheDocument()
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

  it('agrupa filas intercaladas por ejecución y permite expandir el detalle', async () => {
    const history = {
      available: true,
      entries: [
        { id: 1, runId: 'run-a', checkedAt: '2026-09-27T10:00:02.000Z', checkId: 'a-error', category: 'security' as const, status: 'error' as const, severity: 'high' as const, message: 'Error A', durationMs: 20 },
        { id: 2, runId: 'run-b', checkedAt: '2026-09-27T11:00:00.000Z', checkId: 'b-ok', category: 'supabase' as const, status: 'healthy' as const, severity: 'info' as const, message: 'Correcto B', durationMs: 10 },
        { id: 3, runId: 'run-a', checkedAt: '2026-09-27T10:00:00.000Z', checkId: 'a-warning', category: 'performance' as const, status: 'warning' as const, severity: 'medium' as const, message: 'Advertencia A', durationMs: 30 },
      ],
    }
    render(<HealthHistoryPanel initial={history} />)
    const runs = await screen.findAllByText(/Ejecución run-/)
    expect(runs[0]).toHaveTextContent('run-b')
    expect(runs[1]).toHaveTextContent('run-a')
    fireEvent.click(runs[1])
    expect(screen.getByText('Error A')).toBeInTheDocument()
    expect(screen.getByText('Advertencia A')).toBeInTheDocument()
  })
})
