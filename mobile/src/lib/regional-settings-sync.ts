import { useEffect, useState } from 'react';

import { apiFetch } from './api';
import { getPrivateCacheContext, isPrivateCacheSnapshotCompatible, subscribePrivateCacheContext } from './private-cache-context';
import { setMobileRegionalFormatConfig } from './regional-format';
import { useSession } from './session';

type SharedRegionalSettingsResponse = {
  data?: {
    country_code?: string | null;
    locale?: string | null;
    language?: string | null;
  };
};

/** Loads regional presentation settings and drops stale responses on account/org changes. */
export function useMobileRegionalSettings() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    const clear = () => setMobileRegionalFormatConfig({ locale: null, countryCode: null, language: null });

    if (!userId) {
      clear();
      return () => { active = false; };
    }

    const synchronize = () => {
      const version = ++requestVersion;
      const scope = getPrivateCacheContext();
      clear();
      void apiFetch<SharedRegionalSettingsResponse>('/api/settings/shared')
        .then((payload) => {
          if (!active || version !== requestVersion || scope.userId !== userId || !isPrivateCacheSnapshotCompatible(scope)) return;
          const data = payload.data;
          setMobileRegionalFormatConfig({
            locale: data?.locale ?? null,
            countryCode: data?.country_code ?? null,
            language: data?.language ?? null,
          });
          setRevision((revision) => revision + 1);
        })
        .catch(() => {
          // Keep the safe legacy/environment fallback after a read failure.
        });
    };

    const unsubscribe = subscribePrivateCacheContext((next, previous) => {
      if (next.userId !== previous.userId || next.organizationId !== previous.organizationId) synchronize();
    });
    synchronize();
    return () => {
      active = false;
      requestVersion += 1;
      unsubscribe();
      clear();
    };
  }, [userId]);
}
