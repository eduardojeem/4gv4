export type MarketplacePlan = {
  id: string; tier: string; public_slug: string | null; name: string; price: number;
  price_note: string | null; description: string | null; is_popular: boolean; trial_days: number;
  limits: { key: string; label: string; value: string }[];
  features: { key: string; label: string }[];
};
export function planRegistrationPath(plan: Pick<MarketplacePlan, 'public_slug' | 'tier'>) {
  return '/register?plan=' + encodeURIComponent(plan.public_slug || plan.tier);
}
export function planPrice(plan: Pick<MarketplacePlan, 'price'>) {
  return plan.price === 0 ? 'Gratis' : new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(plan.price);
}
export function planAudiences(plan: Pick<MarketplacePlan, 'features'>): string[] {
  const keys = new Set(plan.features.map(feature => feature.key));
  return [
    ...(keys.has('pos') || keys.has('ecommerce') ? ['Comercios'] : []),
    ...(keys.has('repairs') ? ['Talleres'] : []),
    ...(keys.has('services') ? ['Servicios'] : []),
  ];
}
