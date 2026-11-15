import {describe,it,expect} from 'vitest';
import {paymentReceiptHtml} from '../../mobile/src/lib/payment-receipt-html';
const credit={kind:'credit',input:{receiptNumber:'COL-123',customerName:'María <script>alert(1)</script>',businessName:'Tienda & Hijos',paymentDate:'2026-11-12T01:00:00Z',paymentAmount:125.5,paymentMethod:'cash',currency:'USD',timeZone:'America/Asuncion',currentCreditBalance:250.75,reference:'R<&'}};
const global={kind:'global',input:{receiptNumber:'COL-GLOBAL',customerName:'Ana',paidAt:'2026-11-12T12:00:00Z',totalAmount:150,paymentMethod:'transfer',currency:'USD',timeZone:'America/Asuncion',excessToStoreCredit:50,allocations:[{id:'debt',type:'installment',title:'Cuota 2',allocatedAmount:100,totalAmount:200,newPending:100}],referenceNumber:'ABC123'}};
describe('stored collection PDF content',()=>{
 it('uses the original snapshot and escapes every customer-provided HTML field',()=>{const html=paymentReceiptHtml(credit);expect(html).toContain('COL-123');expect(html).toContain('Tienda &amp; Hijos');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('250,75');expect(html).toContain('11/11/2026');expect(html).toContain('125,50');});
 it('shows actual allocations, excess, reference and electronic payment meaning',()=>{const html=paymentReceiptHtml(global);expect(html).toContain('Cuota 2');expect(html).toContain('ABC123');expect(html).toContain('Saldo a favor');expect(html).toContain('acreditación bancaria');});
 it('rejects missing original data rather than reconstructing a receipt',()=>{for(const input of [null,{}, {...credit,input:{...credit.input,currency:undefined}}, {...credit,input:{...credit.input,paymentDate:'bad-date'}}, {...credit,input:{...credit.input,paymentAmount:NaN}}])expect(()=>paymentReceiptHtml(input)).toThrow();});
 it('refuses inconsistent allocation totals',()=>{expect(()=>paymentReceiptHtml({...global,input:{...global.input,totalAmount:999}})).toThrow();});
 it('does not assert a current debt balance from an old receipt',()=>{expect(paymentReceiptHtml(credit)).toContain('Saldo al registrar el pago');});
});
