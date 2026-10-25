import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError } from './api';
import { usePanel } from './panel';
import { fetchWebsiteSettings, websiteErrorMessage } from './website-admin';
import { type CompanyInfo, type WebsiteSettings } from './website-model';

type WebsiteState = {
  /** Lo último que confirmó el servidor (la base para mezclar cambios). */
  settings: WebsiteSettings | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** La última carga falló por falta de conexión (se muestra lo anterior). */
  offline: boolean;
  forbidden: boolean;
  /** Solo dueño o administrador del comercio (el servidor lo exige igual). */
  canEdit: boolean;
  organizationName: string | null;
  reload: () => Promise<void>;
  /** Reemplaza las claves guardadas con lo que devolvió el servidor. */
  applySaved: (patch: Partial<WebsiteSettings> & { company_info?: CompanyInfo }) => void;
};

/** Lo cargado, siempre atado al comercio para el que se pidió. */
type Loaded = { organizationId: string; settings: WebsiteSettings | null; error: string | null; offline: boolean; forbidden: boolean };

const WebsiteContext = createContext<WebsiteState | null>(null);

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const { data } = usePanel();
  const organizationId = data?.organization.id ?? null;
  const role = data?.organization.role ?? null;
  const canEdit = Boolean(data?.user.isSuperAdmin || role === 'owner' || role === 'admin');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (forOrganization: string) => {
    try {
      const settings = await fetchWebsiteSettings();
      setLoaded({ organizationId: forOrganization, settings, error: null, offline: false, forbidden: false });
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : -1;
      // Si falla, se conserva lo último cargado de ESTE comercio.
      setLoaded((current) => ({
        organizationId: forOrganization,
        settings: current?.organizationId === forOrganization ? current.settings : null,
        error: websiteErrorMessage(cause, 'No pudimos cargar el sitio web. Intentá nuevamente.'),
        offline: status === 0,
        forbidden: status === 403,
      }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Otro comercio: lo cargado no sirve ni se muestra; se pide de nuevo.
  const current = loaded && loaded.organizationId === organizationId ? loaded : null;
  useEffect(() => {
    if (organizationId && canEdit && !current) void load(organizationId);
  }, [organizationId, canEdit, current, load]);

  const reload = useCallback(async () => {
    if (!organizationId) return;
    setRefreshing(true);
    await load(organizationId);
  }, [organizationId, load]);

  const applySaved = useCallback((patch: Partial<WebsiteSettings> & { company_info?: CompanyInfo }) => {
    // El servidor devuelve cada clave completa y validada: reemplaza a la anterior.
    // Si mientras se guardaba se cambió de comercio, no se mezcla con el otro.
    setLoaded((value) => (value?.settings && value.organizationId === organizationId ? { ...value, settings: { ...value.settings, ...patch } as WebsiteSettings } : value));
  }, [organizationId]);

  const value = useMemo<WebsiteState>(() => ({
    settings: current?.settings ?? null,
    loading: Boolean(organizationId && canEdit && !current),
    refreshing,
    error: current?.error ?? null,
    offline: current?.offline ?? false,
    forbidden: current?.forbidden ?? false,
    canEdit,
    organizationName: data?.organization.name ?? null,
    reload,
    applySaved,
  }), [current, organizationId, canEdit, refreshing, data?.organization.name, reload, applySaved]);

  return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>;
}

export function useWebsite() {
  const value = useContext(WebsiteContext);
  if (!value) throw new Error('useWebsite fuera de WebsiteProvider');
  return value;
}
