import { useEffect, useState } from 'react'
import { AppState, Linking, Platform, Pressable, Text, View } from 'react-native'
import * as Application from 'expo-application'
import { apiFetch } from '@/lib/api'
import { usePalette } from '@/lib/palette'
import { newerPublishedRelease, type PublishedMobileRelease } from '../../../src/lib/mobile/system-news'

/** Un aviso opcional. En desarrollo, Expo Go o sin publicación confirmada no muestra nada. */
export function AppVersionBanner(){
  const colors=usePalette()
  const [release,setRelease]=useState<PublishedMobileRelease|null>(null)
  const [dismissed,setDismissed]=useState<string|null>(null)
  const [error,setError]=useState(false)
  useEffect(()=>{
    if(__DEV__||Platform.OS==='web'||Application.applicationId!=='com.mitiendapy.app')return
    let active=true
    const check=async()=>{
      try{const versions=await apiFetch<{ios:PublishedMobileRelease|null;android:PublishedMobileRelease|null}>('/api/mobile/app-release');if(active)setRelease(newerPublishedRelease(Application.nativeApplicationVersion,Platform.OS==='ios'?versions.ios:versions.android,Platform.OS))}
      catch{if(active)setRelease(null)}
    }
    void check()
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void check()})
    return()=>{active=false;listener.remove()}
  },[])
  if(!release||release.version===dismissed)return null
  return <View style={{margin:12,padding:14,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.card,gap:6}}>
    <Text accessibilityRole="header" style={{color:colors.text,fontWeight:'700'}}>Nueva versión disponible: {release.version}</Text>
    <Text style={{color:colors.muted}}>Actualizá para recibir las últimas mejoras. Podés seguir trabajando.</Text>
    {error&&<Text accessibilityRole="alert" style={{color:colors.text}}>No pudimos abrir la tienda. Volvé a intentar.</Text>}
    <View style={{flexDirection:'row',gap:20}}><Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>{setError(false);void Linking.openURL(release.storeUrl).catch(()=>setError(true))}}><Text style={{color:colors.text,fontWeight:'700'}}>Actualizar</Text></Pressable><Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>setDismissed(release.version)}><Text style={{color:colors.muted}}>Más tarde</Text></Pressable></View>
  </View>
}
