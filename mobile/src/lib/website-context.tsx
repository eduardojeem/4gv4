import { getPrivateCacheContext } from './private-cache-context';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from './api';
import { usePanel } from './panel';
import {
  deleteWebsiteMedia,
  fetchTemplateAccess,
  fetchWebsiteMedia,
  fetchWebsiteSettings,
  websiteErrorMessage,
} from './website-admin';
import {
  buildMobileWebsiteChecklist,
  resolveMobileCapabilities,
  resolveMobileSectionAvailability,
  resolveStorefrontStyle,
  type CompanyInfo,
  type MobileSetupChecklist,
  type MobileStorefrontCapabilities,
  type SectionAvailability,
  type StorefrontStyle,
  type TemplateAccessData,
  type WebsiteMediaItem,
  type WebsiteSectionId,
  type WebsiteSettings,
} from './website-model';

export type MediaQuotaState = {
  items: WebsiteMediaItem[];
  count: number;
  limit: number;
  loading: boolean;
  isAtLimit: boolean;
};

type WebsiteState = {
  /** Lo último que confirmó el servidor (la base para mezclar cambios). */
  settings: WebsiteSettings | null;
  templateAccess: TemplateAccessData | null;
  capabilities: MobileStorefrontCapabilities;
  resolvedStyle: StorefrontStyle;
  availability: Record<WebsiteSectionId, SectionAvailability>;
  checklist: MobileSetupChecklist | null;
  mediaQuota: MediaQuotaState;
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
  reloadMedia: () => Promise<void>;
  removeMediaItem: (target: {
    id?: string;
    path?: string;
    url?: string;
  }) => Promise<number>;
  /** Reemplaza las claves guardadas con lo que devolvió el servidor. */
  applySaved: (
    patch: Partial<WebsiteSettings> & { company_info?: CompanyInfo },
  ) => void;
};

/** Lo cargado, siempre atado al comercio para el que se pidió. */
type Loaded = {
  organizationId: string;
  settings: WebsiteSettings | null;
  templateAccess: TemplateAccessData | null;
  error: string | null;
  offline: boolean;
  forbidden: boolean;
};

type LoadedMedia = {
  organizationId: string;
  items: WebsiteMediaItem[];
  count: number;
  limit: number;
};

const WebsiteContext = createContext<WebsiteState | null>(null);

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const { data } = usePanel();
  const organizationId = data?.organization.id ?? null;
  const role = data?.organization.role ?? null;
  const canEdit = Boolean(
    data?.user.isSuperAdmin || role === 'owner' || role === 'admin',
  );
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadedMedia, setLoadedMedia] = useState<LoadedMedia | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const mediaSequence = useRef(0);

  const loadMediaForOrg = useCallback(async (forOrganization: string) => {
    const request = ++mediaSequence.current;
    const scope = getPrivateCacheContext();
    setMediaLoading(true);
    try {
      const quota = await fetchWebsiteMedia();
      if (
        request !== mediaSequence.current ||
        scope.epoch !== getPrivateCacheContext().epoch
      )
        return;
      setLoadedMedia({
        organizationId: forOrganization,
        items: quota.items,
        count: quota.count,
        limit: quota.limit,
      });
    } catch {
      // No bloquear la edición del sitio si falla la lectura de cuota de medios.
    } finally {
      if (request === mediaSequence.current) setMediaLoading(false);
    }
  }, []);

  const load = useCallback(
    async (forOrganization: string) => {
      const request = ++sequence.current;
      const scope = getPrivateCacheContext();
      try {
        const [settings, templateAccess] = await Promise.all([
          fetchWebsiteSettings(),
          fetchTemplateAccess(),
        ]);
        if (
          request !== sequence.current ||
          scope.epoch !== getPrivateCacheContext().epoch
        )
          return;
        setLoaded({
          organizationId: forOrganization,
          settings,
          templateAccess,
          error: null,
          offline: false,
          forbidden: false,
        });
        void loadMediaForOrg(forOrganization);
      } catch (cause) {
        if (
          request !== sequence.current ||
          scope.epoch !== getPrivateCacheContext().epoch
        )
          return;
        const status = cause instanceof ApiError ? cause.status : -1;
        // Si falla, se conserva lo último cargado de ESTE comercio.
        setLoaded((current) => ({
          organizationId: forOrganization,
          settings:
            current?.organizationId === forOrganization ? current.settings : null,
          templateAccess:
            current?.organizationId === forOrganization
              ? current.templateAccess
              : null,
          error: websiteErrorMessage(
            cause,
            'No pudimos cargar el sitio web. Intentá nuevamente.',
          ),
          offline: status === 0,
          forbidden: status === 403,
        }));
      } finally {
        if (request === sequence.current) setRefreshing(false);
      }
    },
    [loadMediaForOrg],
  );

  // Otro comercio: lo cargado no sirve ni se muestra; se pide de nuevo.
  const current =
    loaded && loaded.organizationId === organizationId ? loaded : null;
  useEffect(() => {
    if (organizationId && canEdit && !current) void load(organizationId);
  }, [organizationId, canEdit, current, load]);

  const reload = useCallback(async () => {
    if (!organizationId) return;
    setRefreshing(true);
    await load(organizationId);
  }, [organizationId, load]);

  const reloadMedia = useCallback(async () => {
    if (!organizationId || !canEdit) return;
    await loadMediaForOrg(organizationId);
  }, [organizationId, canEdit, loadMediaForOrg]);

  const removeMediaItem = useCallback(
    async (target: { id?: string; path?: string; url?: string }) => {
      const result = await deleteWebsiteMedia(target);
      if (organizationId) {
        setLoadedMedia((prev) => {
          if (!prev || prev.organizationId !== organizationId) return prev;
          const nextItems = prev.items.filter(
            (item) =>
              !(
                (target.id && item.id === target.id) ||
                (target.path && item.path === target.path) ||
                (target.url && item.url === target.url)
              ),
          );
          return {
            ...prev,
            items: nextItems,
            count:
              typeof result.count === 'number'
                ? result.count
                : nextItems.length,
            limit: result.limit || prev.limit,
          };
        });
      }
      return result.count;
    },
    [organizationId],
  );

  const applySaved = useCallback(
    (patch: Partial<WebsiteSettings> & { company_info?: CompanyInfo }) => {
      // El servidor devuelve cada clave completa y validada: reemplaza a la anterior.
      // Si mientras se guardaba se cambió de comercio, no se mezcla con el otro.
      setLoaded((value) =>
        value?.settings && value.organizationId === organizationId
          ? {
              ...value,
              settings: { ...value.settings, ...patch } as WebsiteSettings,
            }
          : value,
      );
    },
    [organizationId],
  );

  const panelKeys = useMemo(
    () => (data?.groups ?? []).flatMap((g) => g.items.map((i) => i.key)),
    [data?.groups],
  );

  const currentSettings = current?.settings ?? null;
  const currentAccess = current?.templateAccess ?? null;

  const capabilities = useMemo(
    () =>
      resolveMobileCapabilities({
        templateAccess: currentAccess,
        panelKeys,
        panelFocus: data?.businessFocus ?? null,
        company: currentSettings?.company_info,
      }),
    [currentAccess, panelKeys, data?.businessFocus, currentSettings?.company_info],
  );

  const resolvedStyle = useMemo(
    () =>
      resolveStorefrontStyle(
        currentSettings?.company_info.storefrontStyle,
        capabilities.businessVertical,
        {
          servicesAvailable: capabilities.hasServices,
          catalogAvailable: capabilities.hasCatalog,
          commerceMode: currentSettings?.checkout?.commerceMode,
        },
      ),
    [
      currentSettings?.company_info.storefrontStyle,
      currentSettings?.checkout?.commerceMode,
      capabilities.businessVertical,
      capabilities.hasServices,
      capabilities.hasCatalog,
    ],
  );

  const availability = useMemo(
    () => resolveMobileSectionAvailability(capabilities),
    [capabilities],
  );

  const checklist = useMemo(
    () =>
      currentSettings
        ? buildMobileWebsiteChecklist(currentSettings, capabilities)
        : null,
    [currentSettings, capabilities],
  );

  const mediaQuota = useMemo<MediaQuotaState>(() => {
    const activeMedia =
      loadedMedia && loadedMedia.organizationId === organizationId
        ? loadedMedia
        : null;
    const count = activeMedia?.count ?? 0;
    const limit = activeMedia?.limit ?? 20;
    return {
      items: activeMedia?.items ?? [],
      count,
      limit,
      loading: mediaLoading,
      isAtLimit: count >= limit,
    };
  }, [loadedMedia, organizationId, mediaLoading]);

  const value = useMemo<WebsiteState>(
    () => ({
      settings: currentSettings,
      templateAccess: currentAccess,
      capabilities,
      resolvedStyle,
      availability,
      checklist,
      mediaQuota,
      loading: Boolean(organizationId && canEdit && !current),
      refreshing,
      error: current?.error ?? null,
      offline: current?.offline ?? false,
      forbidden: current?.forbidden ?? false,
      canEdit,
      organizationName: data?.organization.name ?? null,
      reload,
      reloadMedia,
      removeMediaItem,
      applySaved,
    }),
    [
      currentSettings,
      currentAccess,
      capabilities,
      resolvedStyle,
      availability,
      checklist,
      mediaQuota,
      organizationId,
      canEdit,
      current,
      refreshing,
      data?.organization.name,
      reload,
      reloadMedia,
      removeMediaItem,
      applySaved,
    ],
  );

  return (
    <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>
  );
}

export function useWebsite() {
  const value = useContext(WebsiteContext);
  if (!value) throw new Error('useWebsite fuera de WebsiteProvider');
  return value;
}
