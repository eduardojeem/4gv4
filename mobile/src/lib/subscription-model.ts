/**
 * Cómo la app lee y muestra la suscripción. La respuesta es la de
 * /api/admin/subscriptions (la misma que usa la web): el plan llega como
 * `currentPlan` y las cajas como `cashRegisters`. Antes la app leía `plan` y
 * `registers`, así que todo figuraba «Ilimitado» y las cajas sin dato.
 */

export type SubscriptionPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  provider: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string | null;
};

export type BillingProfile = {
  business_name: string | null;
  ruc: string | null;
  billing_email: string | null;
  fiscal_address: string | null;
  phone: string | null;
};

export type SubscriptionDetails = {
  subscription: {
    id: string;
    plan: string;
    status: string;
    trial_ends_at: string | null;
    current_period_starts_at: string | null;
    current_period_ends_at: string | null;
    cancel_at_period_end: boolean;
  } | null;
  plan: {
    code: string;
    name: string;
    price_monthly: number;
    limits: Record<string, number | null>;
    modules: string[];
  } | null;
  usage: Record<QuotaKey, number>;
  billingProfile: BillingProfile | null;
  payments: SubscriptionPayment[];
  promoRedemptions: { id: string; redeemed_at: string | null; benefit_snapshot: Record<string, unknown> | null }[];
};

export type QuotaKey = 'branches' | 'users' | 'cashRegisters' | 'products' | 'repairs' | 'services';

type RawResponse = Record<string, unknown> & {
  currentPlan?: Record<string, unknown> | null;
  plan?: Record<string, unknown> | null;
  usage?: Record<string, unknown> | null;
};

const num = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeSubscription(raw: RawResponse): SubscriptionDetails {
  // `plan` queda como respaldo por si el servidor todavía es el viejo.
  const plan = raw.currentPlan ?? raw.plan ?? null;
  const usage = raw.usage ?? {};
  const limits: Record<string, number | null> = {};
  if (plan && typeof plan.limits === 'object' && plan.limits) {
    for (const [key, value] of Object.entries(plan.limits as Record<string, unknown>)) {
      limits[key] = value === null || value === undefined ? null : num(value, Number.NaN);
      if (Number.isNaN(limits[key] as number)) limits[key] = null;
    }
  }
  return {
    subscription: (raw.subscription as SubscriptionDetails['subscription']) ?? null,
    plan: plan
      ? {
          code: String(plan.code ?? ''),
          name: String(plan.name ?? plan.code ?? ''),
          price_monthly: num(plan.price_monthly),
          limits,
          modules: Array.isArray(plan.modules) ? plan.modules.map(String) : [],
        }
      : null,
    usage: {
      branches: num(usage.branches),
      users: num(usage.users),
      cashRegisters: num(usage.cashRegisters ?? usage.registers),
      products: num(usage.products),
      repairs: num(usage.repairs),
      services: num(usage.services),
    },
    billingProfile: (raw.billingProfile as BillingProfile | null) ?? null,
    payments: Array.isArray(raw.payments) ? (raw.payments as SubscriptionPayment[]) : [],
    promoRedemptions: Array.isArray(raw.promoRedemptions) ? (raw.promoRedemptions as SubscriptionDetails['promoRedemptions']) : [],
  };
}

export type StatusTone = 'success' | 'info' | 'danger' | 'warning' | 'neutral';

/** Mismos rótulos que la web (subscription-ui). «Manual» es un plan asignado por soporte: no es deuda. */
export function subscriptionStatus(status: string | null | undefined): { label: string; tone: StatusTone } {
  switch (status) {
    case 'active': return { label: 'Activo', tone: 'success' };
    case 'manual': return { label: 'Activo (asignado)', tone: 'success' };
    case 'trial':
    case 'trialing': return { label: 'Prueba gratis', tone: 'info' };
    case 'past_due': return { label: 'Pago vencido', tone: 'danger' };
    case 'unpaid': return { label: 'Impago', tone: 'danger' };
    case 'suspended': return { label: 'Suspendido', tone: 'danger' };
    case 'expired': return { label: 'Vencido', tone: 'danger' };
    case 'cancelled':
    case 'canceled': return { label: 'Cancelado', tone: 'neutral' };
    case 'pending': return { label: 'Pago pendiente', tone: 'warning' };
    default: return { label: status ? 'Sin confirmar' : 'Activo', tone: status ? 'warning' : 'success' };
  }
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Pagado',
  approved: 'Pagado',
  pending: 'Pendiente',
  failed: 'Fallido',
  cancelled: 'Cancelado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: 'Tarjeta',
  qr: 'QR',
  transfer: 'Transferencia',
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
  promo: 'Cupón',
  manual: 'Manual',
};

export const isFreePlan = (plan: SubscriptionDetails['plan']) => !plan || plan.code.toUpperCase() === 'FREE' || plan.price_monthly <= 0;

/** Qué cupos mostrar: los de siempre, más Reparaciones y Servicios si el plan trae ese módulo. */
export function visibleQuotas(details: SubscriptionDetails): { key: QuotaKey; label: string; current: number; max: number | null }[] {
  const modules = details.plan?.modules ?? [];
  const rows: { key: QuotaKey; label: string; show: boolean }[] = [
    { key: 'branches', label: 'Sucursales', show: true },
    { key: 'users', label: 'Miembros del equipo', show: true },
    { key: 'cashRegisters', label: 'Cajas registradoras', show: true },
    { key: 'products', label: 'Productos en catálogo', show: true },
    { key: 'repairs', label: 'Reparaciones', show: modules.includes('repairs') },
    { key: 'services', label: 'Servicios', show: modules.includes('services') },
  ];
  return rows
    .filter((row) => row.show)
    .map((row) => ({ key: row.key, label: row.label, current: details.usage[row.key], max: details.plan?.limits[row.key] ?? null }));
}

const MODULE_LABELS: Record<string, string> = {
  inventory: 'Inventario',
  inventory_admin: 'Inventario avanzado',
  pos: 'Punto de venta',
  crm: 'Clientes',
  orders: 'Pedidos',
  ecommerce: 'Tienda online',
  repairs: 'Reparaciones',
  services: 'Agenda y servicios',
  credits: 'Créditos',
  delivery: 'Delivery',
  analytics: 'Analítica',
  web_analytics: 'Visitas web',
  promotions: 'Promociones',
  security: 'Seguridad',
  finances: 'Finanzas',
  reports: 'Reportes',
};
export const moduleLabel = (key: string) => MODULE_LABELS[key] ?? key.replace(/_/g, ' ');

/** Mismo texto que la web para un cupón canjeado. */
export function redemptionText(benefit: Record<string, unknown> | null | undefined, formatMoney: (n: number) => string): string {
  if (!benefit) return 'Beneficio promocional aplicado';
  const type = String(benefit.benefit_type || '');
  const unit = benefit.duration_unit === 'months' ? 'meses' : 'días';
  const days = num(benefit.duration_days);
  const duration = days > 0 ? `${days} ${unit}` : '';
  if (type === 'activate_plan') return `Plan ${String(benefit.target_plan || '')} por ${duration}`.trim();
  if (type === 'extend_trial') return `Prueba extendida ${duration}`.trim();
  if (type === 'extend_period') return `Período extendido ${duration}`.trim();
  if (type === 'discount_percent') return `Descuento de ${num(benefit.discount_percent)}%`;
  if (type === 'discount_fixed') return `Descuento de ${formatMoney(num(benefit.discount_amount))}`;
  return 'Beneficio promocional aplicado';
}

export const BILLING_FIELDS: { key: keyof BillingProfile; label: string; placeholder: string; keyboard?: 'email-address' | 'phone-pad' }[] = [
  { key: 'business_name', label: 'Razón social', placeholder: 'Nombre o razón social' },
  { key: 'ruc', label: 'RUC o CI', placeholder: '80012345-6' },
  { key: 'billing_email', label: 'Correo de facturación', placeholder: 'facturas@tuempresa.com', keyboard: 'email-address' },
  { key: 'phone', label: 'Teléfono', placeholder: '0981 123 456', keyboard: 'phone-pad' },
  { key: 'fiscal_address', label: 'Dirección fiscal', placeholder: 'Calle, número y ciudad' },
];

export function billingMissingFields(profile: BillingProfile | null): string[] {
  return BILLING_FIELDS.filter((field) => !(profile?.[field.key] ?? '').trim()).map((field) => field.label);
}
