/** Indica cuándo una confirmación de sesión no requiere volver a leer el perfil. */
export function shouldReuseAuthenticatedUser(
  event: string,
  nextUserId: string | null,
  currentUserId: string | null,
  sameAccessToken = false,
): boolean {
  return Boolean(
    nextUserId && currentUserId === nextUserId
    // Pasar el código de 2FA renueva el token (aal2) del mismo usuario: es como un refresh.
    && (event === 'TOKEN_REFRESHED' || event === 'MFA_CHALLENGE_VERIFIED' || (event === 'SIGNED_IN' && sameAccessToken)),
  )
}
