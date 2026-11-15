import type { Ionicons } from '@expo/vector-icons';
import type { PanelData, PanelGroup, PanelItem } from './panel';
import { filterSectionGroups, sectionMenuRoute } from './sections-menu-model';

export const MAX_PINNED_SHORTCUTS = 4;

export const PANEL_GRID_PRIORITY = [
  'pos',
  'cash-register',
  'repairs',
  'orders',
  'agenda',
  'products',
  'customers',
  'credits',
  'promotions',
  'quotes',
  'inventory-count',
  'pos-analytics',
  'expirations',
  'suppliers',
  'after-sales',
  'categories',
  'brands',
  'repair-inventory',
  'technician',
] as const;

export const PANEL_TILE_SHORT_LABELS: Record<string, string> = {
  overview: 'Inicio',
  pos: 'POS',
  'cash-register': 'Caja',
  repairs: 'Taller',
  agenda: 'Agenda',
  orders: 'Pedidos',
  products: 'Productos',
  customers: 'Clientes',
  credits: 'Créditos',
  promotions: 'Promos',
  quotes: 'Presup.',
  'inventory-count': 'Stock',
  expirations: 'Vencim.',
  suppliers: 'Proveed.',
  'after-sales': 'Posventa',
  'pos-analytics': 'Analítica',
  categories: 'Categ.',
  brands: 'Marcas',
  'repair-inventory': 'Repuestos',
  technician: 'Técnico',
  administration: 'Admin',
  'action:new-repair': '+ Repar.',
  'action:open-cash': 'Abrir caja',
  'action:new-sale': '+ Venta',
  'action:new-order': '+ Pedido',
  'action:new-reservation': '+ Turno',
};

export type PanelShortcutKind = 'section' | 'action';

export type PanelShortcutItem = {
  key: string;
  kind: PanelShortcutKind;
  label: string;
  shortLabel: string;
  description: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  groupLabel: string;
  sectionKey?: string;
};

export type PanelTileTone = {
  lightBg: string;
  lightBorder: string;
  lightIcon: string;
  darkBg: string;
  darkBorder: string;
  darkIcon: string;
};

const TINTED_TONES: Record<number, PanelTileTone> = {
  0: {
    lightBg: '#DCFCE7',
    lightBorder: '#86EFAC',
    lightIcon: '#047857',
    darkBg: 'rgba(16, 185, 129, 0.2)',
    darkBorder: 'rgba(52, 211, 153, 0.36)',
    darkIcon: '#6EE7B7',
  },
  1: {
    lightBg: '#DBEAFE',
    lightBorder: '#93C5FD',
    lightIcon: '#1D4ED8',
    darkBg: 'rgba(37, 99, 235, 0.22)',
    darkBorder: 'rgba(96, 165, 250, 0.38)',
    darkIcon: '#93C5FD',
  },
  2: {
    lightBg: '#CFFAFE',
    lightBorder: '#67E8F9',
    lightIcon: '#0E7490',
    darkBg: 'rgba(6, 182, 212, 0.2)',
    darkBorder: 'rgba(34, 211, 238, 0.36)',
    darkIcon: '#67E8F9',
  },
  3: {
    lightBg: '#EDE9FE',
    lightBorder: '#C4B5FD',
    lightIcon: '#6D28D9',
    darkBg: 'rgba(139, 92, 246, 0.2)',
    darkBorder: 'rgba(167, 139, 250, 0.38)',
    darkIcon: '#C4B5FD',
  },
};

const NEUTRAL_TONE: PanelTileTone = {
  lightBg: '#F8FAFC',
  lightBorder: '#E2E8F0',
  lightIcon: '#0F172A',
  darkBg: '#1E293B',
  darkBorder: '#334155',
  darkIcon: '#E2E8F0',
};

const QUICK_ACTION_TONE: PanelTileTone = {
  lightBg: '#EFF6FF',
  lightBorder: '#BFDBFE',
  lightIcon: '#1D4ED8',
  darkBg: 'rgba(37, 99, 235, 0.16)',
  darkBorder: 'rgba(96, 165, 250, 0.34)',
  darkIcon: '#93C5FD',
};

const SECTION_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
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

const PRIORITY_MAP = new Map<string, number>(
  PANEL_GRID_PRIORITY.map((key, index) => [key, index])
);

const normalizeQuery = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function panelTileShortLabel(
  item: Pick<PanelItem, 'key' | 'label' | 'mobileLabel'>
): string {
  return PANEL_TILE_SHORT_LABELS[item.key] ?? item.mobileLabel ?? item.label;
}

export function panelTileTone(index: number, kind: PanelShortcutKind = 'section'): PanelTileTone {
  if (index >= 0 && index < MAX_PINNED_SHORTCUTS) return TINTED_TONES[index];
  return kind === 'action' ? QUICK_ACTION_TONE : NEUTRAL_TONE;
}

/**
 * Ordena las secciones permitidas para la grilla compacta 4xN del Panel.
 * Omite `overview` (ya es la pestaña Inicio) y `administration` (vive en el botón destacado inferior).
 */
export function buildPanelGridItems(
  groups: PanelGroup[],
  businessFocus?: 'repairs' | 'agenda' | null
): PanelItem[] {
  const flat = groups
    .flatMap((group) => group.items)
    .filter((item) => item.key !== 'overview' && item.key !== 'administration');

  const seen = new Set<string>();
  const unique = flat.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });

  const rankOf = (key: string) => {
    if (businessFocus === 'agenda' && key === 'agenda') return 1.5;
    return PRIORITY_MAP.get(key) ?? Number.MAX_SAFE_INTEGER;
  };

  return unique.sort((a, b) => rankOf(a.key) - rankOf(b.key));
}

/**
 * Acciones rápidas opcionales (Nueva reparación, Abrir caja, Nueva venta, Nuevo pedido, Nueva reserva),
 * habilitadas estrictamente según módulos y permisos reales del usuario.
 */
export function buildPanelQuickActions(data: PanelData | null): PanelShortcutItem[] {
  if (!data) return [];
  const sectionKeys = new Set(data.groups.flatMap((group) => group.items.map((item) => item.key)));
  const capabilities = data.capabilities ?? {};
  const actions: PanelShortcutItem[] = [];

  if (sectionKeys.has('repairs') && capabilities['repairs.orders.create']) {
    actions.push({
      key: 'action:new-repair',
      kind: 'action',
      label: 'Nueva reparación',
      shortLabel: PANEL_TILE_SHORT_LABELS['action:new-repair'],
      description: 'Cargar ingreso al taller',
      route: '/panel/repairs/new',
      icon: 'construct-outline',
      groupLabel: 'Acción rápida',
      sectionKey: 'repairs',
    });
  }

  if (sectionKeys.has('cash-register')) {
    actions.push({
      key: 'action:open-cash',
      kind: 'action',
      label: 'Abrir caja',
      shortLabel: PANEL_TILE_SHORT_LABELS['action:open-cash'],
      description: 'Iniciar o controlar turno de caja',
      route: '/panel/cash-register',
      icon: 'lock-open-outline',
      groupLabel: 'Acción rápida',
      sectionKey: 'cash-register',
    });
  }

  if (sectionKeys.has('pos') && capabilities['pos.sales.create']) {
    actions.push({
      key: 'action:new-sale',
      kind: 'action',
      label: 'Nueva venta',
      shortLabel: PANEL_TILE_SHORT_LABELS['action:new-sale'],
      description: 'Cobrar en el punto de venta',
      route: '/panel/pos',
      icon: 'cart-outline',
      groupLabel: 'Acción rápida',
      sectionKey: 'pos',
    });
  }

  if (sectionKeys.has('orders') && capabilities['ecommerce.orders.manage']) {
    actions.push({
      key: 'action:new-order',
      kind: 'action',
      label: 'Nuevo pedido',
      shortLabel: PANEL_TILE_SHORT_LABELS['action:new-order'],
      description: 'Registrar pedido o envío',
      route: '/panel/orders/new',
      icon: 'bag-add-outline',
      groupLabel: 'Acción rápida',
      sectionKey: 'orders',
    });
  }

  if (sectionKeys.has('agenda') && capabilities['agenda.create']) {
    actions.push({
      key: 'action:new-reservation',
      kind: 'action',
      label: 'Nueva reserva',
      shortLabel: PANEL_TILE_SHORT_LABELS['action:new-reservation'],
      description: 'Agendar turno en la agenda',
      route: '/panel/agenda/form',
      icon: 'calendar-outline',
      groupLabel: 'Acción rápida',
      sectionKey: 'agenda',
    });
  }

  const primary = data.organization.primaryActivity==='pos'?'pos':data.businessFocus;
  return actions.sort((a,b)=>Number(b.sectionKey===primary)-Number(a.sectionKey===primary));
}

export function buildPanelSectionShortcuts(
  groups: PanelGroup[],
  businessFocus?: 'repairs' | 'agenda' | null
): PanelShortcutItem[] {
  const groupByKey = new Map<string, string>();
  for (const group of groups) {
    for (const item of group.items) {
      if (!groupByKey.has(item.key)) groupByKey.set(item.key, group.label);
    }
  }

  return buildPanelGridItems(groups, businessFocus).map((item) => ({
    key: item.key,
    kind: 'section',
    label: item.label,
    shortLabel: panelTileShortLabel(item),
    description: item.description,
    route: sectionMenuRoute(item.key),
    icon: SECTION_ICON_MAP[item.key] ?? 'ellipse-outline',
    groupLabel: groupByKey.get(item.key) ?? 'Panel',
    sectionKey: item.key,
  }));
}

export function defaultPinnedShortcutKeys(
  sectionShortcuts: Pick<PanelShortcutItem, 'key'>[],
  max = MAX_PINNED_SHORTCUTS
): string[] {
  return sectionShortcuts.slice(0, max).map((item) => item.key);
}

/**
 * Valida las claves guardadas contra los accesos autorizados actuales
 * (nunca expone claves de módulos/permisos revocados) y completa hasta 4.
 */
export function resolvePinnedShortcutKeys(
  savedKeys: readonly string[] | null | undefined,
  availableShortcuts: readonly PanelShortcutItem[],
  defaultSectionShortcuts: readonly PanelShortcutItem[],
  max = MAX_PINNED_SHORTCUTS
): string[] {
  const validKeys = new Set(availableShortcuts.map((item) => item.key));
  const resolved: string[] = [];

  for (const key of savedKeys ?? []) {
    if (validKeys.has(key) && !resolved.includes(key)) {
      resolved.push(key);
      if (resolved.length >= max) return resolved;
    }
  }

  for (const fallback of [...defaultSectionShortcuts, ...availableShortcuts]) {
    if (!resolved.includes(fallback.key)) {
      resolved.push(fallback.key);
      if (resolved.length >= max) break;
    }
  }

  return resolved;
}

export function togglePinnedShortcutKey(
  currentKeys: readonly string[],
  targetKey: string,
  max = MAX_PINNED_SHORTCUTS
): string[] {
  if (currentKeys.includes(targetKey)) {
    return currentKeys.filter((key) => key !== targetKey);
  }
  if (currentKeys.length < max) {
    return [...currentKeys, targetKey];
  }
  return [...currentKeys.slice(1), targetKey];
}

export const pinnedShortcutsStorageKey = (organizationId?: string | null) =>
  organizationId
    ? `panel_pinned_shortcuts_v1.${organizationId}`
    : 'panel_pinned_shortcuts_v1';

export function filterPanelQuickSearch(
  groups: PanelGroup[],
  query: string,
  quickActions: readonly PanelShortcutItem[] = []
): PanelShortcutItem[] {
  const terms = normalizeQuery(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const matchedActions = quickActions.filter((action) => {
    const haystack = normalizeQuery(
      `${action.label} ${action.shortLabel} ${action.description} ${action.groupLabel}`
    );
    return terms.every((term) => haystack.includes(term));
  });

  const matchedSections: PanelShortcutItem[] = filterSectionGroups(groups, query).flatMap((group) =>
    group.items.map((item) => ({
      key: item.key,
      kind: 'section' as const,
      label: item.label,
      shortLabel: panelTileShortLabel(item),
      description: item.description,
      route: sectionMenuRoute(item.key),
      icon: SECTION_ICON_MAP[item.key] ?? ('ellipse-outline' as keyof typeof Ionicons.glyphMap),
      groupLabel: group.label,
      sectionKey: item.key,
    }))
  );

  return [...matchedActions, ...matchedSections];
}
