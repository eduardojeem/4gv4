import { router, type Href } from 'expo-router';
import { Text } from 'react-native';

import { SaasButton, SaasFeature, SaasHeading, SaasPage, saasStyles } from '@/components/saas/ui';
import { usePalette } from '@/lib/palette';

export default function SaasBusinesses() {
  const colors = usePalette();
  return <SaasPage>
    <SaasHeading eyebrow="Negocios" title="Una forma de trabajar para cada comercio."
      description="Identificá las tareas de tu negocio y compará las funciones y capacidades que necesitás. No hace falta elegir un plan por el nombre de tu rubro." />
    <SaasFeature icon="storefront-outline" title="Tiendas y comercios" description="Conectá ventas de mostrador, productos, existencias y clientes. Revisá la cantidad de usuarios, cajas y productos que necesitás administrar." />
    <SaasFeature icon="construct-outline" title="Talleres y servicios técnicos" description="Seguí los equipos desde la recepción hasta la entrega. Compará disponibilidad del módulo de reparaciones, capacidad mensual y fotos por orden." />
    <SaasFeature icon="business-outline" title="Equipos con varias sucursales" description="Organizá locales y usuarios con sus roles. Compará los límites de sucursales y cajas antes de incorporar a todo el equipo." />
    <SaasFeature icon="bag-handle-outline" title="Comercios que venden online" description="Combiná tu presencia pública con la gestión del comercio. Revisá las funciones de tienda, pedidos y entregas disponibles para cada plan." />
    <Text style={[saasStyles.note, { color: colors.muted }]}>Estos ejemplos orientan la elección. Las capacidades concretas y las funciones incluidas se consultan en Planes.</Text>
    <SaasButton label="Encontrar mi plan" icon="arrow-forward-outline" onPress={() => router.replace('/saas/planes' as Href)} />
    <SaasButton label="Explorar comercios del Marketplace" secondary icon="storefront-outline" onPress={() => router.push('/stores' as Href)} />
  </SaasPage>;
}
