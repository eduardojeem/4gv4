import type { Ionicons } from '@expo/vector-icons';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { apiFetch } from './api';

export type PanelItem = { key: string; label: string; mobileLabel: string | null; href: string; description: string };
export type PanelGroup = { id: string; label: string; items: PanelItem[] };

export type PanelData = {
  user: { email: string | null; name: string | null; avatarUrl: string | null; isAdmin: boolean; isSuperAdmin: boolean };
  organization: { id: string; name: string; slug: string; logoUrl: string | null; role: string; plan: string };
  groups: PanelGroup[];
  tabs: string[];
  capabilities?: Record<string, boolean>;
};

type IconName = keyof typeof Ionicons.glyphMap;

/** Los íconos de la web son de lucide; acá se usa el equivalente de Ionicons por sección. */
export const SECTION_ICONS: Record<string, IconName> = {
  overview: 'speedometer-outline',
  pos: 'cart-outline',
  agenda: 'calendar-outline',
  'cash-register': 'cash-outline',
  orders: 'clipboard-outline',
  quotes: 'document-text-outline',
  customers: 'people-outline',
  credits: 'wallet-outline',
  'after-sales': 'refresh-circle-outline',
  promotions: 'pricetags-outline',
  products: 'cube-outline',
  categories: 'pricetag-outline',
  brands: 'ribbon-outline',
  'inventory-count': 'barcode-outline',
  expirations: 'calendar-clear-outline',
  suppliers: 'car-outline',
  repairs: 'construct-outline',
  'repair-inventory': 'file-tray-stacked-outline',
  technician: 'checkbox-outline',
  'pos-analytics': 'analytics-outline',
  administration: 'settings-outline',
};

export const iconFor = (key: string): IconName => SECTION_ICONS[key] ?? 'ellipse-outline';

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  manager: 'Encargado',
  cashier: 'Cajero',
  technician: 'Técnico',
  seller: 'Vendedor',
};

/** Ruta de la app para cada sección: el resumen es la portada del panel. */
export const panelRoute = (key: string) => (key === 'overview' ? '/panel' : `/panel/${key}`);

type PanelContextValue = {
  data: PanelData | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  findItem: (key: string) => PanelItem | undefined;
  can: (permission: string) => boolean;
};

const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanel() {
  const value = use(PanelContext);
  if (!value) throw new Error('usePanel debe usarse dentro de <PanelProvider />');
  return value;
}

/** El menú se pide una vez al entrar al panel y lo comparten todas sus pantallas. */
export function PanelProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<PanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<PanelData>('/api/mobile/dashboard')
      .then((panel) => {
        if (!active) return;
        setData(panel);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el panel.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const findItem = useCallback(
    (key: string) => data?.groups.flatMap((group) => group.items).find((item) => item.key === key),
    [data]
  );

  return <PanelContext.Provider value={{ data, error, loading, reload, findItem, can: permission => data?.capabilities?.[permission] === true }}>{children}</PanelContext.Provider>;
}

const NATIVE_SECTIONS = new Set(['overview','products','categories','brands','customers','credits','orders','repairs','pos','cash-register','suppliers','inventory-count','after-sales','administration','technician']);
export const hasNativePanelSection = (key: string) => NATIVE_SECTIONS.has(key);
