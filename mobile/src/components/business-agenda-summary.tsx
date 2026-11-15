import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { agendaSummarySchema, agendaSummaryCounts, type AgendaSummaryData } from '../../../src/lib/agenda/summary-model';
import { apiFetch } from '@/lib/api';
import { onAgendaChanged } from '@/lib/agenda';
import { usePanel } from '@/lib/panel';
import { usePalette } from '@/lib/palette';
import { getPrivateCacheContext, isPrivateCacheSnapshotCompatible } from '@/lib/private-cache-context';
import { mobileBusinessPresentation } from '@/lib/business-presentation';
export function BusinessAgendaSummary({refreshKey=0}:{refreshKey?:number}) {
 const {data:panel}=usePanel(), colors=usePalette();
 const organizationId=panel?.organization.id;
 const business=mobileBusinessPresentation(panel?.organization);
 const [attempt,setAttempt]=useState(0);
 const [result,setResult]=useState<{organizationId:string;data:AgendaSummaryData|null;error:string|null}|null>(null);
 useEffect(()=>{
  if(!organizationId)return;
  const captured=getPrivateCacheContext();let active=true;
  apiFetch<unknown>('/api/agenda').then(raw=>{const data=agendaSummarySchema.parse(raw);if(active&&isPrivateCacheSnapshotCompatible(captured))setResult({organizationId,data,error:null})}).catch(()=>{if(active&&isPrivateCacheSnapshotCompatible(captured))setResult({organizationId,data:null,error:'No se pudo cargar la agenda. Volvé a intentar.'})});
  return()=>{active=false};
 },[organizationId,attempt,refreshKey]);
 useEffect(()=>{
  const reload=()=>setAttempt(n=>n+1),unsubscribe=onAgendaChanged(reload);
  const timer=setInterval(()=>{if(AppState.currentState==='active')reload()},60000);
  const listener=AppState.addEventListener('change',state=>{if(state==='active')reload()});
  return()=>{unsubscribe();clearInterval(timer);listener.remove()};
 },[]);
 const visible=result?.organizationId===organizationId?result:null;
 const counts=visible?.data?agendaSummaryCounts(visible.data):null;
 return <View style={{padding:16,gap:12,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card}}>
  <Text style={{fontSize:20,fontWeight:'700',color:colors.text}}>{business.walkInOnly?'Atenciones de hoy':'Tu agenda de hoy'}</Text>
  <Text style={{color:colors.muted}}>Agenda de la empresa · {business.attentionLabel}</Text>
  {visible?.error?<Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)}><Text style={{color:colors.text}}>{visible.error} Reintentar</Text></Pressable>:!counts?<Text style={{color:colors.muted}}>Cargando agenda…</Text>:<>
   <Text style={{color:colors.text}}>{counts.registered}{counts.partial?' o más':''} {business.walkInOnly?'atenciones registradas':'turnos del día'} · {counts.completed} atendidos</Text>
   <Text style={{color:colors.muted}}>{counts.noShow} no asistieron · {counts.pending} reservas futuras por confirmar</Text>
   {counts.partial?<Text style={{color:colors.muted}}>Conteos parciales: se alcanzó el límite de consulta.</Text>:null}
  </>}
  <Pressable accessibilityRole="button" onPress={()=>router.push('/panel/agenda')}><Text style={{fontWeight:'700',color:colors.text}}>Abrir agenda →</Text></Pressable>
 </View>;
}
