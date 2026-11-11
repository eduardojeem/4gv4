import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { palette, usePalette } from '@/lib/palette';
/** The auth session consumes this callback; a cold start offers safe navigation. */
export default function CaptchaReturn() {
  const colors=usePalette();
  return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:16,backgroundColor:colors.background}}><ActivityIndicator color={palette.primary}/><Text style={{color:colors.text,textAlign:'center'}}>Volviendo al registro…</Text><Pressable accessibilityRole="button" onPress={()=>router.canGoBack()?router.back():router.replace('/join' as never)}><Text style={{color:palette.primary}}>Volver al formulario</Text></Pressable></View>;
}