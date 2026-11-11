import { passwordChecks } from './registration-model';
export type CustomerForm = { fullName: string; email: string; password: string; confirmPassword: string };
export function customerIssues(form: CustomerForm): Partial<Record<keyof CustomerForm, string>> {
  const issues: Partial<Record<keyof CustomerForm, string>> = {};
  if (form.fullName.trim().length < 2) issues.fullName = 'Escribí tu nombre y apellido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) issues.email = 'Revisá tu correo electrónico.';
  const failed = passwordChecks(form.password).find(check => !check.ok);
  if (failed) issues.password = `La contraseña necesita: ${failed.label.toLowerCase()}.`;
  if (form.password !== form.confirmPassword || !form.confirmPassword) issues.confirmPassword = 'Las contraseñas no coinciden.';
  return issues;
}
export function customerPayload(form: CustomerForm, captchaToken: string) {
  return { fullName: form.fullName.trim(), email: form.email.trim(), password: form.password, captchaToken };
}
/** A production server intentionally does not redirect security tokens to arbitrary Expo Go hosts. */
export function captchaEnvironmentError(returnUrl: string, siteUrl: string): string | null {
  const target = new URL(returnUrl);
  const site = new URL(siteUrl);
  return ['exp:', 'exps:'].includes(target.protocol) && site.protocol === 'https:'
    ? 'Para completar este registro con el sitio publicado, usá una compilación de desarrollo de MiTiendaPy. En Expo Go, probalo con el servidor local. Tus datos todavía no se enviaron.' : null;
}