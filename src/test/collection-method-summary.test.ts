import {describe,it,expect} from 'vitest';
import {summarizeCollectionMethods} from '@/lib/credits/collection-method-summary';
const row=(method:string,amount:number,type='installment')=>({request:{paymentMethod:method},result:{allocations:[{type,appliedAmount:amount}]}});
describe('collection method summary',()=>{
 it('separates methods and excludes repair allocations and excess credit',()=>{expect(summarizeCollectionMethods([row('cash',25.5),row('card',50),row('transfer',30),row('cash',400,'repair')])).toEqual({cash:25.5,card:50,transfer:30,count:3});});
 it('rejects unverifiable records instead of underreporting totals',()=>{expect(()=>summarizeCollectionMethods([row('other',10)])).toThrow();expect(()=>summarizeCollectionMethods([row('cash',NaN)])).toThrow();});
 it('does not accumulate floating point artifacts',()=>{expect(summarizeCollectionMethods([row('cash',0.1),row('cash',0.2)]).cash).toBe(0.3);});
});
