import { describe, expect, it } from 'vitest';
import { planAudiences, planPrice, planRegistrationPath } from '../lib/public/marketplace-plan';
describe('marketplace plan selection', () => {
  it('preserves the published slug instead of the internal tier', () => {
    expect(planRegistrationPath({ public_slug: 'taller pro', tier: 'PRO' })).toBe('/register?plan=taller%20pro');
    expect(planRegistrationPath({ public_slug: null, tier: 'BASIC' })).toBe('/register?plan=BASIC');
  });
  it('formats the catalog price without inventing a billing period', () => {
    expect(planPrice({ price: 0 })).toBe('Gratis');
    expect(planPrice({ price: 150000 })).toContain('150.000');
    expect(planPrice({ price: 150000 })).not.toContain('/ mes');
  });
});

describe('plan business audiences', () => {
 it('only promotes businesses supported by published modules', () => {
 expect(planAudiences({ features: [{key:'pos',label:'POS'},{key:'repairs',label:'Taller'},{key:'services',label:'Servicios'}] })).toEqual(['Comercios','Talleres','Servicios']);
 expect(planAudiences({ features: [{key:'ecommerce',label:'Catálogo'}] })).toEqual(['Comercios']);
 expect(planAudiences({ features: [] })).toEqual([]);
 });
});
