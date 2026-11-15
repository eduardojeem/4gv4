import {paymentReceiptHtml} from './payment-receipt-html';
type Dependencies={platform:string;assertContext:()=>void;available:()=>Promise<boolean>;print:(html:string)=>Promise<{uri:string}>;share:(uri:string)=>Promise<void>;remove:(uri:string)=>void};
/** File sharing is separate from collection mutations so it is safe to retry. */
export async function shareStoredPaymentPdf(snapshot:unknown,dependencies:Dependencies){
 dependencies.assertContext();
 const html=paymentReceiptHtml(snapshot);
 if(dependencies.platform==='web')throw new Error('Compartí el PDF desde la aplicación móvil.');
 if(!await dependencies.available())throw new Error('Este teléfono no permite compartir archivos.');
 dependencies.assertContext();
 const {uri}=await dependencies.print(html);
 try{dependencies.assertContext();await dependencies.share(uri);}
 finally{try{dependencies.remove(uri);}catch{/* OS cache cleanup must not change the payment outcome. */}}
}
