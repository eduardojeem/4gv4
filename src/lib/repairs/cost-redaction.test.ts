import { describe, expect, it } from 'vitest'
import { redactRepairInternalCosts } from './cost-redaction'
describe('repair internal costs',()=>{
 const value={final_cost:100,parts_cost:30,parts:[{unit_price:50,unit_cost:0,subtotal:50}],currentCostRevision:{parts_cost:30},profit:70}
 it('removes internal amounts recursively for technicians/customers without cost permission',()=>{expect(redactRepairInternalCosts(value,false)).toEqual({final_cost:100,parts_cost:null,parts:[{unit_price:50,unit_cost:null,subtotal:50}],currentCostRevision:null,profit:null})})
 it('preserves legitimate zero and full authorized data',()=>{expect(redactRepairInternalCosts(value,true)).toBe(value)})
})
