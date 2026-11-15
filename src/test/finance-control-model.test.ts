import {describe,it,expect} from 'vitest'
import {forecastCommitments,controlMonth,controlConfigSchema,budgetProgress,controlAlerts,defaultControlConfig,snapshotChanges} from '@/lib/finance/control-model'
describe('finance control: no invented balances',()=>{
 it('projects only commitments inside business dates, not old debt or a bank balance',()=>{
  expect(forecastCommitments([{id:'1',label:'Cuota',date:'2026-11-12',amount:100,kind:'receivable'},{id:'2',label:'Gasto',date:'2026-11-17',amount:70,kind:'payable'},{id:'old',label:'Vencido',date:'2026-11-10',amount:500,kind:'receivable'},{id:'later',label:'Futuro',date:'2026-11-18',amount:300,kind:'payable'}],'2026-11-11',7)).toEqual({end:'2026-11-17',incoming:100,outgoing:70,net:30})
 })
 it('handles leap months and invalid amounts',()=>{expect(controlMonth('2028-02-20')).toEqual({startDate:'2028-02-01',endDate:'2028-02-29'});expect(()=>forecastCommitments([{id:'1',label:'bad',date:'2026-11-11',amount:NaN,kind:'payable'}],'2026-11-11',7)).toThrow()})
 it('rejects duplicate categories and invalid budget values',()=>{const row={categoryId:'11111111-1111-4111-8111-111111111111',limit:100};expect(controlConfigSchema.safeParse({...defaultControlConfig,budgets:[row,row]}).success).toBe(false);expect(controlConfigSchema.safeParse({...defaultControlConfig,budgets:[{...row,limit:1.111}]}).success).toBe(false)})
 it('computes remaining budget and respects disabled alerts',()=>{const config={...defaultControlConfig,budgets:[{categoryId:'c',limit:100}],alerts:{due:false,budget:false,reconciliation:false,days:7}};const actuals=[{categoryId:'c',name:'Alquiler',amount:120}];expect(budgetProgress(config,actuals)[0].remaining).toBe(-20);expect(controlAlerts({config,actuals,commitments:[],warnings:[{code:'MISSING',message:'bad'}],discrepancies:[],today:'2026-11-11',forecastAvailable:true})).toEqual([])})
 it('detects changed values and unknown profit in saved snapshots',()=>{const a={accrued:{revenue:100,directCosts:20,operatingExpenses:0,payrollCost:0,netProfit:80},cash:{collected:0,paid:0,netCashFlow:0},complete:true};const b={...a,accrued:{...a.accrued,netProfit:null},complete:false};expect(snapshotChanges(a,b)).toHaveLength(2)})
})

import {validateControlResponse} from '@/lib/finance/control-model'
import {controlFixture} from './fixtures/finance-control'
import {financeLast30Days} from '@/lib/finance/calendar'
import {financePeriodDates} from '../../mobile/src/lib/finance-model'
describe('shared web/mobile control contracts',()=>{
 it('accepts actual values and rejects a detail that no longer reconciles',()=>{expect(()=>validateControlResponse(controlFixture())).not.toThrow();const bad=controlFixture();bad.detail.sum=101;expect(()=>validateControlResponse(bad)).toThrow();const invalid=controlFixture();invalid.lines[0].amount=NaN;expect(()=>validateControlResponse(invalid)).toThrow()})
 it('shares the same business dates near midnight in different time zones',()=>{const now=new Date('2026-11-12T01:00:00Z');for(const zone of ['America/Asuncion','Asia/Tokyo'])expect(financeLast30Days(zone,now)).toEqual(financePeriodDates('30d',zone,now));expect(financeLast30Days('America/Asuncion',now).endDate).toBe('2026-11-11')})
})
