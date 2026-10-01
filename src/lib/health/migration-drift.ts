import type { HealthStatus } from '@/lib/health/types'

export interface MigrationHealth {
  status: Extract<HealthStatus, 'healthy' | 'warning'>
  missingRemote: string[]
  remoteOnly: string[]
}

function uniqueSorted(versions: string[]): string[] {
  return [...new Set(versions.filter((version) => /^\d{14}$/.test(version)))].sort()
}

export function evaluateMigrationHealth(localVersions: string[], remoteVersions: string[]): MigrationHealth {
  const local = uniqueSorted(localVersions)
  const remote = uniqueSorted(remoteVersions)
  const localSet = new Set(local)
  const remoteSet = new Set(remote)
  const missingRemote = local.filter((version) => !remoteSet.has(version))
  const remoteOnly = remote.filter((version) => !localSet.has(version))

  return {
    status: missingRemote.length > 0 || remoteOnly.length > 0 ? 'warning' : 'healthy',
    missingRemote,
    remoteOnly,
  }
}
