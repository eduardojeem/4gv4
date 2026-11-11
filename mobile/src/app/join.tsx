import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebsiteScreen } from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
export default function JoinScreen() {
  const colors = usePalette();
  return <WebsiteScreen title="Crear una cuenta" subtitle="Elegí cómo querés usar MiTiendaPy">
    {[
      { title: 'Quiero comprar o reservar', description: 'Tu cuenta personal. No necesitás una empresa ni un plan.', icon: 'person-outline' as const, path: '/register-customer' },
      { title: 'Quiero registrar mi empresa', description: 'Creá tu comercio, elegí un plan y configurá tu negocio.', icon: 'storefront-outline' as const, path: '/register' },
    ].map(option => <Pressable key={option.path} accessibilityRole="button" onPress={() => router.push(option.path as never)} style={({ pressed }) => [styles.card, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={styles.icon}><Ionicons name={option.icon} size={25} color={palette.primary} /></View>
      <View style={styles.body}><Text style={[styles.title,{color:colors.text}]}>{option.title}</Text><Text style={[styles.description,{color:colors.muted}]}>{option.description}</Text></View>
      <Ionicons name="chevron-forward" color={colors.muted} size={18} />
    </Pressable>)}
    <Pressable accessibilityRole="button" onPress={() => router.replace('/sign-in' as never)} style={styles.login}><Text style={{color:palette.primary,fontWeight:'700'}}>¿Ya tenés cuenta? Ingresá</Text></Pressable>
  </WebsiteScreen>;
}
const styles=StyleSheet.create({card:{borderWidth:1,borderRadius:20,padding:18,flexDirection:'row',alignItems:'center',gap:14},icon:{backgroundColor:`${palette.primary}12`,padding:12,borderRadius:16},body:{flex:1,gap:7},title:{fontSize:17,fontWeight:'700'},description:{fontSize:14,lineHeight:21},login:{padding:16,alignItems:'center'}});