export type RepairHelpProgress = {
  version: string
  completedTaskIds: string[]
  dismissed: boolean
}

const memoryProgress = new Map<string, RepairHelpProgress>()

function storageKey(userId: string, version: string) {
  return `repairs-help:${userId}:${version}`
}

function emptyProgress(version: string): RepairHelpProgress {
  return { version, completedTaskIds: [], dismissed: false }
}

export function loadRepairHelpProgress(userId: string, version: string): RepairHelpProgress {
  const key = storageKey(userId, version)
  if (typeof window === 'undefined') return emptyProgress(version)
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return memoryProgress.get(key) ?? emptyProgress(version)
    const parsed = JSON.parse(raw) as Partial<RepairHelpProgress> | null
    if (!parsed || parsed.version !== version || !Array.isArray(parsed.completedTaskIds)) return emptyProgress(version)
    return {
      version,
      completedTaskIds: parsed.completedTaskIds.filter((id): id is string => typeof id === 'string'),
      dismissed: parsed.dismissed === true,
    }
  } catch {
    return emptyProgress(version)
  }
}

export function saveRepairHelpProgress(
  userId: string,
  version: string,
  progress: Omit<RepairHelpProgress, 'version'>,
) {
  const next = { version, ...progress }
  const key = storageKey(userId, version)
  memoryProgress.set(key, next)
  if (typeof window === 'undefined') return next
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Storage is optional; the active tour continues in memory.
  }
  return next
}
