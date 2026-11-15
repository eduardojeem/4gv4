import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useState} from 'react';
import {Keyboard,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,useWindowDimensions,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ADMIN_MORE_GROUPS,adminItem,adminMenuSingleColumn,filterAdminCommandItems,isAdminRouteActive,type AdminNavItem} from '@/lib/admin-nav';
import {useAfterDismiss} from '@/lib/after-dismiss';
import {navigationInk} from '@/lib/bottom-nav-model';
import {usePalette} from '@/lib/palette';
import {AdminNavigationBar} from './admin-navigation-bar';

export type AdminCommandMenuProps={visible:boolean;onClose:()=>void;pathname:string;orgName?:string|null;orgLogoUrl?:string|null;accent:string;onGoPanel:()=>void;onSelectItem:(item:AdminNavItem)=>void};

export function AdminCommandMenu({visible,onClose,pathname,orgName,orgLogoUrl,accent,onGoPanel,onSelectItem}:AdminCommandMenuProps){
 const colors=usePalette(),{width,fontScale}=useWindowDimensions();
 const singleColumn=adminMenuSingleColumn(width,fontScale);
 const [query,setQuery]=useState('');
 const {schedule,onDismiss}=useAfterDismiss();
 const close=()=>{Keyboard.dismiss();setQuery('');onClose();};
 const select=(item:AdminNavItem)=>{
  const action=()=>onSelectItem(item);
  if(item.web){schedule(action);close();}
  else{close();action();}
 };
 const results=filterAdminCommandItems(query);
 const tile=(item:AdminNavItem,search=false)=>{
  const active=isAdminRouteActive(pathname,item);
  return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={item.web?'Se abre en el navegador':item.hint} accessibilityState={{selected:active}} onPress={()=>select(item)}
   style={({pressed})=>[styles.tile,{width:singleColumn||search?'100%':'48.5%',borderColor:active?accent:colors.border,backgroundColor:pressed?colors.background:colors.card}]}>
   <View style={[styles.icon,{backgroundColor:active?accent:colors.background}]}><Ionicons name={item.icon} size={20} color={active?navigationInk(accent):colors.text}/></View>
   <View style={styles.flex}><Text style={[styles.tileLabel,{color:colors.text}]}>{item.key==='guide'?'Ayuda':item.label}</Text>{search&&<Text style={[styles.hint,{color:colors.muted}]}>{item.hint}</Text>}</View>
   {item.web&&<Ionicons name="open-outline" size={14} color={colors.muted}/>}
  </Pressable>;
 };
 return <Modal visible={visible} animationType="slide" onRequestClose={close} onDismiss={onDismiss}>
  <SafeAreaView edges={['top','left','right']} style={[styles.flex,{backgroundColor:colors.background}]}>
   <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':'height'}>
    <View style={styles.container}>
     <View style={styles.header}>
      <View style={[styles.logo,{backgroundColor:colors.card,borderColor:colors.border}]}>{orgLogoUrl?<Image source={orgLogoUrl} contentFit="cover" style={styles.fill}/>:<Ionicons name="storefront-outline" size={22} color={colors.text}/>}</View>
      <View style={styles.flex}><Text numberOfLines={1} style={[styles.org,{color:colors.text}]}>{orgName??'Tu negocio'}</Text><Text style={[styles.hint,{color:colors.muted}]}>Administración</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú Más" onPress={close} style={styles.close}><Ionicons name="close" size={24} color={colors.text}/></Pressable>
     </View>
     <Text accessibilityRole="header" style={[styles.title,{color:colors.text}]}>Más</Text>
     <View style={[styles.search,{backgroundColor:colors.card,borderColor:colors.border}]}>
      <Ionicons name="search-outline" size={20} color={colors.muted}/>
      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar sección" accessibilityLabel="Buscar sección de administración" placeholderTextColor={colors.muted} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={[styles.input,{color:colors.text}]}/>
      {query.length>0&&<Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={()=>setQuery('')} style={styles.close}><Ionicons name="close-circle-outline" size={20} color={colors.muted}/></Pressable>}
     </View>
     <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {query.trim()?<View style={styles.grid}>{results.length?results.map(item=>tile(item,true)):<Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>No encontramos esa sección. Probá con otro nombre.</Text>}</View>:ADMIN_MORE_GROUPS.map(group=><View key={group.label} style={styles.group}>
       <Text accessibilityRole="header" style={[styles.groupLabel,{color:colors.muted}]}>{group.label}</Text>
       <View style={styles.grid}>{group.keys.map(adminItem).filter((item):item is AdminNavItem=>Boolean(item)).map(item=>tile(item))}</View>
      </View>)}
      <View style={styles.note}><Ionicons name="open-outline" size={14} color={colors.muted}/><Text style={[styles.hint,styles.flex,{color:colors.muted}]}>Algunas secciones se abren en la web.</Text></View>
      <Pressable accessibilityRole="button" onPress={()=>{close();onGoPanel();}} style={({pressed})=>[styles.returnRow,{backgroundColor:pressed?colors.background:colors.card,borderColor:colors.border}]}>
       <Ionicons name="storefront-outline" size={20} color={colors.text}/><Text style={[styles.tileLabel,styles.flex,{color:colors.text}]}>Volver al Panel</Text><Ionicons name="arrow-forward" size={19} color={colors.muted}/>
      </Pressable>
     </ScrollView>
    </View>
    <AdminNavigationBar pathname={pathname} menuOpen accent={accent} onMenu={close} onSelect={select}/>
   </KeyboardAvoidingView>
  </SafeAreaView>
 </Modal>;
}
const styles=StyleSheet.create({flex:{flex:1},container:{flex:1,width:'100%',maxWidth:600,alignSelf:'center',paddingHorizontal:16},header:{flexDirection:'row',alignItems:'center',gap:10,paddingTop:10,paddingBottom:12},logo:{width:38,height:38,borderRadius:11,borderWidth:1,overflow:'hidden',alignItems:'center',justifyContent:'center'},fill:{width:'100%',height:'100%'},org:{fontSize:16,fontWeight:'700'},hint:{fontSize:12,lineHeight:17},close:{width:44,minHeight:44,alignItems:'center',justifyContent:'center'},title:{fontSize:26,fontWeight:'800',marginBottom:10},search:{minHeight:46,flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:12,paddingLeft:12,gap:8},input:{flex:1,minHeight:46,paddingVertical:10,fontSize:14},content:{paddingTop:20,paddingBottom:20,gap:20},group:{gap:8},groupLabel:{fontSize:12,fontWeight:'700',textTransform:'uppercase'},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:8},tile:{flexDirection:'row',alignItems:'center',gap:8,padding:10,minHeight:54,borderRadius:12,borderWidth:StyleSheet.hairlineWidth},tileLabel:{fontSize:13,fontWeight:'600',flexShrink:1},icon:{width:30,height:30,borderRadius:8,alignItems:'center',justifyContent:'center'},note:{flexDirection:'row',gap:7,alignItems:'center'},returnRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10,padding:12,borderWidth:StyleSheet.hairlineWidth,borderRadius:12}});
