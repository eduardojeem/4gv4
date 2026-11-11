import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  CarouselSlideSheet,
  SlidePreviewCard,
} from '@/components/website/carousel-slide-sheet';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  ChipSelector,
  Field,
  Notice,
  ReorderRow,
  SaveBar,
  Section,
  StateView,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  DEFAULT_OFFERS_CAROUSEL,
  DEFAULT_OFFERS_SECTION,
  OFFERS_ACCENTS,
  brandHex,
  emptySlide,
  isDirty,
  mergeSetting,
  moveItem,
  newSlideId,
  offersSectionIssues,
  slideIssues,
  type CarouselSlide,
  type OffersSectionSettings,
  type PromotionalCarousel,
  type WebsiteSettings,
} from '@/lib/website-model';

const MAX_OFFER_SLIDES = 6;

export default function OffersScreen() {
  return (
    <WebsiteGate title="Ofertas y rebajas">
      {(settings) => <OffersEditor settings={settings} />}
    </WebsiteGate>
  );
}

function OffersEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities } = useWebsite();

  const savedSection = useMemo(
    () =>
      mergeSetting<OffersSectionSettings>(
        DEFAULT_OFFERS_SECTION,
        (settings.offers_section ?? {}) as Partial<OffersSectionSettings>,
      ),
    [settings.offers_section],
  );
  const savedCarousel = useMemo(
    () =>
      ({
        ...DEFAULT_OFFERS_CAROUSEL,
        ...(settings.offers_carousel ?? {}),
      }) as PromotionalCarousel,
    [settings.offers_carousel],
  );

  const [sectionDraft, setSectionDraft] =
    useState<OffersSectionSettings>(savedSection);
  const [carouselDraft, setCarouselDraft] =
    useState<PromotionalCarousel>(savedCarousel);
  const [editingSlide, setEditingSlide] = useState<{
    slide: CarouselSlide;
    index: number | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const sectionDirty = isDirty(savedSection, sectionDraft);
  const carouselDirty = isDirty(savedCarousel, carouselDraft);
  const dirty = sectionDirty || carouselDirty;

  const issues = offersSectionIssues(sectionDraft);
  const slides = useMemo(() => carouselDraft.slides ?? [], [carouselDraft.slides]);
  const storeBrand = brandHex(settings.company_info);
  const accentObj =
    OFFERS_ACCENTS.find((a) => a.value === sectionDraft.accentColor) ??
    OFFERS_ACCENTS[1];
  const headerAccent =
    sectionDraft.accentColor === 'brand' ? storeBrand : accentObj.hex;

  const setSec = (patch: Partial<OffersSectionSettings>) =>
    setSectionDraft((prev) => ({ ...prev, ...patch }));

  const setAutoCarousel = (
    patch: Partial<NonNullable<OffersSectionSettings['carousel']>>,
  ) =>
    setSectionDraft((prev) => ({
      ...prev,
      carousel: {
        ...(prev.carousel ?? DEFAULT_OFFERS_SECTION.carousel!),
        ...patch,
      },
    }));

  const setCar = (patch: Partial<PromotionalCarousel>) =>
    setCarouselDraft((prev) => ({ ...prev, ...patch }));

  const save = useCallback(async () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá la sección de ofertas', msgs.join('\n'));
      return false;
    }
    const brokenSlide = slides.findIndex(
      (s) => Object.keys(slideIssues(s)).length > 0,
    );
    if (brokenSlide >= 0) {
      Alert.alert(
        'Revisá el banner de ofertas',
        `El banner ${brokenSlide + 1} tiene campos inválidos.`,
      );
      return false;
    }
    setSaving(true);
    try {
      const payload: Partial<Record<'offers_section' | 'offers_carousel', unknown>> =
        {};
      if (sectionDirty) payload.offers_section = sectionDraft;
      if (carouselDirty) payload.offers_carousel = carouselDraft;
      const persisted = await saveWebsiteSettings(payload);
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.offers_section)
        setSectionDraft(
          mergeSetting<OffersSectionSettings>(
            DEFAULT_OFFERS_SECTION,
            persisted.offers_section as Partial<OffersSectionSettings>,
          ),
        );
      if (persisted.offers_carousel)
        setCarouselDraft({
          ...DEFAULT_OFFERS_CAROUSEL,
          ...(persisted.offers_carousel as PromotionalCarousel),
        });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar los cambios de ofertas.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    issues,
    slides,
    sectionDirty,
    sectionDraft,
    carouselDirty,
    carouselDraft,
    applySaved,
  ]);

  useUnsavedChangesGuard(dirty, save, saving);

  const commitSlide = (slide: CarouselSlide, index: number | null) => {
    const next =
      index === null
        ? [...slides, slide]
        : slides.map((s, i) => (i === index ? slide : s));
    setCar({ slides: next });
    setEditingSlide(null);
  };

  return (
    <WebsiteScreen
      saving={saving}
      title="Ofertas y rebajas"
      subtitle="Sección en /ofertas y productos en promoción"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => {
            setSectionDraft(savedSection);
            setCarouselDraft(savedCarousel);
          }}
        />
      }
    >
      <OfflineNotice />

      {/* Vista previa de encabezado de ofertas */}
      <View
        style={[
          styles.offerPreview,
          { backgroundColor: headerAccent },
        ]}
      >
        <View style={styles.offerPreviewBadge}>
          <Ionicons name="flame" size={12} color="#fff" />
          <Text style={styles.offerPreviewEyebrow}>
            {sectionDraft.eyebrow || 'Ofertas especiales'}
          </Text>
        </View>
        <Text style={styles.offerPreviewTitle}>
          {sectionDraft.title || 'Precios que vale la pena aprovechar'}
        </Text>
        <Text style={styles.offerPreviewSub}>
          {sectionDraft.subtitle ||
            'Productos seleccionados con descuentos activos en el catálogo.'}
        </Text>
      </View>

      <Section title="Encabezado de ofertas" icon="pricetags-outline">
        <ToggleRow
          label="Mostrar bloque de ofertas en la tienda"
          hint="Muestra automáticamente tus productos con precio de oferta."
          value={sectionDraft.enabled}
          onValueChange={(val) => setSec({ enabled: val })}
        />

        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: colors.text }]}>
            Color del banner de ofertas
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accentsRow}
          >
            {OFFERS_ACCENTS.map((acc) => {
              const colorHex = acc.value === 'brand' ? storeBrand : acc.hex;
              const active = sectionDraft.accentColor === acc.value;
              return (
                <Pressable
                  key={acc.value}
                  onPress={() => setSec({ accentColor: acc.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.accentChip,
                    {
                      borderColor: active ? colorHex : colors.border,
                      backgroundColor: active
                        ? `${colorHex}18`
                        : colors.background,
                    },
                  ]}
                >
                  <View
                    style={[styles.accentDot, { backgroundColor: colorHex }]}
                  />
                  <Text
                    style={[
                      styles.accentLabel,
                      { color: active ? colorHex : colors.text },
                    ]}
                  >
                    {acc.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Field
          label="Etiqueta superior"
          value={sectionDraft.eyebrow}
          onChangeText={(val) => setSec({ eyebrow: val })}
          maxLength={60}
          showCount
          error={issues.eyebrow}
        />
        <Field
          label="Título principal"
          value={sectionDraft.title}
          onChangeText={(val) => setSec({ title: val })}
          maxLength={120}
          showCount
          error={issues.title}
        />
        <Field
          label="Subtítulo"
          value={sectionDraft.subtitle}
          onChangeText={(val) => setSec({ subtitle: val })}
          multiline
          maxLength={240}
          showCount
          error={issues.subtitle}
        />
      </Section>

      {/* Carrusel automático de productos en descuento */}
      <Section
        title="Carrusel automático de descuentos"
        icon="flash-outline"
        hint="Muestra los productos que ya tienen precio de oferta en inventario."
      >
        <ToggleRow
          label="Activar rotación de productos en oferta"
          value={sectionDraft.carousel?.enabled !== false}
          onValueChange={(val) => setAutoCarousel({ enabled: val })}
        />
        {sectionDraft.carousel?.enabled !== false ? (
          <>
            <Field
              label="Título del carrusel"
              value={sectionDraft.carousel?.title ?? ''}
              onChangeText={(val) => setAutoCarousel({ title: val })}
              maxLength={100}
              error={issues.carouselTitle}
            />
            <Field
              label="Subtítulo"
              value={sectionDraft.carousel?.subtitle ?? ''}
              onChangeText={(val) => setAutoCarousel({ subtitle: val })}
              maxLength={200}
            />
            <ToggleRow
              label="Rotar automáticamente"
              value={sectionDraft.carousel?.autoplay !== false}
              onValueChange={(val) => setAutoCarousel({ autoplay: val })}
            />
            <View style={styles.block}>
              <Text style={[styles.blockLabel, { color: colors.text }]}>
                Máximo de productos
              </Text>
              <ChipSelector
                options={[
                  { value: '4', label: '4' },
                  { value: '6', label: '6' },
                  { value: '8', label: '8' },
                  { value: '12', label: '12' },
                ]}
                selected={String(sectionDraft.carousel?.maxItems ?? 8)}
                onSelect={(val) => setAutoCarousel({ maxItems: Number(val) })}
              />
            </View>
          </>
        ) : null}
      </Section>

      {/* Carrusel de banners exclusivos en la página /ofertas */}
      <Section
        title="Banners propios en /ofertas"
        icon="images-outline"
        hint="Diapositivas gráficas exclusivas arriba de la página de ofertas."
        right={<StatusPill label={`${slides.length}/${MAX_OFFER_SLIDES}`} />}
      >
        <ToggleRow
          label="Mostrar banners en /ofertas"
          value={carouselDraft.enabled}
          onValueChange={(val) => setCar({ enabled: val })}
        />
        {carouselDraft.enabled ? (
          <>
            <ChipSelector
              options={[
                { value: 'contained', label: 'Contenida' },
                { value: 'full', label: 'Ancho total' },
                { value: 'compact', label: 'Compacta' },
              ]}
              selected={carouselDraft.layoutMode ?? 'contained'}
              onSelect={(val) => setCar({ layoutMode: val })}
            />
            <ToggleRow
              label="Pasar solos"
              value={carouselDraft.autoplay}
              onValueChange={(val) => setCar({ autoplay: val })}
            />
          </>
        ) : null}
      </Section>

      {slides.length === 0 ? (
        <StateView
          icon="images-outline"
          title="Sin banners personalizados en /ofertas"
          text="Opcional: podés sumar banners propios para campañas o liquidaciones en /ofertas."
        />
      ) : (
        slides.map((slide, idx) => (
          <View
            key={slide.id}
            style={[
              styles.slideCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setEditingSlide({ slide, index: idx })}
            >
              <SlidePreviewCard
                slide={slide}
                brandHex={storeBrand}
                device="desktop"
              />
            </Pressable>
            <View style={styles.slideFooter}>
              <Text
                numberOfLines={1}
                style={[styles.slideTitle, { color: colors.text }]}
              >
                {slide.title || slide.imageAlt || `Banner ${idx + 1}`}
              </Text>
              <Switch
                value={slide.active}
                onValueChange={(val) =>
                  setCar({
                    slides: slides.map((s, i) =>
                      i === idx ? { ...s, active: val } : s,
                    ),
                  })
                }
                trackColor={{ false: colors.border, true: palette.primary }}
              />
            </View>
            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => setEditingSlide({ slide, index: idx })}
                style={styles.editLink}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={palette.primary}
                />
                <Text style={styles.editText}>Editar</Text>
              </Pressable>
              <ReorderRow
                disableUp={idx === 0}
                disableDown={idx === slides.length - 1}
                onUp={() => setCar({ slides: moveItem(slides, idx, -1) })}
                onDown={() => setCar({ slides: moveItem(slides, idx, 1) })}
                onDuplicate={
                  slides.length < MAX_OFFER_SLIDES
                    ? () => {
                        const copy: CarouselSlide = {
                          ...slide,
                          id: newSlideId(),
                        };
                        const next = [...slides];
                        next.splice(idx + 1, 0, copy);
                        setCar({ slides: next });
                      }
                    : undefined
                }
                onRemove={() =>
                  setCar({ slides: slides.filter((_, i) => i !== idx) })
                }
              />
            </View>
          </View>
        ))
      )}

      {slides.length < MAX_OFFER_SLIDES ? (
        <Pressable
          onPress={() =>
            setEditingSlide({
              slide: emptySlide({ ctaText: 'Ver ofertas', ctaHref: '/ofertas' }),
              index: null,
            })
          }
          style={websiteStyles.primaryButton}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={websiteStyles.primaryText}>
            Agregar banner a /ofertas
          </Text>
        </Pressable>
      ) : (
        <Notice text={`Llegaste al máximo de ${MAX_OFFER_SLIDES} banners en /ofertas.`} />
      )}

      <CarouselSlideSheet
        visible={Boolean(editingSlide)}
        slide={editingSlide?.slide ?? null}
        isNew={editingSlide?.index === null}
        brandHex={storeBrand}
        context={{
          businessVertical: capabilities.businessVertical,
          hasCatalog: capabilities.hasCatalog,
          hasServices: capabilities.hasServices,
          hasRepairs: capabilities.hasRepairs,
        }}
        onClose={() => setEditingSlide(null)}
        onSave={(slide) => commitSlide(slide, editingSlide?.index ?? null)}
      />
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  offerPreview: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  offerPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerPreviewEyebrow: { color: '#fff', fontSize: 11, fontWeight: '800' },
  offerPreviewTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  offerPreviewSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
  block: { gap: 7 },
  blockLabel: { fontSize: 13, fontWeight: '700' },
  accentsRow: { gap: 8, paddingVertical: 2 },
  accentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  accentDot: { width: 12, height: 12, borderRadius: 6 },
  accentLabel: { fontSize: 12, fontWeight: '700' },
  slideCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10,
  },
  slideFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  slideTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
});
