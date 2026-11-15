import {Ionicons} from '@expo/vector-icons';
import {useEffect,useState} from 'react';
import {Keyboard,Pressable,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ADMIN_DOCK_TABS,adminItem,isAdminCommandSecondaryActive,isAdminRouteActive,type AdminNavItem} from '@/lib/admin-nav';
import {navigationInk} from '@/lib/bottom-nav-model';
import {usePalette} from '@/lib/palette';

export function AdminNavigationBar({pathname,menuOpen,accent,onMenu,onSelect}:{pathname:string;menuOpen:boolean;accent:string;onMenu:()=>void;onSelect:(item:AdminNavItem)=>void}){
 const colors=usePalette(),insets=useSafeAreaInsets();
 const [keyboard,setKeyboard]=useState(Keyboard.isVisible());
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{show.remove();hide.remove();};},[]);
 if(keyboard)return null;
 const items=ADMIN_DOCK_TABS.map(adminItem).filter((item):item is AdminNavItem=>Boolean(item));
 const entry=(item:AdminNavItem)=><Tab key={item.key} label={item.key==='cash'?'Cajas':item.key==='settings'?'Ajustes':item.label} icon={item.icon} active={!menuOpen&&isAdminRouteActive(pathname,item)} accent={accent} onPress={()=>onSelect(item)}/>;
 return <View accessibilityRole="tablist" style={[styles.bar,{backgroundColor:colors.card,borderColor:colors.border,paddingBottom:Math.max(insets.bottom,8)}]}>
  {items.slice(0,2).map(entry)}
  <Tab label="Más" icon="apps-outline" active={menuOpen||isAdminCommandSecondaryActive(pathname)} accent={accent} onPress={onMenu}/>
  {items.slice(2).map(entry)}
 </View>;
}
function Tab({label,icon,active,accent,onPress}:{label:string;icon:AdminNavItem['icon'];active:boolean;accent:string;onPress:()=>void}){
 const colors=usePalette();
 return <Pressable accessibilityRole="tab" accessibilityState={{selected:active}} accessibilityLabel={label} onPress={onPress} style={({pressed})=>[styles.tab,{opacity:pressed?0.6:1}]}>
  <View style={[styles.icon,{backgroundColor:active?accent:'transparent'}]}><Ionicons name={icon} size={21} color={active?navigationInk(accent):colors.muted}/></View>
  <Text style={[styles.label,{color:active?colors.text:colors.muted,fontWeight:active?'700':'500'}]}>{label}</Text>
 </Pressable>;
}
const styles=StyleSheet.create({bar:{flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,paddingTop:5},tab:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center',gap:3},icon:{width:40,height:28,borderRadius:10,alignItems:'center',justifyContent:'center'},label:{fontSize:10,textAlign:'center'}});
