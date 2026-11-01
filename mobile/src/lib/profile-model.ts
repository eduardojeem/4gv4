/**
 * Reglas de la pantalla «Mi perfil», separadas para poder probarlas.
 *
 * La API (/api/dashboard/profile) acepta texto vacío pero no `null`: antes la
 * app mandaba `phone: null` cuando el teléfono quedaba vacío y el servidor
 * rechazaba todo el guardado con «Datos de perfil inválidos».
 */

export type ProfileDraft = { fullName: string; phone: string; jobTitle: string };

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const PASSWORD_MIN = 8;

export function profilePatch(draft: ProfileDraft, saved: ProfileDraft): Partial<ProfileDraft> {
  const next = { fullName: draft.fullName.trim(), phone: draft.phone.trim(), jobTitle: draft.jobTitle.trim() };
  const patch: Partial<ProfileDraft> = {};
  (Object.keys(next) as (keyof ProfileDraft)[]).forEach((key) => {
    if (next[key] !== saved[key].trim()) patch[key] = next[key];
  });
  return patch;
}

export const isProfileDirty = (draft: ProfileDraft, saved: ProfileDraft) => Object.keys(profilePatch(draft, saved)).length > 0;

export function nameError(name: string): string | null {
  const value = name.trim();
  if (value.length < NAME_MIN) return 'Escribí tu nombre (al menos 2 letras).';
  if (value.length > NAME_MAX) return 'El nombre es muy largo.';
  return null;
}

/** Teléfono opcional: si se escribe, que tenga al menos 6 dígitos. */
export function phoneError(phone: string): string | null {
  const value = phone.trim();
  if (!value) return null;
  if (!/^[+\d\s()-]+$/.test(value)) return 'Usá solo números, espacios, + o guiones.';
  if (value.replace(/\D/g, '').length < 6) return 'El teléfono parece incompleto.';
  return null;
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const clamped = Math.min(4, score) as PasswordStrength['score'];
  return { score: clamped, label: ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy buena'][clamped] };
}

export function passwordChangeError(input: { current: string; next: string; confirm: string }): string | null {
  if (!input.current) return 'Escribí tu contraseña actual.';
  if (input.next.length < PASSWORD_MIN) return `La nueva contraseña necesita al menos ${PASSWORD_MIN} caracteres.`;
  if (input.next === input.current) return 'La nueva contraseña tiene que ser distinta de la actual.';
  if (input.next !== input.confirm) return 'La confirmación no coincide con la nueva contraseña.';
  return null;
}

/** Carpeta propia del usuario: es lo que permite la política del bucket `avatars`. */
export function avatarPath(userId: string, mimeType: string | null | undefined, now = Date.now()) {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return `${userId}/avatar-${now}.${extension}`;
}

/** Ruta dentro del bucket a partir de la URL pública, para borrar la foto anterior. */
export function avatarStoragePath(publicUrl: string | null | undefined, userId: string): string | null {
  if (!publicUrl) return null;
  const marker = '/storage/v1/object/public/avatars/';
  const index = publicUrl.indexOf(marker);
  if (index < 0) return null;
  const path = decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) ? path : null;
}
