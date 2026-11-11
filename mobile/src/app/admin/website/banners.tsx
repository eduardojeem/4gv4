import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
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
  brandHex,
  carouselPlacement,
  emptySlide,
  isDirty,
  moveItem,
  newSlideId,
  slideIssues,
  type CarouselSlide,
  type PromotionalCarousel,
  type WebsiteSettings,
} from '@/lib/website-model';

const MAX_SLIDES = 6;
const INTERVALS = [5, 6, 7, 10, 15];
const DEFAULT_CAROUSEL: PromotionalCarousel = {
  enabled: false,
  autoplay: true,
  intervalSeconds: 6,
  layoutMode: 'contained',
  slides: [],
};

export default function BannersScreen() {
  return (
    <WebsiteGate title="Banners promocionales">
      {(settings) => <BannersEditor settings={settings} />}
    </WebsiteGate>
  );
}

function BannersEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, resolvedStyle, capabilities } = useWebsite();
  const saved = useMemo(
    () => ({ ...DEFAULT_CAROUSEL, ...(settings.promotional_carousel ?? {}) }),
    [settings.promotional_carousel],
  );
  const [carousel, setCarousel] = useState<PromotionalCarousel>(saved);
  const [editing, setEditing] = useState<{
    slide: CarouselSlide;
    index: number | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(saved, carousel);
  const slides = useMemo(() => carousel.slides ?? [], [carousel.slides]);
  const brandColor = brandHex(settings.company_info);
  const placement = carouselPlacement(resolvedStyle);

  const update = (patch: Partial<PromotionalCarousel>) =>
    setCarousel((current) => ({ ...current, ...patch }));
  const setSlides = (next: CarouselSlide[]) => update({ slides: next });

  const save = useCallback(async () => {
    const broken = slides.findIndex(
      (slide) => Object.keys(slideIssues(slide)).length > 0,
    );
    if (broken >= 0) {
      Alert.alert(
        'Revisá el banner',
        `El banner ${broken + 1} tiene datos incompletos: ${Object.values(
          slideIssues(slides[broken]),
        ).join(' ')}`,
      );
      return false;
    }
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({
        promotional_carousel: carousel,
      });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.promotional_carousel)
        setCarousel((current) =>
          isDirty(current, carousel)
            ? current
            : (persisted.promotional_carousel as PromotionalCarousel),
        );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar los banners. Revisá tu conexión e intentá nuevamente.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [slides, carousel, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const remove = (index: number) => {
    Alert.alert(
      '¿Eliminar este banner?',
      'Se quita de la lista. Dejará de verse en tu tienda cuando guardes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => setSlides(slides.filter((_, i) => i !== index)),
        },
      ],
    );
  };

  const duplicate = (index: number) => {
    if (slides.length >= MAX_SLIDES) {
      Alert.alert(
        'Límite alcanzado',
        `Podés tener hasta ${MAX_SLIDES} banners en el inicio.`,
      );
      return;
    }
    const source = slides[index];
    const copy: CarouselSlide = {
      ...source,
      id: newSlideId(),
      title: source.title ? `${source.title} (copia)` : '',
    };
    const next = [...slides];
    next.splice(index + 1, 0, copy);
    setSlides(next);
  };

  const commitSlide = (slide: CarouselSlide, index: number | null) => {
    setSlides(
      index === null
        ? [...slides, slide]
        : slides.map((item, i) => (i === index ? slide : item)),
    );
    setEditing(null);
  };

  return (
    <WebsiteScreen
      saving={saving}
      title="Banners promocionales"
      subtitle="Campañas rotativas del inicio"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setCarousel(saved)}
        />
      }
    >
      <OfflineNotice />

      <Notice
        tone={placement.replacesHero ? 'warning' : 'info'}
        text={placement.text}
      />

      <Section
        title="Configuración del carrusel"
        icon="albums-outline"
        right={<StatusPill label={`${slides.length}/${MAX_SLIDES}`} />}
      >
        <ToggleRow
          label="Mostrar banners en el inicio"
          value={carousel.enabled}
          onValueChange={(value) => update({ enabled: value })}
        />

        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: colors.text }]}>
            Ancho de los banners
          </Text>
          <ChipSelector
            options={[
              { value: 'contained', label: 'Contenida' },
              { value: 'full', label: 'Ancho total' },
              { value: 'compact', label: 'Compacta' },
            ]}
            selected={carousel.layoutMode ?? 'contained'}
            onSelect={(value) => update({ layoutMode: value })}
          />
        </View>

        <ToggleRow
          label="Pasar diapositivas solas"
          hint="Rotación automática mientras navegan"
          value={carousel.autoplay}
          onValueChange={(value) => update({ autoplay: value })}
        />

        {carousel.autoplay ? (
          <View style={styles.intervals}>
            {[...new Set([...INTERVALS, carousel.intervalSeconds])]
              .filter((seconds) => Number.isFinite(seconds))
              .sort((a, b) => a - b)
              .map((seconds) => {
                const selected = carousel.intervalSeconds === seconds;
                return (
                  <Pressable
                    key={seconds}
                    onPress={() => update({ intervalSeconds: seconds })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      websiteStyles.chip,
                      {
                        borderColor: selected ? palette.primary : colors.border,
                        backgroundColor: selected
                          ? `${palette.primary}14`
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        websiteStyles.chipText,
                        { color: selected ? palette.primary : colors.text },
                      ]}
                    >
                      {seconds} s
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        ) : null}
      </Section>

      {slides.length === 0 ? (
        <StateView
          icon="images-outline"
          title="Todavía no hay banners"
          text="Creá una diapositiva con imagen, textos, velo y botón de acción para destacar tus campañas."
        />
      ) : (
        slides.map((slide, index) => (
          <View
            key={slide.id}
            style={[
              styles.slideCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setEditing({ slide, index })}
              accessibilityRole="button"
              accessibilityLabel={`Editar banner ${index + 1}`}
            >
              <SlidePreviewCard
                slide={slide}
                brandHex={brandColor}
                device="desktop"
              />
            </Pressable>
            <View style={styles.slideFooter}>
              <View style={styles.flex}>
                <Text
                  numberOfLines={1}
                  style={[styles.slideTitle, { color: colors.text }]}
                >
                  {slide.title || slide.imageAlt || `Banner ${index + 1}`}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.slideHint, { color: colors.muted }]}
                >
                  {slide.active ? 'Visible' : 'Oculto'}
                  {slide.ctaText ? ` · ${slide.ctaText}` : ''}
                </Text>
              </View>
              <Switch
                value={slide.active}
                onValueChange={(value) =>
                  setSlides(
                    slides.map((item, i) =>
                      i === index ? { ...item, active: value } : item,
                    ),
                  )
                }
                trackColor={{ false: colors.border, true: palette.primary }}
              />
            </View>
            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => setEditing({ slide, index })}
                style={styles.editLinkBtn}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={palette.primary}
                />
                <Text style={styles.editLinkText}>Editar estilo</Text>
              </Pressable>
              <ReorderRow
                disableUp={index === 0}
                disableDown={index === slides.length - 1}
                onUp={() => setSlides(moveItem(slides, index, -1))}
                onDown={() => setSlides(moveItem(slides, index, 1))}
                onDuplicate={
                  slides.length < MAX_SLIDES
                    ? () => duplicate(index)
                    : undefined
                }
                onRemove={() => remove(index)}
              />
            </View>
          </View>
        ))
      )}

      {slides.length < MAX_SLIDES ? (
        <Pressable
          onPress={() => setEditing({ slide: emptySlide(), index: null })}
          accessibilityRole="button"
          style={websiteStyles.primaryButton}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={websiteStyles.primaryText}>Agregar banner</Text>
        </Pressable>
      ) : (
        <Notice text={`Llegaste al máximo de ${MAX_SLIDES} banners.`} />
      )}

      <CarouselSlideSheet
        visible={Boolean(editing)}
        slide={editing?.slide ?? null}
        isNew={editing?.index === null}
        brandHex={brandColor}
        context={{
          businessVertical: capabilities.businessVertical,
          hasCatalog: capabilities.hasCatalog,
          hasServices: capabilities.hasServices,
          hasRepairs: capabilities.hasRepairs,
        }}
        onClose={() => setEditing(null)}
        onSave={(slide) => commitSlide(slide, editing?.index ?? null)}
      />
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: 7 },
  blockLabel: { fontSize: 13, fontWeight: '700' },
  intervals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slideCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10,
  },
  slideFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slideTitle: { fontSize: 14, fontWeight: '800' },
  slideHint: { fontSize: 12, marginTop: 2 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  editLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editLinkText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
});
