import { describe, expect, it } from 'vitest'
import { bottomNavigation, navigationColor, navigationInk, colorLuminance, navigationRouteActive } from '../../mobile/src/lib/bottom-nav-model'
import type { PanelData } from '../../mobile/src/lib/panel'
const panel = (keys: string[], capabilities: Record<string, boolean> = {}, focus: PanelData['businessFocus'] = null) => ({ groups: [{ items: keys.map(key => ({key})) }], tabs: keys, capabilities, businessFocus: focus }) as PanelData
const contrast = (a: string, b: string) => (Math.max(colorLuminance(a),colorLuminance(b))+.05)/(Math.min(colorLuminance(a),colorLuminance(b))+.05)
describe('mobile contextual navigation', () => {
 it('keeps read-only repair access without exposing create', () => { const nav=bottomNavigation(panel(['overview','repairs','cash-register'],{},'repairs')); expect(nav.actions).toEqual([]);expect(nav.tabs).toContain('repairs') })
 it('prioritizes repair creation for workshops even with POS', () => { const nav=bottomNavigation(panel(['overview','repairs','pos','cash-register'],{'repairs.orders.create':true,'pos.sales.create':true},'repairs'));expect(nav.actions.map(a=>a.key)).toEqual(['repairs','pos']);expect(nav.tabs).toEqual(['overview','repairs','cash-register']) })
 it('uses reservation for services',()=>{expect(bottomNavigation(panel(['overview','agenda','customers'],{'agenda.create':true},'agenda')).actions[0].route).toBe('/panel/agenda/form')})
 it('offers only permitted actions for mixed businesses',()=>{expect(bottomNavigation(panel(['overview','repairs','agenda','pos'],{'agenda.create':true,'pos.sales.create':true})).actions.map(a=>a.key)).toEqual(['agenda','pos'])})
 it('does not expose disabled modules despite capabilities',()=>{expect(bottomNavigation(panel(['overview'],{'pos.sales.create':true,'agenda.create':true})).actions).toEqual([])})
 it('recognizes central POS action and route boundaries',()=>{expect(navigationRouteActive('/panel/pos','/panel/pos')).toBe(true);expect(navigationRouteActive('/panel/pos/sale','/panel/pos')).toBe(true);expect(navigationRouteActive('/panel/pos-analytics','/panel/pos')).toBe(false);expect(navigationRouteActive('/panel/repairs','/panel')).toBe(false)})
 it('handles loading without fabricated access',()=>{expect(bottomNavigation(null)).toEqual({tabs:[],actions:[]})})
})
describe('saved navigation colors',()=>{
 it('supports named and custom colors with safe fallbacks',()=>{expect(navigationColor('amber')).toBe('#F59E0B');expect(navigationColor('custom','#a1f')).toBe('#aa11ff');expect(navigationColor('custom','invalid')).toBe('#3B82F6')})
 it('chooses legible foreground across supported and extreme colors',()=>{for(const color of ['#ffffff','#000000','#3B82F6','#F59E0B','#22C55E','#A855F7','#14B8A6','#ef4444']) expect(contrast(color,navigationInk(color))).toBeGreaterThanOrEqual(4.5)})
})

it('offers repair and new order for an authorized workshop',()=>{const nav=bottomNavigation(panel(['overview','repairs','orders','pos'],{'repairs.orders.create':true,'ecommerce.orders.manage':true,'pos.sales.create':true},'repairs'));expect(nav.actions.map(a=>a.key)).toEqual(['repairs','orders']);expect(nav.actions[1].route).toBe('/panel/orders/new')})
it('offers reservation and order for services, excludes inaccessible order creation',()=>{expect(bottomNavigation(panel(['agenda','orders'],{'agenda.create':true,'ecommerce.orders.manage':true},'agenda')).actions.map(a=>a.key)).toEqual(['agenda','orders']);expect(bottomNavigation(panel(['repairs','orders'],{'repairs.orders.create':true},'repairs')).actions.map(a=>a.key)).toEqual(['repairs'])})
