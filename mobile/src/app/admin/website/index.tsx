import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { StorefrontLivePreview } from '@/components/website/storefront-preview';
import { WebsiteAssistantSheet } from '@/components/website/website-assistant-sheet';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteMediaLibrarySheet } from '@/components/website/website-media-sheet';
import {
  Notice,
  ProgressBar,
  SettingsCard,
  StatusPill,
  WebsiteScreen,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { storeUrl } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  HOME_SECTIONS,
  STOREFRONT_TEMPLATES_META,
  isAnnouncementLive,
  normalizeAnnouncementList,
  sectionEnabled,
} from '@/lib/website-model';

const go = (path: string) => router.push(`/admin/website/${path}` as never);

const COMMERCE_LABELS = {
  cart: 'Carrito',
  whatsapp: 'WhatsApp',
  catalog: 'Solo vitrina',
} as const;

export default function WebsiteHome() {
  const colors = usePalette();
  const {
    refreshing,
    reload,
    organizationName,
    capabilities,
    resolvedStyle,
    availability,
    checklist,
    mediaQuota,
  } = useWebsite();

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  return (
    <WebsiteGate title="Sitio web">
      {(settings) => {
        const company = settings.company_info;
        const published = company.storefrontPublic === true;
        const url = storeUrl(company);
        const visibleSections = HOME_SECTIONS.filter(
          (section) =>
            (!section.availabilityKey ||
              availability[section.availabilityKey].available) &&
            sectionEnabled(settings, section),
        ).length;

        const slides = settings.promotional_carousel?.slides?.length ?? 0;
        const bookingActive = settings.booking_section?.enabled === true;
        const trustCount = (settings.trust_bar?.items ?? []).filter(
          (i) => i.active !== false,
        ).length;
        const trustOn = settings.trust_bar?.enabled !== false && trustCount > 0;
        const brandsCount = (settings.brands_section?.items ?? []).filter(
          (b) => b.active !== false,
        ).length;
        const offersOn = settings.offers_section?.enabled !== false;
        const offersSlides = settings.offers_carousel?.slides?.length ?? 0;
        const galleryCount = settings.gallery_section?.images?.length ?? 0;
        const servicesCount = (settings.services ?? []).filter(
          (s) => s.active !== false,
        ).length;
        const flowsCount = settings.process_flows?.length ?? (settings.process_steps?.length ? 1 : 0);
        const announcements = normalizeAnnouncementList(
          settings.announcements ?? settings.announcement,
        );
        const liveAnnouncements = announcements.filter((a) =>
          isAnnouncementLive(a),
        ).length;
        const mode = settings.checkout?.commerceMode ?? 'cart';
        const templateMeta = STOREFRONT_TEMPLATES_META[resolvedStyle];

        const openSection = (
          route: string,
          sectionId?: keyof typeof availability,
        ) => {
          if (sectionId && !availability[sectionId].available) {
            Alert.alert(
              'Sección no disponible',
              `Esta sección requiere ${availability[sectionId].requires}.`,
            );
            return;
          }
          go(route);
        };

        const preview = async () => {
          if (!url) {
            Alert.alert(
              'Falta la dirección',
              'Elegí la dirección de tu tienda en «Dirección y publicación».',
            );
            return;
          }
          if (!published) {
            Alert.alert(
              'La tienda no está publicada',
              'Mientras no la publiques, quien entre verá un aviso de tienda cerrada. Publicala desde «Dirección y publicación».',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Abrir igual',
                  onPress: () => void WebBrowser.openBrowserAsync(url),
                },
              ],
            );
            return;
          }
          await WebBrowser.openBrowserAsync(url);
        };

        const progress =
          checklist && checklist.total > 0
            ? checklist.done / checklist.total
            : 0;

        return (
          <WebsiteScreen
            title="Sitio web"
            subtitle={organizationName ?? capabilities.businessLabel}
            refreshing={refreshing}
            onRefresh={() => void reload()}
            right={
              <Pressable
                onPress={preview}
                accessibilityRole="button"
                accessibilityLabel="Abrir tienda publicada"
                style={styles.previewChip}
              >
                <Ionicons
                  name="eye-outline"
                  size={16}
                  color={palette.primary}
                />
                <Text style={styles.previewChipText}>Ver tienda</Text>
              </Pressable>
            }
          >
            <OfflineNotice />

            {/* Tarjeta de estado en vivo y vista previa rápida */}
            <View
              style={[
                styles.heroStudioCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.heroStudioTop}>
                <View style={styles.rowCenter}>
                  <StatusPill
                    label={published ? 'Sitio publicado' : 'No publicado'}
                    tone={published ? 'success' : 'warning'}
                    icon={published ? 'globe-outline' : 'eye-off-outline'}
                  />
                  {published && company.marketplacePublic ? (
                    <StatusPill
                      label="Marketplace"
                      tone="primary"
                      icon="storefront-outline"
                    />
                  ) : null}
                </View>
                <StatusPill label={templateMeta.name} tone="neutral" />
              </View>

              <StorefrontLivePreview
                company={company}
                hero={settings.hero_content}
                resolvedStyle={resolvedStyle}
                compact
              />

              {url ? (
                <View style={styles.urlActionsRow}>
                  <Pressable
                    onPress={preview}
                    style={[
                      styles.urlPill,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="link-outline"
                      size={14}
                      color={palette.primary}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.urlText, { color: palette.primary }]}
                    >
                      {url.replace(/^https?:\/\//, '')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void Share.share({ message: url })}
                    accessibilityRole="button"
                    accessibilityLabel="Compartir enlace de la tienda"
                    style={[
                      styles.shareIconBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={18}
                      color={palette.primary}
                    />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => go('domain')}
                  style={[
                    styles.missingSlugBtn,
                    { borderColor: palette.primary },
                  ]}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color={palette.primary}
                  />
                  <Text style={styles.missingSlugText}>
                    Configurar dirección pública
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Barra de herramientas del Studio */}
            <View style={styles.studioToolsRow}>
              <Pressable
                onPress={() => setAssistantOpen(true)}
                accessibilityRole="button"
                style={[
                  styles.toolBtn,
                  {
                    backgroundColor: `${palette.primary}12`,
                    borderColor: `${palette.primary}35`,
                  },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color={palette.primary}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.toolBtnLabel, { color: palette.primary }]}
                >
                  Asistente
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMediaOpen(true)}
                accessibilityRole="button"
                style={[
                  styles.toolBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={colors.text}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.toolBtnLabel, { color: colors.text }]}
                >
                  Fotos ({mediaQuota.count}/{mediaQuota.limit})
                </Text>
              </Pressable>

              <Pressable
                onPress={preview}
                accessibilityRole="button"
                style={[
                  styles.toolBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="open-outline" size={18} color={colors.text} />
                <Text
                  numberOfLines={1}
                  style={[styles.toolBtnLabel, { color: colors.text }]}
                >
                  Abrir web
                </Text>
              </Pressable>
            </View>

            {/* Checklist guiado de puesta a punto */}
            {checklist ? (
              <View
                style={[
                  styles.checklistCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Pressable
                  onPress={() => setChecklistExpanded((v) => !v)}
                  style={styles.checklistHead}
                >
                  <View style={styles.flex}>
                    <Text
                      style={[styles.checklistTitle, { color: colors.text }]}
                    >
                      {checklist.next
                        ? `Guía de armado (${checklist.done}/${checklist.total})`
                        : '¡Tu sitio está completo!'}
                    </Text>
                    <Text
                      style={[styles.checklistSub, { color: colors.muted }]}
                    >
                      {checklist.next
                        ? `Siguiente paso: ${checklist.next.title}`
                        : 'Todos los pasos esenciales y recomendados están listos.'}
                    </Text>
                  </View>
                  <Ionicons
                    name={checklistExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>

                <ProgressBar
                  progress={progress}
                  color={checklist.next ? palette.primary : palette.success}
                />

                {checklist.next && !checklistExpanded ? (
                  <Pressable
                    onPress={() => router.push(checklist.next!.route as never)}
                    style={[
                      styles.nextStepBtn,
                      { backgroundColor: `${palette.primary}12` },
                    ]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.nextStepText}>
                        {checklist.next.cta} →
                      </Text>
                      {checklist.next.missing ? (
                        <Text
                          style={[
                            styles.nextStepMissing,
                            { color: colors.muted },
                          ]}
                        >
                          {checklist.next.missing}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="arrow-forward-circle"
                      size={22}
                      color={palette.primary}
                    />
                  </Pressable>
                ) : null}

                {checklistExpanded ? (
                  <View style={styles.stepList}>
                    {[...checklist.essentials, ...checklist.recommended].map(
                      (step) => (
                        <Pressable
                          key={step.id}
                          onPress={() => router.push(step.route as never)}
                          style={[
                            styles.stepItem,
                            { borderTopColor: colors.border },
                          ]}
                        >
                          <Ionicons
                            name={
                              step.done
                                ? 'checkmark-circle'
                                : 'ellipse-outline'
                            }
                            size={18}
                            color={
                              step.done ? palette.success : colors.muted
                            }
                          />
                          <View style={styles.flex}>
                            <Text
                              style={[
                                styles.stepTitle,
                                {
                                  color: step.done ? colors.muted : colors.text,
                                  textDecorationLine: step.done
                                    ? 'line-through'
                                    : 'none',
                                },
                              ]}
                            >
                              {step.title}
                            </Text>
                            {!step.done && step.missing ? (
                              <Text
                                style={[
                                  styles.stepMissing,
                                  { color: '#B45309' },
                                ]}
                              >
                                {step.missing}
                              </Text>
                            ) : null}
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.muted}
                          />
                        </Pressable>
                      ),
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Notice text="Todo lo que guardás acá actualiza tu sitio web en tiempo real: es exactamente el mismo editor que tenés en la web." />

            {/* Grupo 1: Diseño y portada */}
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: colors.text }]}
            >
              Diseño y portada
            </Text>
            <SettingsCard
              icon="color-palette-outline"
              title="Apariencia y plantillas"
              hint="Logo, colores, encabezado y estilo visual"
              badge={templateMeta.name}
              badgeTone="primary"
              onPress={() => go('appearance')}
            />
            <SettingsCard
              icon="home-outline"
              title="Página de inicio y portada"
              hint="Título, botones, sellos, cifras y orden visible"
              badge={`${visibleSections} activas`}
              onPress={() => go('home')}
            />
            <SettingsCard
              icon="shield-checkmark-outline"
              title="Beneficios y garantías"
              hint="Barra de confianza con íconos en el inicio"
              badge={trustOn ? `${trustCount} activos` : 'Oculta'}
              badgeTone={trustOn ? 'success' : 'neutral'}
              onPress={() => go('benefits')}
            />
            <SettingsCard
              icon="images-outline"
              title="Banners promocionales"
              hint="Diapositivas y campañas rotativas del inicio"
              badge={slides ? `${slides}/6` : 'Sin banners'}
              onPress={() => go('banners')}
            />

            {/* Grupo 2: Ventas y catálogo */}
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: colors.text }]}
            >
              Ventas y catálogo
            </Text>
            <SettingsCard
              icon="card-outline"
              title="Pagos y entregas"
              hint="Carrito o WhatsApp, cuentas bancarias, QR y delivery"
              badge={COMMERCE_LABELS[mode]}
              badgeTone="primary"
              locked={!availability.checkout.available}
              lockReason={availability.checkout.requires}
              onPress={() => openSection('checkout', 'checkout')}
            />
            <SettingsCard
              icon="star-outline"
              title="Catálogo y destacados"
              hint="Productos destacados primero en tu tienda"
              locked={!capabilities.hasCatalog}
              lockReason="el catálogo de productos"
              onPress={() => openSection('catalog', 'checkout')}
            />
            <SettingsCard
              icon="pricetags-outline"
              title="Ofertas y rebajas"
              hint="Página /ofertas, acento y carrusel de promos"
              badge={
                offersSlides
                  ? `${offersSlides} banners`
                  : offersOn
                    ? 'Activa'
                    : 'Oculta'
              }
              badgeTone={offersOn ? 'success' : 'neutral'}
              locked={!availability.offers.available}
              lockReason={availability.offers.requires}
              onPress={() => openSection('offers', 'offers')}
            />
            <SettingsCard
              icon="ribbon-outline"
              title="Marcas destacadas"
              hint="Logos de marcas que vendés con detección automática"
              badge={brandsCount ? `${brandsCount}` : undefined}
              locked={!availability.brands.available}
              lockReason={availability.brands.requires}
              onPress={() => openSection('brands', 'brands')}
            />

            {/* Grupo 3: Servicios y atención */}
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: colors.text }]}
            >
              Servicios y atención
            </Text>
            <SettingsCard
              icon="briefcase-outline"
              title="Catálogo de servicios"
              hint="Tarjetas de servicios con precio, duración y beneficios"
              badge={servicesCount ? `${servicesCount}/10` : undefined}
              locked={!availability.services.available}
              lockReason={availability.services.requires}
              onPress={() => openSection('services', 'services')}
            />
            <SettingsCard
              icon="calendar-outline"
              title="Reservas y citas"
              hint="Turnos online, citas técnicas o asesoramiento"
              badge={bookingActive ? 'Activa' : undefined}
              badgeTone={bookingActive ? 'success' : 'neutral'}
              locked={!availability.booking.available}
              lockReason={availability.booking.requires}
              onPress={() => openSection('booking', 'booking')}
            />
            <SettingsCard
              icon="camera-outline"
              title="Galería de trabajos"
              hint="Hasta 12 fotos reales de tus servicios o entregas"
              badge={galleryCount ? `${galleryCount}/12` : undefined}
              locked={!availability.gallery.available}
              lockReason={availability.gallery.requires}
              onPress={() => openSection('gallery', 'gallery')}
            />
            <SettingsCard
              icon="list-outline"
              title="Cómo atendemos"
              hint="Pasos explicativos de compra, turnos o taller"
              badge={flowsCount ? `${flowsCount}` : undefined}
              onPress={() => go('process')}
            />

            {/* Grupo 4: Avisos, negocio y publicación */}
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: colors.text }]}
            >
              Avisos, negocio y publicación
            </Text>
            <SettingsCard
              icon="megaphone-outline"
              title="Avisos emergentes"
              hint="Popups de novedades, horarios y promos (hasta 3)"
              badge={
                liveAnnouncements > 0
                  ? `${liveAnnouncements} activo${liveAnnouncements > 1 ? 's' : ''}`
                  : announcements.length > 0
                    ? `${announcements.length}/3`
                    : undefined
              }
              badgeTone={liveAnnouncements > 0 ? 'success' : 'neutral'}
              onPress={() => go('announcements')}
            />
            <SettingsCard
              icon="storefront-outline"
              title="Negocio, horario y mapa"
              hint="RUC, contacto, Google Maps, horarios y redes"
              onPress={() => go('business')}
            />
            <SettingsCard
              icon="search-outline"
              title="SEO y vista en Google"
              hint="Cómo aparece tu tienda al buscar o compartir"
              onPress={() => go('seo')}
            />
            <SettingsCard
              icon="globe-outline"
              title="Dirección y publicación"
              hint="Enlace público, requisitos y visibilidad"
              badge={published ? 'Publicada' : 'Oculta'}
              badgeTone={published ? 'success' : 'warning'}
              onPress={() => go('domain')}
            />

            <Pressable
              onPress={preview}
              accessibilityRole="button"
              style={[
                websiteStyles.secondaryButton,
                { borderColor: colors.border },
              ]}
            >
              <Ionicons name="open-outline" size={17} color={colors.text} />
              <Text
                style={[websiteStyles.secondaryText, { color: colors.text }]}
              >
                Abrir tienda publicada
              </Text>
            </Pressable>

            <WebsiteAssistantSheet
              visible={assistantOpen}
              onClose={() => setAssistantOpen(false)}
            />
            <WebsiteMediaLibrarySheet
              visible={mediaOpen}
              onClose={() => setMediaOpen(false)}
            />
          </WebsiteScreen>
        );
      }}
    </WebsiteGate>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 40,
    paddingVertical: 6,
    backgroundColor: `${palette.primary}14`,
  },
  previewChipText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  heroStudioCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  heroStudioTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  urlActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urlPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  urlText: { flex: 1, fontSize: 13, fontWeight: '700' },
  shareIconBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingSlugBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
  },
  missingSlugText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  studioToolsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  toolBtnLabel: { fontSize: 12, fontWeight: '800' },
  checklistCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  checklistHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistTitle: { fontSize: 15, fontWeight: '800' },
  checklistSub: { fontSize: 12, marginTop: 2 },
  nextStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nextStepText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  nextStepMissing: { fontSize: 11, marginTop: 1 },
  stepList: { gap: 2, marginTop: 2 },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
  },
  stepTitle: { fontSize: 13, fontWeight: '700' },
  stepMissing: { fontSize: 11, marginTop: 1 },
  groupTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
});
