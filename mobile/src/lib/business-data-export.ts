import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {apiFetch} from './api';
import {getPrivateCacheContext,isPrivateCacheContextCurrent} from './private-cache-context';
export async function shareBusinessData(){
 const scope=getPrivateCacheContext();if(!scope.organizationId)throw new Error('Seleccioná una empresa.');
 if(!await Sharing.isAvailableAsync())throw new Error('La descarga no está disponible en este dispositivo. Usá la web.');
 const data=await apiFetch<{organizationId:string}>('/api/admin/subscriptions/data-export',{headers:{'x-export-organization-id':scope.organizationId}});
 if(!isPrivateCacheContextCurrent(scope)||data.organizationId!==scope.organizationId)throw new Error('La empresa cambió. Iniciá otra descarga.');
 const file=new File(Paths.cache,`datos-comerciales-${scope.organizationId}-${Date.now()}.json`);
 try{file.create({overwrite:true});file.write(JSON.stringify(data));if(!isPrivateCacheContextCurrent(scope))throw new Error('La sesión cambió.');await Sharing.shareAsync(file.uri,{mimeType:'application/json',dialogTitle:'Guardar datos comerciales'});}finally{if(file.exists)file.delete();}
}