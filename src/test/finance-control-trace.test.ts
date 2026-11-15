import {describe,it,expect} from 'vitest'
import {financeControlSourceVersion,buildFinanceControlSnapshot,type FinanceSummaryRecords} from '@/lib/finance/server'
import {METRICS} from '@/lib/finance/control-model'
const period={startDate:'2026-11-01',endDate:'2026-11-30',branchId:'branch'}
describe('control trace reuses canonical summary',()=>{
 it('detects a changed source even when totals stay equal, independently of order',()=>{const rows=[{id:'one',metric:'revenue' as const,label:'Venta',amount:100,sourceId:'sale-1'},{id:'two',metric:'revenue' as const,label:'Venta',amount:200,sourceId:'sale-2'}];expect(financeControlSourceVersion(rows)).toBe(financeControlSourceVersion([...rows].reverse()));expect(financeControlSourceVersion(rows)).not.toBe(financeControlSourceVersion([{...rows[0],sourceId:'replacement'},rows[1]]))})
 it('reconciles every metric including refunds, expenses and cash discrepancies',()=>{
 const records:FinanceSummaryRecords={sales:[{id:'sale',branchId:'branch',createdAt:'2026-11-02',status:'completed',totalAmount:1000,paidAmount:0},{id:'pending',branchId:'branch',createdAt:'2026-11-02',status:'pending',totalAmount:9999,paidAmount:0}],saleItems:[{saleId:'sale',quantity:1,unitCost:400}],repairs:[],repairParts:[],obligations:[{id:'rent',branchId:'branch',accountingDate:'2026-11-03',dueDate:'2026-11-10',status:'partially_paid',amount:200,paidAmount:50,concept:'Alquiler'}],payrollEntries:[],financePayments:[{branchId:'branch',paymentDate:'2026-11-04',direction:'payment',amount:50},{branchId:'other',paymentDate:'2026-11-04',direction:'payment',amount:900}],payrollPayments:[],cashClosures:[{id:'short',branchId:'branch',closedAt:'2026-11-05',discrepancy:-10}],refunds:[{id:'refund',branchId:'branch',resolvedAt:'2026-11-05',amount:100,recoveredCost:40,cashAmount:100}]}
 const {lines,snapshot}=buildFinanceControlSnapshot(records,period)
 for(const metric of METRICS){const total=metric in snapshot.accrued?snapshot.accrued[metric as keyof typeof snapshot.accrued]:snapshot.cash[metric as keyof typeof snapshot.cash];if(typeof total==='number')expect(lines.filter(row=>row.metric===metric).reduce((sum,row)=>sum+row.amount,0),metric).toBeCloseTo(total,2)}
 expect(lines.some(row=>row.sourceId==='pending')).toBe(false)
 expect(snapshot.accrued.revenue).toBe(900)
 expect(snapshot.cash.paid).toBe(160)
 })
})
