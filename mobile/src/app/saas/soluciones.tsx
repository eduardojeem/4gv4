import { router, type Href } from 'expo-router';
import { Text } from 'react-native';

import { SaasButton, SaasFeature, SaasHeading, SaasPage, saasStyles } from '@/components/saas/ui';
import { usePalette } from '@/lib/palette';

export default function SaasSolutions() {
  const colors = usePalette();
  return <SaasPage>
    <SaasHeading eyebrow="Soluciones" title="Herramientas para cada parte del negocio."
      description="Explorá las funciones de la plataforma. En Planes podés comprobar cuáles están incluidas antes de crear tu cuenta." />
    <SaasFeature icon="cart-outline" title="Ventas y caja" description="Punto de venta, registro de cobros, turnos de caja y comprobantes para acompañar las operaciones de mostrador." />
    <SaasFeature icon="cube-outline" title="Productos e inventario" description="Catálogo de productos, categorías y marcas, existencias y búsqueda por código de barras." />
    <SaasFeature icon="construct-outline" title="Reparaciones y servicio técnico" description="Órdenes de trabajo, diagnóstico, técnicos y seguimiento del estado de los equipos." />
    <SaasFeature icon="people-outline" title="Clientes y créditos" description="Historial de clientes, créditos y seguimiento de pagos, con acceso según los permisos del equipo." />
    <SaasFeature icon="storefront-outline" title="Tienda pública y Marketplace" description="Catálogo público y canales de contacto para mostrar productos y recibir consultas y pedidos." />
    <SaasFeature icon="business-outline" title="Sucursales y equipo" description="Organización del trabajo por sucursal y permisos por rol para controlar quién puede consultar o modificar información." />
    <Text style={[saasStyles.note, { color: colors.muted }]}>La disponibilidad depende del plan contratado y de la configuración de tu comercio. Algunas herramientas se utilizan desde la web.</Text>
    <SaasButton label="Comparar planes y funciones" icon="arrow-forward-outline" onPress={() => router.replace('/saas/planes' as Href)} />
  </SaasPage>;
}
