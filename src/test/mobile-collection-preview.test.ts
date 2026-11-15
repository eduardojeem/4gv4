import {describe,it,expect} from 'vitest';
import {collectionPreview} from '../../mobile/src/lib/collection-preview';
describe('collection preview',()=>{
 it('reduces debt without adding electronic payments to the drawer',()=>{expect(collectionPreview(100,250,'card')).toEqual({applied:100,remaining:150,storeCredit:0,drawerIncrease:0});});
 it('includes confirmed excess in cash received but not in debt reduction',()=>{expect(collectionPreview(300.5,250,'cash')).toEqual({applied:250,remaining:0,storeCredit:50.5,drawerIncrease:300.5});});
 it('preserves cents',()=>{expect(collectionPreview(0.1,0.3,'transfer').remaining).toBe(0.2);});
 it('rejects invalid amounts rather than producing a misleading preview',()=>{for(const amount of [NaN,Infinity,-1])expect(()=>collectionPreview(amount,100,'cash')).toThrow();});
});
