import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SecurityPanel } from '@/components/admin/system/security-panel'

// Mock useAuth
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@4g.com.py', full_name: 'Admin Principal' },
    isAdmin: true,
    isSuperAdmin: true,
  }),
}))

// Mock useSecurityLogs
const mockFetchSecurityLogs = vi.fn()
const mockLogs = [
  {
    id: 'log-1',
    event: 'Inicio de sesión exitoso',
    user: 'Juan Pérez',
    user_id: 'user-1',
    timestamp: '2026-09-03T18:30:00.000Z',
    ip: '190.128.50.12',
    severity: 'low' as const,
    action: 'login',
    resource: 'auth',
    details: 'Inicio de sesión desde Chrome en Windows 11',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  {
    id: 'log-2',
    event: 'Intento de acceso denegado',
    user: 'Desconocido',
    user_id: 'user-2',
    timestamp: '2026-09-03T19:00:00.000Z',
    ip: '45.12.33.99',
    severity: 'critical' as const,
    action: 'unauthorized_admin_access_attempt',
    resource: 'admin_api',
    details: 'path: /api/admin/finances - status: 403',
    user_agent: 'curl/7.68.0',
  },
]

const mockUsers = [
  { id: 'user-1', name: 'Juan Pérez', role: 'admin', email: 'juan@example.com' },
  { id: 'user-2', name: 'Carlos López', role: 'seller', email: 'carlos@example.com' },
  { id: 'user-3', name: 'María Gomez', role: 'cliente', email: 'maria@cliente.com' },
]

vi.mock('@/hooks/use-security-logs', () => ({
  useSecurityLogs: () => ({
    logs: mockLogs,
    stats: {
      totalEvents: 25,
      criticalEvents: 1,
      highRiskEvents: 3,
      failedAttempts: 2,
      uniqueUsers: 5,
      uniqueIPs: 4,
    },
    totalCount: 2,
    users: mockUsers,
    isLoading: false,
    error: null,
    fetchSecurityLogs: mockFetchSecurityLogs,
  }),
}))

/**
 * El panel se reescribio entero varias veces y sus textos cambian seguido, asi
 * que estas pruebas se apoyan en lo que no cambia: los datos de la bitacora
 * (nombres, IP, id del evento), las pestañas por su rol y la ficha que se abre
 * al tocar un evento. Los titulos decorativos quedan fuera a proposito.
 */
describe('Panel de Seguridad Administrativo (/admin/security)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const irA = (pestaña: RegExp) => fireEvent.click(screen.getByRole('tab', { name: pestaña }))

  it('renderiza las metricas clave y la bitacora con sus datos', () => {
    render(<SecurityPanel />)

    expect(screen.getByText('Actividades Registradas')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('Alertas Críticas')).toBeInTheDocument()
    // La fila trae a quien lo hizo; la IP quedo dentro de la ficha del evento.
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('abre la ficha tecnica al tocar un evento', () => {
    render(<SecurityPanel />)

    const fichas = screen.getAllByRole('button', { name: /Ver ficha/i })
    expect(fichas.length).toBeGreaterThan(0)
    fireEvent.click(fichas[0])

    // La ficha existe y trae el id del evento y el agente del navegador, que
    // es lo que sirve para investigar.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/log-1/)).toBeInTheDocument()
    expect(screen.getByText(/Mozilla\/5\.0/)).toBeInTheDocument()
    expect(screen.getByText('190.128.50.12')).toBeInTheDocument()
  })

  it('la pestaña de escudos ofrece el diagnostico en vivo', () => {
    render(<SecurityPanel />)

    irA(/Escudos de Protección/i)

    expect(screen.getByText('Nivel de Protección Actual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver salud del sistema/i })).toBeInTheDocument()
  })

  it('la pestaña de cuentas separa al personal de los clientes', () => {
    render(<SecurityPanel />)

    irA(/Personal & Cuentas/i)

    expect(screen.getByText('Control de Cuentas & Permisos')).toBeInTheDocument()

    // Abre en el personal, que es a quien se le controla el acceso.
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
    expect(screen.queryByText('María Gomez')).not.toBeInTheDocument()

    // Y el filtro separa de verdad: es lo que la pestaña promete.
    fireEvent.click(screen.getByRole('button', { name: /Clientes/i }))
    expect(screen.getByText('María Gomez')).toBeInTheDocument()
    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
  })

  it('la pestaña de consejos muestra la autoevaluacion', () => {
    render(<SecurityPanel />)

    irA(/Consejos & Buenas Prácticas/i)

    expect(screen.getByText('Autoevaluación de Seguridad para tu Negocio')).toBeInTheDocument()
  })
})
