import type { PanelData } from './panel';

const BRAND: Record<string, string> = { blue: '#3B82F6', green: '#22C55E', purple: '#A855F7', orange: '#F97316', red: '#EF4444', indigo: '#6366F1', teal: '#14B8A6', rose: '#F43F5E', amber: '#F59E0B', emerald: '#10B981', cyan: '#06B6D4', sky: '#0EA5E9' };
export function navigationColor(value?: string, custom?: string) {
  const hex = value === 'custom' ? custom : value;
  if (hex && /^#([\da-f]{3}|[\da-f]{6})$/i.test(hex)) return hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
  return BRAND[value ?? ''] ?? BRAND.blue;
}
export function colorLuminance(hex: string) {
  const rgb = navigationColor(hex).slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
export function navigationInk(hex: string) { const light = colorLuminance(hex); return (light + .05) / (colorLuminance('#0B1120') + .05) >= 1.05 / (light + .05) ? '#0B1120' : '#FFFFFF'; }
export type CreateAction = { key: string; label: string; route: string; icon: 'construct-outline' | 'calendar-outline' | 'cart-outline' | 'bag-add-outline' };
export function bottomNavigation(data: PanelData | null) {
  const keys = new Set(data?.groups.flatMap(g => g.items.map(i => i.key)) ?? []);
  const actions: CreateAction[] = [];
  if (keys.has('repairs') && data?.capabilities?.['repairs.orders.create']) actions.push({ key: 'repairs', label: 'Nueva reparación', route: '/panel/repairs/new', icon: 'construct-outline' });
  if (keys.has('agenda') && data?.capabilities?.['agenda.create']) actions.push({ key: 'agenda', label: 'Nueva reserva', route: '/panel/agenda/form', icon: 'calendar-outline' });
  if (keys.has('pos') && data?.capabilities?.['pos.sales.create']) actions.push({ key: 'pos', label: 'Nueva venta', route: '/panel/pos', icon: 'cart-outline' });
  if (keys.has('orders') && data?.capabilities?.['ecommerce.orders.manage']) actions.push({ key: 'orders', label: 'Nuevo pedido', route: '/panel/orders/new', icon: 'bag-add-outline' });
  const focus = data?.businessFocus;
  const preferred = actions.find(a => a.key === focus) ?? actions[0];
  // «Crear» abre una lista: primero lo del rubro, después la venta (siempre que
  // pueda vender) y el pedido. Antes se cortaba en dos y la venta quedaba afuera.
  const choices = [preferred, actions.find(action => action.key === 'pos'), actions.find(action => action.key === 'orders'), ...actions].filter((action): action is CreateAction => Boolean(action)).filter((action, index, list) => list.findIndex(item => item.key === action.key) === index);
  const priorities = focus === 'agenda' ? ['overview', 'agenda', 'customers'] : focus === 'repairs' ? ['overview', 'repairs', 'cash-register'] : ['overview', 'products', 'cash-register'];
  const tabs = [...new Set([...priorities, ...(data?.tabs ?? [])])].filter(key => keys.has(key)).slice(0, choices.length ? 3 : 4);
  return { tabs, actions: choices };
}

export function navigationRouteActive(pathname: string, route: string) { return route === '/panel' ? pathname === route : pathname === route || pathname.startsWith(route + '/'); }
