/** null means the API did not disclose a cost; zero is a known value. */
export function productCostDraft(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('es-PY')
    : null;
}

/** A name-only update must never synthesize or resubmit a hidden cost. */
export function productCostPatch(
  draft: string | null,
  original: number | null | undefined,
  canWriteCost: boolean,
): { purchase_price?: number } {
  if (!canWriteCost || draft === null || !draft.trim()) return {};
  const value = Number(draft.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value === original) return {};
  return { purchase_price: value };
}
