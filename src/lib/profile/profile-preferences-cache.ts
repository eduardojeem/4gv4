const PREFIX = 'dashboard-profile-preferences:'

export function profilePreferencesCacheKey(userId: string): string {
  return `${PREFIX}${userId}`
}

export function readProfilePreferencesCache(
  userId: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(profilePreferencesCacheKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export function writeProfilePreferencesCache(
  userId: string,
  preferences: object,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(profilePreferencesCacheKey(userId), JSON.stringify(preferences))
}
