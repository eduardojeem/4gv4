/** Indica cuándo una confirmación de sesión no requiere volver a leer el perfil. */
export function shouldReuseAuthenticatedUser(
  event: string,
  nextUserId: string | null,
  currentUserId: string | null,
  sameAccessToken = false,
): boolean {
  return Boolean(
    nextUserId && currentUserId === nextUserId
    && (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && sameAccessToken)),
  )
}
