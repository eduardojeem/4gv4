import {useEffect,useState,useSyncExternalStore} from 'react';
import {AppState,Pressable,Text,View} from 'react-native';
import {router,usePathname} from 'expo-router';
import {apiFetch} from '@/lib/api';
import {getPrivateCacheContext,subscribePrivateCacheContext} from '@/lib/private-cache-context';
import {usePalette} from '@/lib/palette';
type Access={organizationId:string;blocked:boolean;canRenew:boolean;title:string;message:string;warning:string;archiveDueAt?:string|null;deletionDueAt?:string|null};
export function SubscriptionRenewalBanner(){
 const colors=usePalette(),pathname=usePathname(),context=useSyncExternalStore(subscribePrivateCacheContext,getPrivateCacheContext);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{const listener=AppState.addEventListener('change',value=>{if(value==='active')setRefresh(v=>v+1);});return()=>listener.remove();},[]);
 const key=JSON.stringify([context.epoch,context.organizationId]);
 const [state,setState]=useState<{key:string;value:Access}|null>(null);
 useEffect(()=>{if(!context.organizationId)return;let active=true;apiFetch<Access>('/api/subscription/access').then(value=>{if(value.organizationId!==context.organizationId)throw new Error('Otra organización');if(active)setState({key,value});}).catch(()=>{});return()=>{active=false;};},[key,context.organizationId,refresh,pathname]);
 const access=state?.key===key?state.value:null;
 if(!access?.blocked)return null;
 return <View accessibilityRole="alert" style={{marginHorizontal:12,marginVertical:8,padding:14,gap:8,borderRadius:14,borderWidth:1,borderColor:colors.dangerText,backgroundColor:colors.card}}>
  <Text style={{color:colors.dangerText,fontWeight:'800'}}>{access.title}</Text>
  <Text style={{color:colors.text,fontSize:12}}>{access.message}</Text>
  <Text style={{color:colors.muted,fontSize:12}}>{access.warning}</Text>
  {access.deletionDueAt?<Text style={{color:colors.text,fontSize:12}}>Archivo: {access.archiveDueAt?new Date(access.archiveDueAt).toLocaleDateString('es-PY'):'Por confirmar'}. Baja prevista: {new Date(access.deletionDueAt).toLocaleDateString('es-PY')}. Podés solicitar una copia de tus datos a soporte.</Text>:null}
  {access.canRenew&&pathname!=='/admin/subscriptions'?<Pressable accessibilityRole="button" onPress={()=>router.push('/admin/subscriptions')} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.text,fontWeight:'700'}}>Renovar plan</Text></Pressable>:!access.canRenew?<Text style={{color:colors.text,fontSize:12}}>Pedile al dueño o administrador que renueve la suscripción.</Text>:null}
 </View>;
}
