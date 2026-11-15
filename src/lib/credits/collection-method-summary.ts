type Row={request:unknown;result:unknown};
/** Consolidated receipts only; never infer historic branch attribution. */
export function summarizeCollectionMethods(rows:Row[]){
 const totals={cash:0,card:0,transfer:0,count:0};
 for(const row of rows){
  const request=row.request as {paymentMethod?:unknown}|null;
  const result=row.result as {allocations?:{type?:unknown;appliedAmount?:unknown}[]}|null;
  if(!request||!['cash','card','transfer'].includes(String(request.paymentMethod))||!Array.isArray(result?.allocations))throw new Error('Hay cobros que no se pudieron verificar.');
  let applied=0;
  for(const allocation of result.allocations){
   if(!['installment','repair'].includes(String(allocation.type))||typeof allocation.appliedAmount!=='number'||!Number.isFinite(allocation.appliedAmount)||allocation.appliedAmount<=0)throw new Error('Hay importes de cobros que no se pudieron verificar.');
   if(allocation.type==='installment')applied+=allocation.appliedAmount;
  }
  if(applied>0){totals[request.paymentMethod as 'cash'|'card'|'transfer']+=applied;totals.count++;}
 }
 for(const method of ['cash','card','transfer'] as const)totals[method]=Math.round(totals[method]*100)/100;
 return totals;
}
