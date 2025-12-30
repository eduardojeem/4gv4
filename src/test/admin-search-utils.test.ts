import { describe, it, expect } from 'vitest'
import { filterAdminSearchData } from '@/utils/admin-search'

describe('filterAdminSearchData', () => {
  const users = [
    { name: 'Juan Pérez', email: 'juan@example.com', role: 'admin', status: 'active' },
    { name: 'María Gomez', email: 'maria@example.com', role: 'vendedor', status: 'inactive' },
    { name: 'Técnico Uno', email: 'tech1@example.com', role: 'tecnico', status: 'active' },
  ]

  const logs = [
    { event: 'login_success', user: 'juan', status: 'ok', severity: 'low', timestamp: new Date('2025-01-01') },
    { event: 'login_failed', user: 'maria', status: 'blocked', severity: 'high', timestamp: new Date('2025-02-01') },
    { event: 'config_change', user: 'admin', status: 'ok', severity: 'medium', timestamp: new Date('2025-03-01') },
  ]

  it('filters users by query and role', () => {
    const res = filterAdminSearchData(users, logs, 'juan', { type: 'users', roles: ['admin'] })
    expect(res.users).toHaveLength(1)
    expect(res.users[0].email).toBe('juan@example.com')
    expect(res.logs).toHaveLength(0)
  })

  it('filters logs by severity and date range', () => {
    const res = filterAdminSearchData(users, logs, '', {
      type: 'security',
      severities: ['high'],
      dateFrom: new Date('2025-01-15'),
      dateTo: new Date('2025-02-15')
    })
    expect(res.logs).toHaveLength(1)
    expect(res.logs[0].event).toBe('login_failed')
    expect(res.users).toHaveLength(0)
  })
})