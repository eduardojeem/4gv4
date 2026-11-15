import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import type { FinanceSummaryData } from './admin';
import type { FinanceScope } from './finance-admin';
import { assertFinanceScope } from './finance-admin';
import { financeSummaryCsv } from './finance-csv';
export async function shareFinanceSummary(data: FinanceSummaryData,scope: FinanceScope) {
  assertFinanceScope(scope);
  const csv=financeSummaryCsv(data,scope);
  if(Platform.OS==='web'){await Share.share({message:csv,title:'Resumen financiero'});return;}
  if(!await Sharing.isAvailableAsync())throw new Error('Este teléfono no permite compartir archivos.');
  const file=new File(Paths.cache,`finanzas-${scope.startDate}-${scope.endDate}-${Date.now()}.csv`);
  file.create({overwrite:true});file.write(csv);
  try{assertFinanceScope(scope);await Sharing.shareAsync(file.uri,{mimeType:'text/csv',dialogTitle:'Compartir resumen financiero'});}finally{file.delete();}
}