import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  { id: 'user-1', name: 'Juan Pérez' },
  { id: 'user-2', name: 'Carlos López' },
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

describe('Panel de Seguridad Administrativo (/admin/security)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza correctamente las métricas clave y la tabla de auditoría', () => {
    render(<SecurityPanel />)

    expect(screen.getByText('Total Eventos')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('Eventos Críticos')).toBeInTheDocument()
    expect(screen.getByText('Inicio de sesión exitoso')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('190.128.50.12')).toBeInTheDocument()
    expect(screen.getByText('Intento de acceso denegado')).toBeInTheDocument()
  })

  it('abre el modal de detalles técnicos al hacer clic en un evento', () => {
    render(<SecurityPanel />)

    // Clic en el botón de ver detalles
    const detailButtons = screen.getAllByLabelText('Ver detalle')
    expect(detailButtons.length).toBeGreaterThan(0)
    fireEvent.click(detailButtons[0])

    // El modal de detalle debe abrirse con la información técnica completa
    expect(screen.getByText('ID: log-1')).toBeInTheDocument()
    expect(screen.getByText('Usuario Ejecutor')).toBeInTheDocument()
    expect(screen.getAllByText('Inicio de sesión desde Chrome en Windows 11').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Mozilla\/5\.0/)).toBeInTheDocument()
    expect(screen.getByText('Copiar Datos')).toBeInTheDocument()
  })

  it('permite cambiar a la pestaña de Diagnóstico & Salud y ejecutar diagnóstico', async () => {
    render(<SecurityPanel />)

    const diagTab = screen.getByRole('tab', { name: /Diagnóstico & Salud/i })
    fireEvent.click(diagTab)

    expect(screen.getByText('Puntuación de Seguridad')).toBeInTheDocument()
    expect(screen.getByText('Pilares de Protección Activos')).toBeInTheDocument()
    expect(screen.getByText(/Row Level Security \(RLS\)/i)).toBeInTheDocument()

    const scanBtn = screen.getByRole('button', { name: /Ejecutar Diagnóstico en Vivo/i })
    expect(scanBtn).toBeInTheDocument()
  })

  it('permite ver la lista de usuarios y accesos en la pestaña de Usuarios', () => {
    render(<SecurityPanel />)

    const usersTab = screen.getByRole('tab', { name: /Usuarios & Accesos/i })
    fireEvent.click(usersTab)

    expect(screen.getByText('Personal con Acceso al Sistema')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
  })

  it('permite ver las recomendaciones de blindaje', () => {
    render(<SecurityPanel />)

    const recoTab = screen.getByRole('tab', { name: /Blindaje & Consejos/i })
    fireEvent.click(recoTab)

    expect(screen.getByText('Autenticación Fuerte & Contraseñas')).toBeInTheDocument()
    expect(screen.getByText('Revisión Periódica de Roles')).toBeInTheDocument()
  })
})
