import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openWeb, storePath, type MarketStore } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

interface StoreDetailSheetProps {
  store: MarketStore | null;
  visible: boolean;
  onClose: () => void;
  onViewProducts: (slug: string) => void;
}

export function StoreDetailSheet({
  store,
  visible,
  onClose,
  onViewProducts,
}: StoreDetailSheetProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();

  if (!store) return null;

  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const url = `https://www.mitiendapy.com${storePath(store)}`;
      await Share.share({
        title: store.name,
        message: `Mirá la tienda oficial de ${store.name} en Mi tiendaPY: ${url}`,
        url,
      });
    } catch {
      // Ignore share errors
    }
  };

  const handleWhatsApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const message = encodeURIComponent(
      `¡Hola ${store.name}! Vi su tienda en Mi tiendaPY.com y me gustaría hacer una consulta.`
    );

    const rawNumber = store.whatsapp ? store.whatsapp.replace(/\D/g, '') : null;
    if (rawNumber && rawNumber.length >= 8) {
      let phoneWithCountry = rawNumber;
      if (rawNumber.startsWith('09')) {
        phoneWithCountry = `595${rawNumber.slice(1)}`;
      } else if (rawNumber.startsWith('9')) {
        phoneWithCountry = `595${rawNumber}`;
      }
      await Linking.openURL(`https://wa.me/${phoneWithCountry}?text=${message}`);
    } else {
      await openWeb(storePath(store));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar tienda" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16) + 10,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.topActionsRow}>
            <View style={styles.badgeLine}>
              <View style={[styles.verifiedPill, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                <Ionicons name="shield-checkmark" size={13} color={palette.primary} />
                <Text style={[styles.verifiedText, { color: palette.primary }]}>Comercio Verificado</Text>
              </View>
            </View>

            <View style={styles.topButtons}>
              <Pressable onPress={handleShare} hitSlop={8} style={[styles.circleBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="share-outline" size={19} color={colors.text} />
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8} style={[styles.circleBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Header del comercio */}
            <View style={styles.storeHero}>
              <View style={[styles.storeBigLogo, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {store.logo ? (
                  <Image source={store.logo} style={styles.logoImg} contentFit="cover" />
                ) : (
                  <Text style={[styles.storeBigInitial, { color: palette.primary }]}>
                    {store.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text>

              {(store.city || store.rubro) && (
                <View style={styles.storeLocation}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text style={[styles.storeLocationText, { color: colors.muted }]}>
                    {[store.city, store.rubro].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}

              {/* Estadísticas de la tienda */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="cube-outline" size={16} color={palette.primary} />
                  <Text style={[styles.statVal, { color: colors.text }]}>{store.products}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>Productos</Text>
                </View>

                {store.rating ? (
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="star" size={16} color="#F59E0B" />
                    <Text style={[styles.statVal, { color: colors.text }]}>{store.rating.toFixed(1)}</Text>
                    <Text style={[styles.statLbl, { color: colors.muted }]}>Calificación</Text>
                  </View>
                ) : (
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="storefront-outline" size={16} color="#10B981" />
                    <Text style={[styles.statVal, { color: colors.text }]}>Activa</Text>
                    <Text style={[styles.statLbl, { color: colors.muted }]}>En línea</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Acciones principales */}
          <View style={[styles.footerBar, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={() => {
                onClose();
                onViewProducts(store.slug);
              }}
              style={[styles.primaryBtn, { backgroundColor: palette.primary }]}>
              <Ionicons name="bag-handle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Ver Productos en la App</Text>
            </Pressable>

            <View style={styles.secondaryBtnRow}>
              <Pressable
                onPress={handleWhatsApp}
                style={[styles.halfBtn, { backgroundColor: '#10B981' }]}>
                <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />
                <Text style={styles.halfBtnText}>WhatsApp</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openWeb(storePath(store));
                }}
                style={[styles.halfBtnOutline, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="globe-outline" size={17} color={colors.text} />
                <Text style={[styles.halfBtnOutlineText, { color: colors.text }]}>Web Oficial</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  badgeLine: {
    flexDirection: 'row',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  storeHero: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 8,
  },
  storeBigLogo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  storeBigInitial: {
    fontSize: 34,
    fontWeight: '900',
  },
  storeName: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  storeLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeLocationText: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    width: '100%',
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 11,
  },
  footerBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  halfBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  halfBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  halfBtnOutlineText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
