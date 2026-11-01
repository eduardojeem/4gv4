import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { Notice, SettingsCard, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { storeUrl } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import { HOME_SECTIONS, sectionEnabled } from '@/lib/website-model';

const go = (path: string) => router.push(`/admin/website/${path}` as never);

export default function WebsiteHome() {
  const colors = usePalette();
  const { refreshing, reload, organizationName } = useWebsite();

  return (
    <WebsiteGate title="Sitio web">
      {(settings) => {
        const company = settings.company_info;
        const published = company.storefrontPublic === true;
        const url = storeUrl(company);
        const visibleSections = HOME_SECTIONS.filter((section) => sectionEnabled(settings, section)).length;
        const slides = settings.promotional_carousel?.slides?.length ?? 0;
        const bookingActive = settings.booking_section?.enabled === true;

        const preview = async () => {
          if (!url) {
            Alert.alert('Falta la dirección', 'Elegí la dirección de tu tienda en «Dirección y publicación».');
            return;
          }
          if (!published) {
            Alert.alert(
              'La tienda no está publicada',
              'Mientras no la publiques, la tienda no se puede abrir: vas a ver un aviso de tienda cerrada. Publicala desde «Dirección y publicación».',
              [{ text: 'Entendido', style: 'cancel' }, { text: 'Abrir igual', onPress: () => void WebBrowser.openBrowserAsync(url) }],
            );
            return;
          }
          await WebBrowser.openBrowserAsync(url);
        };

        return (
          <WebsiteScreen
            title="Sitio web"
            subtitle={organizationName ?? undefined}
            refreshing={refreshing}
            onRefresh={() => void reload()}
            right={
              <Pressable onPress={preview} accessibilityRole="button" accessibilityLabel="Vista previa" style={styles.previewChip}>
                <Ionicons name="eye-outline" size={16} color={palette.primary} />
                <Text style={styles.previewChipText}>Vista previa</Text>
              </Pressable>
            }>
            <OfflineNotice />
            <View style={[styles.status, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={websiteStyles.row}>
                <View style={[styles.dot, { backgroundColor: published ? palette.success : colors.muted }]} />
                <Text style={[styles.statusTitle, { color: colors.text }]}>{published ? 'Sitio publicado' : 'Sitio no publicado'}</Text>
              </View>
              {url ? (
                <Pressable onPress={() => void Share.share({ message: url })} accessibilityRole="button" accessibilityLabel="Compartir dirección" style={websiteStyles.row}>
                  <Text numberOfLines={1} style={[styles.url, { color: palette.primary }]}>{url.replace(/^https?:\/\//, '')}</Text>
                  <Ionicons name="share-outline" size={16} color={palette.primary} />
                </Pressable>
              ) : (
                <Text style={[styles.statusHint, { color: colors.muted }]}>Todavía no tiene dirección pública.</Text>
              )}
              {company.marketplacePublic && published ? <Text style={[styles.statusHint, { color: colors.muted }]}>También aparece en el marketplace.</Text> : null}
            </View>

            <Notice text="No hay borradores: cada cambio se ve en tu tienda apenas lo guardás. Es la misma configuración que editás desde la web." />

            <SettingsCard icon="color-palette-outline" title="Apariencia" hint="Logo, colores y estilo" onPress={() => go('appearance')} />
            <SettingsCard icon="home-outline" title="Página de inicio" hint="Portada y secciones visibles" badge={`${visibleSections} activas`} onPress={() => go('home')} />
            <SettingsCard icon="calendar-outline" title="Reservas y citas" hint="Turnos, citas técnicas o asesoramiento" badge={bookingActive ? 'Activa' : undefined} onPress={() => go('booking')} />
            <SettingsCard icon="images-outline" title="Banners" hint="Campañas rotativas del inicio" badge={slides ? `${slides}` : undefined} onPress={() => go('banners')} />
            <SettingsCard icon="pricetags-outline" title="Catálogo y destacados" hint="Productos destacados en tu tienda" onPress={() => go('catalog')} />
            <SettingsCard icon="storefront-outline" title="Negocio y redes" hint="Contacto, horarios, WhatsApp e Instagram" onPress={() => go('business')} />
            <SettingsCard icon="search-outline" title="SEO" hint="Cómo aparece en buscadores" onPress={() => go('seo')} />
            <SettingsCard icon="globe-outline" title="Dirección y publicación" hint="La dirección de tu tienda y quién la ve" onPress={() => go('domain')} />

            <Pressable onPress={preview} accessibilityRole="button" style={[websiteStyles.secondaryButton, { borderColor: colors.border }]}>
              <Ionicons name="open-outline" size={17} color={colors.text} />
              <Text style={[websiteStyles.secondaryText, { color: colors.text }]}>Vista previa del sitio</Text>
            </Pressable>
            <Text style={[styles.foot, { color: colors.muted }]}>Pagos y entregas, servicios y avisos se siguen editando desde la web.</Text>
          </WebsiteScreen>
        );
      }}
    </WebsiteGate>
  );
}

const styles = StyleSheet.create({
  previewChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: `${palette.primary}14` },
  previewChipText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  status: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  url: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  statusHint: { fontSize: 12 },
  foot: { fontSize: 12, textAlign: 'center' },
});
