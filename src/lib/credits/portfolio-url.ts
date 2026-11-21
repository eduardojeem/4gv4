// Cartera de la web: la API decide la sucursal por defecto cuando no se pide ninguna.
/** Qué sucursales pide la cartera: la elegida o, para dueño y administrador, todas. */
export function creditPortfolioUrl(scope: { branchId?: string | null; allBranches: boolean }) {
  if (scope.allBranches) return '/api/credits?branchId=all'
  return scope.branchId ? `/api/credits?branchId=${encodeURIComponent(scope.branchId)}` : '/api/credits'
}
