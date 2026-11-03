import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from './bottom-sheet';
import { usePalette } from '@/lib/palette';
import type { MarketplaceHome } from '@/lib/marketplace';
import type { MarketplaceLocation } from '../../../src/lib/public/marketplace-location';
export function MarketplaceLocationPicker({selection,facets,onChange}:{selection:MarketplaceLocation;facets:MarketplaceHome['location'];onChange:(next:MarketplaceLocation)=>void}){
 const colors=usePalette();const [open,setOpen]=useState(false);const [draft,setDraft]=useState(selection);const [query,setQuery]=useState('');
 const countries=facets?.countries??[],cities=(facets?.allCities??facets?.cities??[]).filter(city=>draft.country==='all'||(city.countryCode??'unknown')===draft.country).filter(city=>city.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
 const countryName=selection.country==='all'?'Todos los países':countries.find(country=>country.code===selection.country)?.label??selection.country;
 const cityName=selection.city==='all'?'Todas las ciudades':facets?.allCities?.find(city=>city.key===selection.city)?.label??selection.city.split(':').pop();
 const option=(label:string,selected:boolean,press:()=>void,key:string)=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected}} onPress={press} style={({pressed})=>({minHeight:48,padding:12,borderRadius:12,backgroundColor:selected?colors.background:colors.card,opacity:pressed?.6:1,flexDirection:'row',gap:10,alignItems:'center'})}><Text style={{color:colors.text,flex:1,fontWeight:selected?'700':'400'}}>{label}</Text>{selected&&<Ionicons name="checkmark-circle" size={20} color={colors.text}/>}</Pressable>;
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel={'Ubicación: '+countryName+', '+cityName} onPress={()=>{setDraft(selection);setQuery('');setOpen(true);}} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:18,paddingVertical:12,gap:10,borderBottomWidth:1,borderColor:colors.border,backgroundColor:colors.card}}><Ionicons name="location-outline" size={20} color={colors.text}/><View style={{flex:1}}><Text style={{fontSize:13,color:colors.text,fontWeight:'700'}}>{countryName} · {cityName}</Text><Text style={{fontSize:11,color:colors.muted}}>Comercios con local en esta ubicación</Text></View><Ionicons name="chevron-down" size={16} color={colors.muted}/></Pressable>
  <BottomSheet visible={open} title="Elegí tu ubicación" subtitle="Se aplica a tiendas, productos y ofertas. La entrega se consulta con cada comercio." onClose={()=>setOpen(false)} tall footer={<Pressable accessibilityRole="button" onPress={()=>{onChange(draft);setOpen(false);}} style={{padding:16,borderRadius:14,backgroundColor:colors.text}}><Text style={{color:colors.card,textAlign:'center',fontWeight:'700'}}>Aplicar ubicación</Text></Pressable>}>
   <Text style={{color:colors.text,fontSize:16,fontWeight:'800'}}>País</Text>
   {option('Todos los países',draft.country==='all',()=>setDraft({country:'all',city:'all'}),'all-country')}
   {countries.map(country=>option(country.label+' · '+country.count,draft.country===country.code,()=>{setDraft({country:country.code,city:'all'});setQuery('');},country.code))}
   <Text style={{color:colors.text,fontSize:16,fontWeight:'800'}}>Ciudad</Text>
   <TextInput accessibilityLabel="Buscar ciudad" placeholder="Buscar ciudad" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false} style={{padding:12,borderWidth:1,borderRadius:12,borderColor:colors.border,color:colors.text}}/>
   {option('Todas las ciudades',draft.city==='all',()=>setDraft({...draft,city:'all'}),'all-city')}
   {cities.map(city=>option(city.label+(draft.country==='all'?' · '+(countries.find(country=>country.code===(city.countryCode??'unknown'))?.label??'País sin confirmar'):'')+' · '+city.count,draft.city===city.key,()=>setDraft({country:city.countryCode??'unknown',city:city.key}),city.key))}
   {!cities.length&&<Text style={{color:colors.muted}}>No encontramos ciudades con ese nombre.</Text>}
  </BottomSheet>
 </>;
}
