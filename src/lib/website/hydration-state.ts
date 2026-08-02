export function getHydrationSafeWebsiteSettingsState<T>(
  isHydrated: boolean,
  data: T | undefined,
  isLoading: boolean
): { settings: T | null; isLoading: boolean } {
  if (!isHydrated) {
    return { settings: null, isLoading: true }
  }

  return { settings: data ?? null, isLoading }
}
