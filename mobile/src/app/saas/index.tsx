import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { SaasButton, SaasCard, SaasFaq, SaasFeature, SaasHeading, SaasPage, saasStyles } from '@/components/saas/ui';
import { usePalette } from '@/lib/palette';
import { openSaasLink, useSaas } from '@/lib/saas';

export default function SaasHome() {
  const colors = usePalette();
  const { catalog } = useSaas();
  const branding = catalog?.branding;
  return <SaasPage>
    <SaasHeading eyebrow="Gestión para comercios" title="Tu negocio, conectado."
      description={branding?.description || 'Organizá ventas, productos y atención al cliente desde un mismo lugar. Conocé las herramientas y elegí el plan que se adapte a tu trabajo.'} />
    <View style={saasStyles.stack}>
      <SaasButton label="Conocer los planes" icon="arrow-forward-outline" onPress={() => router.replace('/saas/planes' as Href)} />
      <SaasButton label="Explorar soluciones" secondary onPress={() => router.replace('/saas/soluciones' as Href)} />
    </View>

    <Text accessibilityRole="header" style={[saasStyles.sectionTitle, { color: colors.text }]}>Del mostrador a la tienda online</Text>
    <SaasFeature icon="cart-outline" title="Gestioná el día a día" description="Consultá ventas, inventario y clientes. Los módulos disponibles dependen del plan y de tus permisos." />
    <SaasFeature icon="storefront-outline" title="Dale presencia a tu negocio" description="Conocé las opciones de catálogo público, pedidos y Marketplace para conectar con tus clientes." />
    <SaasCard>
      <Text accessibilityRole="header" style={[saasStyles.sectionTitle, { color: colors.text }]}>Encontrá tu forma de trabajar</Text>
      <Text style={[saasStyles.body, { color: colors.muted }]}>Comercios, talleres y equipos con varias sucursales tienen necesidades diferentes. Descubrí qué herramientas pueden ayudarte.</Text>
      <SaasButton label="Ver tipos de negocios" secondary icon="business-outline" onPress={() => router.replace('/saas/negocios' as Href)} />
    </SaasCard>

    <Text accessibilityRole="header" style={[saasStyles.sectionTitle, { color: colors.text }]}>Antes de empezar</Text>
    <View>
      <SaasFaq question="¿Cómo creo mi cuenta?" answer="Elegí un plan y continuá con el registro en la web. Después podés ingresar en esta aplicación con tu cuenta. El registro web y el inicio de sesión móvil son pasos separados." />
      <SaasFaq question="¿Todos los planes incluyen lo mismo?" answer="No. La sección Planes muestra los límites y las funciones habilitadas para cada opción. Los días de prueba se anuncian sólo cuando están configurados para ese plan." />
      <SaasFaq question="¿Puedo usar impresora o lector de códigos?" answer="La compatibilidad depende del dispositivo, del navegador y del periférico. Probá tu equipo y el formato de ticket antes de usarlo en el comercio." />
    </View>
    {branding?.secondaryCtaHref && <SaasButton label={branding.secondaryCtaLabel || 'Consultar opciones'} secondary icon="open-outline" onPress={() => void openSaasLink(branding.secondaryCtaHref)} />}
    <Text style={[saasStyles.note, { color: colors.muted }]}>Las opciones que se abren en la web se muestran en el navegador. Tu sesión del teléfono se administra de forma independiente.</Text>
  </SaasPage>;
}
