import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from './api';
import { accountDataFor, businessFromResponse, type BusinessAccess, type BusinessOrg } from './marketplace-account-model';
import { useSession } from './session';

export { accountDisplayName, canOpenBusinessPanel, PANEL_ROLES } from './marketplace-account-model';
export type { BusinessAccess } from './marketplace-account-model';

/**
 * Quién está usando el marketplace y qué puede hacer: invitado, comprador o
 * comprador con negocio. Lo comparten el menú del avatar y la pestaña Perfil
 * para que digan lo mismo.
 *
 * Todo queda atado al usuario de la sesión: al cerrar sesión o cambiar de
 * cuenta se descarta lo anterior y una respuesta que llega tarde (de la cuenta
 * vieja) se ignora. Antes el nombre y el rol del negocio anterior seguían en
 * pantalla.
 */

export type MarketplaceAccount = {
  kind: 'guest' | 'buyer';
  status: 'idle' | 'loading' | 'ready' | 'error';
  userId: string | null;
  email: string | null;
  /** Nombre real del perfil; null si no lo cargó (nunca el prefijo del correo). */
  fullName: string | null;
  avatarUrl: string | null;
  business: BusinessAccess;
  reload: () => void;
};

type Loaded = {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  business: BusinessAccess;
  failed: boolean;
};

const settle = <T,>(promise: Promise<T>) => promise.then(
  (data) => ({ ok: true as const, data }),
  (error: unknown) => ({ ok: false as const, error }),
);

export function useMarketplaceAccount(): MarketplaceAccount {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    Promise.all([
      settle(apiFetch<{ profile?: { fullName?: string; avatarUrl?: string } }>('/api/dashboard/profile')),
      settle(apiFetch<{ activeOrganization?: BusinessOrg }>('/api/organization-context')),
    ]).then(([profile, organization]) => {
      // Si mientras tanto cambió la cuenta, esta respuesta ya no sirve.
      if (!active) return;
      setLoaded({
        userId,
        fullName: profile.ok ? profile.data.profile?.fullName?.trim() || null : null,
        avatarUrl: profile.ok ? profile.data.profile?.avatarUrl || null : null,
        business: businessFromResponse(organization),
        failed: !profile.ok || businessFromResponse(organization).state === 'unknown',
      });
    });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (!userId) {
    return { kind: 'guest', status: 'idle', userId: null, email: null, fullName: null, avatarUrl: null, business: { state: 'none' }, reload };
  }
  // Datos de otra cuenta (la anterior) no se muestran nunca.
  const mine = accountDataFor(loaded, userId);
  return {
    kind: 'buyer',
    status: !mine ? 'loading' : mine.failed ? 'error' : 'ready',
    userId,
    email,
    fullName: mine?.fullName ?? null,
    avatarUrl: mine?.avatarUrl ?? null,
    business: mine?.business ?? { state: 'unknown' },
    reload,
  };
}
