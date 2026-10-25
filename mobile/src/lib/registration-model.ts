/**
 * El registro de un comercio se hace en la web. La app lo abre con su propia
 * dirección de vuelta (`app_return`) y, al terminar, la web vuelve a la app con
 * el resultado. Lógica pura, sin React Native, para poder probarla.
 */

/** «/register?plan=pro» + la dirección de vuelta de la app. */
export function registrationUrl(siteUrl: string, path: string, returnUrl: string): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, siteUrl);
  if (!url.pathname.startsWith('/register')) url.pathname = '/register';
  url.searchParams.set('app_return', returnUrl);
  return url.toString();
}

export type RegistrationResult = { registered: boolean; confirmEmail: boolean };

/** Lo que trae la vuelta de la web: si se creó la cuenta y si falta confirmar el email. */
export function parseRegistrationReturn(params: Record<string, string | string[] | undefined | null>): RegistrationResult {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  return { registered: value('registered') === '1', confirmEmail: value('confirmar') === '1' };
}

/** El aviso del ingreso después de registrarse. */
export function registrationNotice(result: RegistrationResult): string | null {
  if (!result.registered) return null;
  return result.confirmEmail
    ? '¡Listo, tu comercio quedó creado! Confirmá tu email con el enlace que te mandamos y después ingresá acá con tu email y contraseña.'
    : '¡Listo, tu comercio quedó creado! Ingresá con tu email y contraseña para empezar.';
}

/**
 * El texto del botón de registro según los planes vigentes: los días de prueba
 * salen del catálogo, no de un número fijo. Sin catálogo no se promete nada.
 */
export function registerCtaLabel(plans: readonly { trial_days?: number | null; price: number }[] | null | undefined): string {
  if (!plans?.length) return 'Crear mi cuenta';
  const trials = [...new Set(plans.map((plan) => Math.max(0, Math.trunc(Number(plan.trial_days) || 0))).filter((days) => days > 0))];
  if (trials.length === 1) return `Probar gratis ${trials[0]} ${trials[0] === 1 ? 'día' : 'días'}`;
  if (trials.length > 1) return `Probar gratis hasta ${Math.max(...trials)} días`;
  return plans.some((plan) => Number(plan.price) === 0) ? 'Crear cuenta gratis' : 'Crear mi cuenta';
}

// ─── Registro nativo de un comercio ────────────────────────────────────────

/** La dirección de la tienda a partir del nombre, igual que la web (slugifyTenantName). */
export function slugifyStoreName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Las mismas reglas de contraseña que la web (lib/auth/password-validation). */
export function passwordChecks(password: string) {
  return [
    { ok: password.length >= 8, label: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(password), label: 'Una letra mayúscula' },
    { ok: /[a-z]/.test(password), label: 'Una letra minúscula' },
    { ok: /[0-9]/.test(password), label: 'Un número' },
  ];
}

export type RegisterForm = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  /** Vacío: sale del nombre del comercio. */
  companySlug: string;
  businessVertical: string;
  plan: string;
};

export const emptyRegisterForm = (plan = ''): RegisterForm => ({
  fullName: '', email: '', password: '', confirmPassword: '', companyName: '', companySlug: '', businessVertical: '', plan,
});

/** La dirección que se va a guardar: la escrita o la que sale del nombre. */
export const storeSlugOf = (form: Pick<RegisterForm, 'companySlug' | 'companyName'>) => slugifyStoreName(form.companySlug || form.companyName);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type RegisterField = keyof RegisterForm;

/** Lo que falta o está mal, por campo, con las mismas reglas que valida el servidor. */
export function registerIssues(form: RegisterForm): Partial<Record<RegisterField, string>> {
  const issues: Partial<Record<RegisterField, string>> = {};
  if (form.fullName.trim().length < 2) issues.fullName = 'Escribí tu nombre completo.';
  if (!EMAIL.test(form.email.trim())) issues.email = 'Revisá el email: parece incompleto.';
  const failed = passwordChecks(form.password).find((check) => !check.ok);
  if (failed) issues.password = `La contraseña necesita: ${failed.label.toLowerCase()}.`;
  if (!form.confirmPassword || form.confirmPassword !== form.password) issues.confirmPassword = 'Las contraseñas no coinciden.';
  if (form.companyName.trim().length < 2) issues.companyName = 'Escribí el nombre de tu comercio.';
  if (storeSlugOf(form).length < 3) issues.companySlug = 'La dirección de tu tienda necesita al menos 3 letras o números.';
  if (!form.plan) issues.plan = 'Elegí un plan para continuar.';
  return issues;
}

/** Lo que espera POST /api/auth/register-company, igual que la web. */
export function registerPayload(form: RegisterForm, captchaToken: string) {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    password: form.password,
    companyName: form.companyName.trim(),
    companySlug: storeSlugOf(form),
    ...(form.businessVertical ? { businessVertical: form.businessVertical } : {}),
    plan: form.plan,
    captchaToken,
  };
}

/** El token que devuelve la verificación de seguridad (o null si se canceló). */
export function parseCaptchaReturn(params: Record<string, string | string[] | undefined | null>): string | null {
  const raw = params.captcha;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return token && token.length >= 10 ? token : null;
}
