/** Retiene lo que se editó después de iniciar un guardado (incluidas subidas tardías). */
export function remainingWebsiteEdits<T extends object>(
  current: T,
  submitted: T,
): T {
  return Object.fromEntries(
    Object.entries(current).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify((submitted as Record<string, unknown>)[key]),
    ),
  ) as T;
}
