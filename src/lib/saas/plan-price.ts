/** Plan identity is stable; whether it is free comes from the verified catalog price. */
export function readPlanMonthlyPrice(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}
export function hasVerifiedPlanPrice(plan: {price_monthly:unknown;price_verified?:boolean;limits_are_fallback?:boolean}|null|undefined): boolean {
  return Boolean(plan && plan.price_verified !== false && plan.limits_are_fallback !== true && readPlanMonthlyPrice(plan.price_monthly) !== null);
}
export function isZeroPricePlan(plan: {price_monthly:unknown;price_verified?:boolean;limits_are_fallback?:boolean}|null|undefined): boolean {
  return hasVerifiedPlanPrice(plan) && readPlanMonthlyPrice(plan!.price_monthly) === 0;
}
