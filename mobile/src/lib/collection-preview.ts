/** Preview only: the atomic collection endpoint remains authoritative. */
export function collectionPreview(amount: number, debt: number, method: 'cash'|'card'|'transfer') {
 if (![amount,debt].every(value=>Number.isFinite(value)&&value>=0)) throw new Error('Monto inválido.');
 const cents=(value:number)=>Math.round(value*100)/100;
 const applied=cents(Math.min(amount,debt));
 return {applied,remaining:cents(Math.max(0,debt-applied)),storeCredit:cents(Math.max(0,amount-debt)),drawerIncrease:method==='cash'?cents(amount):0};
}
