export function uniqueNavigationItems<T extends { href: string }>(items: T[]): T[] {
  const seen = new Set<string>()

  return items.filter((item) => {
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}
