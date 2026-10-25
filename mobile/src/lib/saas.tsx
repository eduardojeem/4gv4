import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import { apiFetch } from './api';
import { SITE_URL } from './marketplace';
import { openRegistration } from './registration';
import { resolveSaasHref } from './saas-navigation';

export type SaasPlan = {
  id: string;
  tier: string;
  public_slug: string | null;
  name: string;
  price: number;
  price_note: string | null;
  description: string | null;
  is_popular: boolean;
  trial_days: number;
  limits: { key: string; label: string; value: string }[];
  features: { key: string; label: string }[];
  ctaHref: string;
};

export type SaasCatalog = {
  plans: SaasPlan[];
  branding: {
    name: string;
    logoUrl: string | null;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };
};

type CatalogState = {
  catalog: SaasCatalog | null;
  loading: boolean;
  error: string | null;
  updatedAt: Date | null;
  refresh: () => void;
};

const SaasContext = createContext<CatalogState | null>(null);

export function SaasProvider({ children }: PropsWithChildren) {
  const [catalog, setCatalog] = useState<SaasCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<SaasCatalog>('/api/mobile/saas', { auth: false })
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        setUpdatedAt(new Date());
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo consultar el catálogo.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  return <SaasContext.Provider value={{ catalog, loading, error, updatedAt, refresh }}>{children}</SaasContext.Provider>;
}

export function useSaas() {
  const value = useContext(SaasContext);
  if (!value) throw new Error('useSaas requiere el layout de SaaS');
  return value;
}

export async function openSaasLink(href: string) {
  // El registro vuelve solo a la app al terminar.
  if (/^\/register(?:[?#]|$)/.test(href)) {
    await openRegistration(href);
    return;
  }
  const url = resolveSaasHref(href, SITE_URL);
  if (!url) {
    Alert.alert('Enlace no disponible', 'No se pudo abrir este enlace. Probá de nuevo más tarde.');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert('No se pudo abrir el enlace', 'Revisá tu conexión y volvé a intentarlo.');
  }
}
