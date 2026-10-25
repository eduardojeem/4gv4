import { daysUntilCreditDue, creditInstallmentIsOverdue } from './calendar'
export async function readAllCreditRows<T>(page: (from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<T[]> {
  const rows:T[]=[]
  const pageSize=500
  for (let from=0;;from+=pageSize) {
    const result=await page(from,from+pageSize-1)
    if (result.error) throw new Error('No se pudo leer una página completa de la cartera.')
    if (!Array.isArray(result.data)) throw new Error('La cartera no devolvió filas válidas.')
    rows.push(...result.data)
    if (result.data.length<pageSize) return rows
  }
}
type Credit={id:string;customer_id:string;status:string}
type Installment={credit_id:string;amount:number|string;amount_paid?:number|string|null;status:string;due_date:string}
export function summarizeCreditPortfolio(credits:Credit[],installments:Installment[],timeZone='America/Asuncion',now=new Date()) {
  const authorized=new Map(credits.filter(c=>!['cancelled','cancelado','canceled'].includes(c.status)).map(c=>[c.id,c]))
  let outstanding=0,overdue=0,paid=0,dueToday=0
  const customers=new Set<string>()
  let paidCount=0,pendingCount=0,overdueCount=0
  for (const row of installments) {
    const credit=authorized.get(row.credit_id)
    if (!credit) continue
    if (['cancelled','cancelado','canceled'].includes(String(row.status).toLowerCase())) continue
    const amount=Number(row.amount||0),paidAmount=Math.min(amount,Math.max(0,Number(row.amount_paid||0)))
    if (!Number.isFinite(amount) || !Number.isFinite(paidAmount)) throw new Error('Importe crediticio inválido.')
    const open=credit.status==='completed' ? 0 : Math.max(0,amount-paidAmount)
    paid+=paidAmount;outstanding+=open
    customers.add(credit.customer_id)
    if (open<=0) {paidCount++;continue}
    pendingCount++
    const days=daysUntilCreditDue(row.due_date,timeZone,now)
    if (creditInstallmentIsOverdue(row.due_date,row.status,timeZone,now)) {overdue+=open;overdueCount++}
    if (days===0) dueToday+=open
  }
  const totalFinanced=paid+outstanding,currentOnTime=Math.max(0,outstanding-overdue)
  return {outstanding,overdue,paid,dueToday,distinctCustomers:customers.size,paidCount,pendingCount,overdueCount,totalFinanced,currentOnTime,
    recoveryRate:totalFinanced?paid/totalFinanced*100:0,overdueRate:totalFinanced?overdue/totalFinanced*100:0,
    currentRate:totalFinanced?currentOnTime/totalFinanced*100:0}
}
export type CreditPortfolioSummary=ReturnType<typeof summarizeCreditPortfolio>
