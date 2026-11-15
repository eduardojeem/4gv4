import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {File} from 'expo-file-system';
import {Platform} from 'react-native';
import {getPrivateCacheContext} from './private-cache-context';
import {shareStoredPaymentPdf} from './payment-receipt-share';
export function sharePaymentReceiptPdf(snapshot:unknown,epoch:number){
 return shareStoredPaymentPdf(snapshot,{
  platform:Platform.OS,
  assertContext:()=>{if(getPrivateCacheContext().epoch!==epoch)throw new Error('Cambió la sesión o la organización. Abrí el comprobante de nuevo.');},
  available:()=>Sharing.isAvailableAsync(),
  print:html=>Print.printToFileAsync({html,width:595,height:842}),
  share:uri=>Sharing.shareAsync(uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Compartir comprobante de pago'}),
  remove:uri=>new File(uri).delete(),
 });
}
