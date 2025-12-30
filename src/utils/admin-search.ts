export type UserRow = {
  name: string
  email: string
  role?: string
  status?: string
}

export type SecurityLogRow = {
  event: string
  user: string
  status?: string
  severity?: string
  timestamp: string | number | Date
}

export type SearchFilters = {
  type?: 'users' | 'security' | 'all'
  roles?: string[]
  statuses?: string[]
  severities?: string[]
  dateFrom?: Date
  dateTo?: Date
}

export function filterAdminSearchData(
  users: UserRow[] = [],
  logs: SecurityLogRow[] = [],
  query: string = '',
  filters: SearchFilters = {}
) {
  const q = query.trim().toLowerCase()
  const inRange = (d: Date) => {
    const from = filters.dateFrom?.getTime()
    const to = filters.dateTo?.getTime()
    const t = d.getTime()
    if (from && t < from) return false
    if (to && t > to) return false
    return true
  }

  const usersFiltered = users.filter(u => {
    if (filters.type && filters.type !== 'users' && filters.type !== 'all') return false
    if (filters.roles?.length && u.role && !filters.roles.includes(u.role)) return false
    if (filters.statuses?.length && u.status && !filters.statuses.includes(u.status)) return false
    if (!q) return true
    return (
      (u.name?.toLowerCase().includes(q)) ||
      (u.email?.toLowerCase().includes(q)) ||
      (u.role?.toLowerCase().includes(q)) ||
      (u.status?.toLowerCase().includes(q))
    )
  })

  const logsFiltered = logs.filter(l => {
    if (filters.type && filters.type !== 'security' && filters.type !== 'all') return false
    if (filters.severities?.length && l.severity && !filters.severities.includes(l.severity)) return false
    if (!inRange(new Date(l.timestamp))) return false
    if (!q) return true
    return (
      (l.event?.toLowerCase().includes(q)) ||
      (l.user?.toLowerCase().includes(q)) ||
      (l.status?.toLowerCase().includes(q)) ||
      (l.severity?.toLowerCase().includes(q))
    )
  })

  return { users: usersFiltered, logs: logsFiltered }
}