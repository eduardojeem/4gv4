import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch } from '@/lib/api'
import { usePalette } from '@/lib/palette'
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context'

type News = {id:string;title:string;body:string;type:string;sent_at:string;read:boolean}
type Feed = {items:News[];nextCursor:string|null}
export default function SystemNewsScreen(){
  const colors=usePalette()
  const [items,setItems]=useState<News[]>([])
  const [cursor,setCursor]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [reading,setReading]=useState<string|null>(null)
  const generation=useRef(0), loadingLock=useRef(false), readLock=useRef(false)
  const load=useCallback(async(append=false,next:string|null=null)=>{
    if(append&&loadingLock.current)return
    const request=append?generation.current:++generation.current
    const scope=getPrivateCacheContext()
    loadingLock.current=true;setLoading(true)
    try{
      const result=await apiFetch<Feed>('/api/mobile/system-news'+(append&&next?'?cursor='+encodeURIComponent(next):''))
      if(request!==generation.current||scope.epoch!==getPrivateCacheContext().epoch)return
      setItems(old=>append?[...old,...result.items.filter(i=>!old.some(o=>o.id===i.id))]:result.items)
      setCursor(result.nextCursor);setError(null)
    }catch{if(request===generation.current)setError('No pudimos cargar las novedades. Revisá la conexión y reintentá.')}
    finally{if(request===generation.current){loadingLock.current=false;setLoading(false)}}
  },[])
  useFocusEffect(useCallback(()=>{void load();return()=>{generation.current++;loadingLock.current=false}},[load]))
  useEffect(()=>subscribePrivateCacheContext(()=>{generation.current++;loadingLock.current=false;setItems([]);setCursor(null);setReading(null);void load()}),[load])
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state==='active')void load()});return()=>sub.remove()},[load])
  const markRead=async(item:News)=>{
    if(readLock.current)return
    readLock.current=true;setReading(item.id)
    const scope=getPrivateCacheContext()
    try{await apiFetch('/api/mobile/system-news',{method:'POST',body:JSON.stringify({id:item.id})});if(scope.epoch===getPrivateCacheContext().epoch)setItems(old=>old.map(i=>i.id===item.id?{...i,read:true}:i))}
    catch{if(scope.epoch===getPrivateCacheContext().epoch)setError('No se guardó la lectura. Volvé a intentar.')}
    finally{readLock.current=false;setReading(null)}
  }
  return <ScrollView style={{backgroundColor:colors.background}} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/>}>
    <View style={styles.header}><Ionicons name="sparkles-outline" size={26} color={colors.text}/><Text accessibilityRole="header" style={[styles.title,{color:colors.text}]}>Novedades del sistema</Text></View>
    <Text style={{color:colors.muted,lineHeight:22}}>Nuevas funciones, mejoras y avisos de MiTiendaPy para tu negocio.</Text>
    <Pressable accessibilityRole="button" onPress={()=>router.push('/panel/settings/notifications')} style={styles.button}><Text style={{color:colors.text,fontWeight:'600'}}>Configurar avisos de novedades →</Text></Pressable>
    {error&&<View accessibilityRole="alert" style={[styles.card,{borderColor:colors.border}]}><Text style={{color:colors.text}}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>void load()} style={styles.button}><Text style={{color:colors.text}}>Reintentar</Text></Pressable></View>}
    {loading&&!items.length&&<ActivityIndicator accessibilityLabel="Cargando novedades"/>}
    {!loading&&!error&&!items.length&&<Text style={{color:colors.muted}}>Estás al día. Las próximas novedades van a aparecer acá.</Text>}
    {items.map(item=><View key={item.id} style={[styles.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
      <Text style={{color:colors.muted,fontSize:12}}>{item.read?'Leída':'Nueva'} · {new Date(item.sent_at).toLocaleDateString('es-PY')}</Text>
      <Text accessibilityRole="header" style={{color:colors.text,fontWeight:'700',fontSize:18}}>{item.title}</Text>
      <Text selectable style={{color:colors.text,lineHeight:23}}>{item.body}</Text>
      {!item.read&&<Pressable accessibilityRole="button" disabled={reading!==null} onPress={()=>void markRead(item)} style={styles.button}><Text style={{color:colors.text,fontWeight:'600'}}>{reading===item.id?'Guardando…':'Marcar como leída'}</Text></Pressable>}
    </View>)}
    {cursor&&<Pressable accessibilityRole="button" disabled={loading} onPress={()=>void load(true,cursor)} style={styles.button}><Text style={{color:colors.text}}>{loading?'Cargando…':'Ver más novedades'}</Text></Pressable>}
  </ScrollView>
}
const styles=StyleSheet.create({container:{padding:16,gap:16,paddingBottom:40},header:{flexDirection:'row',gap:10,alignItems:'center'},title:{fontSize:23,fontWeight:'700',flex:1},card:{borderWidth:1,borderRadius:18,padding:16,gap:12},button:{minHeight:44,justifyContent:'center',paddingVertical:10}})
