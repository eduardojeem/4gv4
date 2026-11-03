import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { PanelAccessState } from '@/components/panel-access-state';
import { usePanel } from '@/lib/panel';
import { openWeb } from '@/lib/marketplace';
import { usePalette } from '@/lib/palette';

/** Reuse the existing order form; do not duplicate inventory/payment rules. */
export default function NewOrderScreen() {
  const { data, findItem, can } = usePanel();
  const colors = usePalette();
  const [opening, setOpening] = useState(false);
  if (!findItem('orders') || !can('ecommerce.orders.manage')) return <PanelAccessState />;
  const open = async () => {
    if (opening) return;
    setOpening(true);
    try { await openWeb('/dashboard/orders/new?organizationId=' + encodeURIComponent(data!.organization.id)); }
    catch { Alert.alert('No se pudo abrir', 'Probá nuevamente para cargar el pedido.'); }
    finally { setOpening(false); }
  };
  return <View style={{ padding: 24, gap: 16 }}>
    <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>Nuevo pedido</Text>
    <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 23 }}>El formulario de pedidos se abre en la web. Podés elegir el cliente, agregar productos y configurar el retiro o envío. Si te pide iniciar sesión, usá tu cuenta habitual.</Text>
    <Pressable accessibilityRole="button" disabled={opening} onPress={() => void open()} style={{ backgroundColor: colors.text, borderRadius: 16, padding: 16, opacity: opening ? .5 : 1 }}>
      <Text style={{ color: colors.card, fontWeight: '700', textAlign: 'center' }}>{opening ? 'Abriendo…' : 'Abrir formulario de pedido'}</Text>
    </Pressable>
  </View>;
}
