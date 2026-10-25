import {expect,it} from 'vitest'
import {calculateRepairCost} from './cost-breakdown'
it('keeps real zero distinct from an unknown internal cost',()=>{
 const input={currency:'PYG',laborAmount:0,laborTaxRate:0 as const,additionalCharges:0,deductions:0,discountAmount:0,paidAmount:0,parts:[{key:'p',quantity:1,unitPrice:100,unitCost:null as number|null,discountAmount:0,taxRate:0 as const}]}
 expect(calculateRepairCost(input)).toMatchObject({finalTotal:100,partsInternalCost:null})
 input.parts[0].unitCost=0;expect(calculateRepairCost(input)).toMatchObject({finalTotal:100,partsInternalCost:0})
 input.parts[0].unitCost=30;expect(calculateRepairCost(input)).toMatchObject({finalTotal:100,partsInternalCost:30})
})
