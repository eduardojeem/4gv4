import { describe, expect, it } from 'vitest';
import { mobileBusinessPresentation } from '../../mobile/src/lib/business-presentation';
describe('mobile business presentation', () => {
 it('starts a services-only business on services and hides inventory', () => {
  expect(mobileBusinessPresentation({operatingModel:'service',effectiveModules:['services','pos']})).toMatchObject({defaultCatalogView:'services',showInventory:false,catalogLabel:'Servicios'});
 });
 it('never opens an unavailable product shelf in a services-only mixed business',()=>{expect(mobileBusinessPresentation({operatingModel:'mixed',effectiveModules:['services']}).defaultCatalogView).toBe('services')});
 it('keeps stock for mixed barbershops and prioritizes services', () => {
  expect(mobileBusinessPresentation({businessVertical:'barbershop',operatingModel:'mixed',effectiveModules:['services','inventory']})).toMatchObject({defaultCatalogView:'services',showInventory:true});
 });
 it('does not grant stock access from the industry or catalog screen', () => {
  expect(mobileBusinessPresentation({businessVertical:'barbershop',effectiveModules:['services']} ).showInventory).toBe(false);
  expect(mobileBusinessPresentation({effectiveModules:['inventory']} ).defaultCatalogView).toBe('products');
 });
});
