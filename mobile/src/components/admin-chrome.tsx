import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router,usePathname} from 'expo-router';
import {createContext,useContext,useState,type PropsWithChildren} from 'react';
import {Alert,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {type AdminNavItem} from '@/lib/admin-nav';
import {navigationColor} from '@/lib/bottom-nav-model';
import {openWeb} from '@/lib/marketplace';
import {usePalette} from '@/lib/palette';
import {usePanel} from '@/lib/panel';
import {AdminCommandMenu} from './admin-command-menu';
import {AdminNavigationBar} from './admin-navigation-bar';

const MenuContext=createContext({open:()=>{},menuOpen:false});
export const useAdminMenu=()=>useContext(MenuContext);
function go(item:AdminNavItem){
 if(item.route)router.navigate(item.route as never);
 else if(item.web)void openWeb(item.web).catch(()=>Alert.alert('No se pudo abrir esta sección','Volvé a intentar desde el menú Más.'));
}
export function AdminMenuProvider({children}:PropsWithChildren){
 const pathname=usePathname(),{data}=usePanel();
 const org=data?.organization,accent=navigationColor(org?.brandColor,org?.customBrandColor);
 const menuKey=JSON.stringify([pathname,org?.id,org?.role,data?.user.email]);
 const [menu,setMenu]=useState({key:menuKey,visible:false});
 if(menu.key!==menuKey)setMenu({key:menuKey,visible:false});
 const visible=menu.key===menuKey&&menu.visible;
 const open=()=>setMenu({key:menuKey,visible:true});
 return <MenuContext.Provider value={{open,menuOpen:visible}}>
  {children}
  <AdminCommandMenu key={menuKey} visible={visible} onClose={()=>setMenu({key:menuKey,visible:false})} pathname={pathname} orgName={org?.name} orgLogoUrl={org?.logoUrl} accent={accent} onGoPanel={()=>router.replace('/panel' as never)} onSelectItem={go}/>
 </MenuContext.Provider>;
}
export function AdminHeader(){
 const colors=usePalette(),{data}=usePanel(),{open}=useAdminMenu(),org=data?.organization;
 return <SafeAreaView edges={['top']} style={{backgroundColor:colors.card}}>
  <View style={[styles.header,{borderColor:colors.border}]}>
   <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Abrir menú Más de administración" style={styles.menu}><Ionicons name="menu-outline" size={24} color={colors.text}/></Pressable>
   <View style={[styles.logo,{backgroundColor:colors.background}]}>{org?.logoUrl?<Image source={org.logoUrl} contentFit="cover" style={styles.fill}/>:<Ionicons name="storefront-outline" size={20} color={colors.text}/>}</View>
   <View style={styles.flex}><Text numberOfLines={1} style={[styles.org,{color:colors.text}]}>{org?.name??'Tu negocio'}</Text><Text style={[styles.subtitle,{color:colors.muted}]}>Administración</Text></View>
   <Pressable onPress={()=>router.replace('/panel' as never)} accessibilityRole="button" accessibilityLabel="Volver al inicio del negocio" accessibilityHint="Abre el resumen principal del panel" style={[styles.home,{borderColor:colors.border,backgroundColor:colors.background}]}>
    <Ionicons name="home-outline" size={19} color={colors.text}/>
    <Text style={[styles.homeText,{color:colors.text}]}>Inicio</Text>
   </Pressable>
  </View>
 </SafeAreaView>;
}
export function AdminTabBar(){
 const {data}=usePanel(),{open,menuOpen}=useAdminMenu(),pathname=usePathname(),org=data?.organization;
 return <AdminNavigationBar pathname={pathname} menuOpen={menuOpen} accent={navigationColor(org?.brandColor,org?.customBrandColor)} onMenu={open} onSelect={go}/>;
}
const styles=StyleSheet.create({home:{minHeight:44,minWidth:44,paddingHorizontal:10,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,alignItems:"center",justifyContent:"center",gap:2},homeText:{fontSize:11,fontWeight:"600"},flex:{flex:1},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:6,gap:10,borderBottomWidth:StyleSheet.hairlineWidth},menu:{width:44,height:44,alignItems:'center',justifyContent:'center'},logo:{width:32,height:32,borderRadius:9,overflow:'hidden',alignItems:'center',justifyContent:'center'},fill:{width:'100%',height:'100%'},org:{fontSize:15,fontWeight:'700'},subtitle:{fontSize:12,marginTop:1}});
