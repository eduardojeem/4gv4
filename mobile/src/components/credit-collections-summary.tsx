import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {apiFetch} from '@/lib/api';
import {formatCreditMoney} from '@/lib/credit-model';
import {getPrivateCacheContext,subscribePrivateCacheContext} from '@/lib/private-cache-context';
import {palette,usePalette} from '@/lib/palette';
type Summary={organizationId:string;branchId:string;currency:string;start:string;end:string;totals:{cash:number;card:number;transfer:number;count:number}};
export function CreditCollectionsSummary({branchId,revision}:{branchId:string;revision:number}){
 const colors=usePalette(),context=useSyncExternalStore(subscribePrivateCacheContext,getPrivateCacheContext);
 const key=JSON.stringify([context.epoch,context.organizationId,branchId,revision]);
 const [attempt,setAttempt]=useState(0),[state,setState]=useState<{key:string;data?:Summary;error?:string}|null>(null);
 useEffect(()=>{let active=true;apiFetch<Summary>('/api/mobile/cash-register/credit-collections',{headers:{'x-branch-id':branchId}}).then(data=>{
  if(data.organizationId!==context.organizationId||data.branchId!==branchId||!data.currency||!data.totals||!['cash','card','transfer','count'].every(method=>Number.isFinite(data.totals[method as keyof Summary['totals']])&&data.totals[method as keyof Summary['totals']]>=0))throw new Error('No se pudo verificar el resumen de cobros.');
  if(active)setState({key,data});
 }).catch(error=>{if(active)setState({key,error:error instanceof Error?error.message:'No se pudieron cargar los cobros.'});});return()=>{active=false;};},[key,context.organizationId,branchId,attempt]);
 const current=state?.key===key?state:null;
 return <View style={{padding:16,gap:10,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background}}>
  <Text style={{fontWeight:'800',fontSize:16,color:colors.text}}>Cobros de cuotas · últimas 24 horas</Text>
  <Text style={{fontSize:12,color:colors.muted}}>Sucursal actual · comprobantes unificados. No incluye cobros históricos realizados por otros circuitos.</Text>
  {!current?<ActivityIndicator color={palette.primary}/>:current.error?<><Text accessibilityRole="alert" style={{color:palette.danger}}>{current.error}</Text><Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)}><Text style={{color:palette.primary}}>Reintentar</Text></Pressable></>:current.data?<>
   {(['cash','card','transfer'] as const).map(method=><View key={method} style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={{color:colors.text}}>{{cash:'Efectivo',card:'Tarjeta',transfer:'Transferencia'}[method]}</Text><Text style={{color:colors.text,fontWeight:'700'}}>{formatCreditMoney(current.data!.totals[method],current.data!.currency)}</Text></View>)}
   <Text style={{fontSize:12,color:colors.muted}}>{current.data.totals.count} comprobantes con cuotas. Son cobros de deudas, no ventas nuevas. El efectivo ya está incluido en los ingresos de la caja que lo recibió; no lo sumés otra vez. Tarjeta y transferencia no implican acreditación bancaria verificada.</Text>
  </>:null}
 </View>;
}
