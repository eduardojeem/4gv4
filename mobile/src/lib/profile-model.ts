/** Personal profile payload: never copy email, roles, or organization fields. */
export function profilePatch(input: { name: string; phone: string; jobTitle: string }) {
  return { fullName: input.name.trim(), phone: input.phone.trim(), jobTitle: input.jobTitle.trim() };
}

export function avatarUploadPath(userId: string, mimeType: string, timestamp: number) {
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!/^[a-zA-Z0-9-]+$/.test(userId) || !extensions[mimeType]) throw new Error('Sesión o formato de imagen inválido.');
  return userId + '/avatar-' + timestamp + '.' + extensions[mimeType];
}
