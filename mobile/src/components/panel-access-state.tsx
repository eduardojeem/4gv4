import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { usePanel } from '@/lib/panel';
import { usePalette } from '@/lib/palette';
export function PanelAccessState() {
 const { loading, error, reload } = usePanel(); const colors = usePalette();
 return <View style={{ flex:1,padding:24,gap:12,justifyContent:'center',alignItems:'center' }}>
  {loading ? <ActivityIndicator /> : <><Text accessibilityRole="header" style={{color:colors.text,fontSize:20,fontWeight:'700'}}>{error ? 'No se pudo cargar el panel' : 'Sección no disponible'}</Text>
   <Text accessibilityRole={error ? 'alert' : undefined} style={{color:colors.muted}}>{error || 'Tu usuario o tu plan no incluyen esta sección.'}</Text>
   {error && <Pressable accessibilityRole="button" onPress={reload}><Text style={{color:colors.text,padding:12}}>Reintentar</Text></Pressable>}
  </>}
 </View>;
}
