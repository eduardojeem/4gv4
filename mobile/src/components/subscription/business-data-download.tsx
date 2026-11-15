import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {usePanel} from '@/lib/panel';
import {usePalette} from '@/lib/palette';
import {shareBusinessData} from '@/lib/business-data-export';
export function BusinessDataDownload(){
 const {data}=usePanel(),colors=usePalette();const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 if(data?.organization.role!=='owner')return null;
 return <View style={{padding:16,borderWidth:1,borderColor:colors.border,borderRadius:16,gap:10,backgroundColor:colors.card}}><Text style={{color:colors.text,fontWeight:'700'}}>Conservá una copia de tus datos</Text><Text style={{color:colors.muted,fontSize:12}}>Productos, clientes, ventas, pedidos, reparaciones y movimientos financieros en JSON. Incluye cuotas y turnos. No incluye nómina ni adjuntos. No es una copia restaurable.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={async()=>{setBusy(true);setError(null);try{await shareBusinessData();}catch(e){setError(e instanceof Error?e.message:'No se pudo descargar.');}finally{setBusy(false);}}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.text,fontWeight:'700'}}>{busy?'Preparando archivo…':'Guardar datos comerciales'}</Text></Pressable>{error?<Text accessibilityRole="alert" style={{color:colors.dangerText}}>{error}</Text>:null}</View>;
}