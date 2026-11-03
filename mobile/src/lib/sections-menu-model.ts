import type { PanelGroup } from './panel';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/** Filter the already authorized menu; never create access from a search term. */
export function filterSectionGroups(groups: PanelGroup[], query: string): PanelGroup[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return groups;
  return groups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const haystack = normalize([group.label, item.label, item.mobileLabel, item.description].filter(Boolean).join(' '));
      return terms.every(term => haystack.includes(term));
    }),
  })).filter(group => group.items.length > 0);
}
export const sectionMenuRoute = (key: string) => key === 'administration' ? '/admin' : key === 'overview' ? '/panel' : '/panel/' + key;
export function sectionMenuActive(pathname: string, key: string) {
  const route = sectionMenuRoute(key);
  return pathname === route || (key !== 'overview' && pathname.startsWith(route + '/'));
}
