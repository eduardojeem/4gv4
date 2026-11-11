import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import {
  Field,
  Notice,
  ReorderRow,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
} from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  DEFAULT_GALLERY_SECTION,
  MAX_GALLERY_IMAGES,
  galleryIssues,
  isDirty,
  moveItem,
  newSlideId,
  type GalleryImage,
  type GallerySectionSettings,
  type WebsiteSettings,
} from '@/lib/website-model';

export default function GalleryScreen() {
  return (
    <WebsiteGate title="Galería de trabajos">
      {(settings) => <GalleryEditor settings={settings} />}
    </WebsiteGate>
  );
}

function GalleryEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, availability, mediaQuota } = useWebsite();

  const saved = useMemo<GallerySectionSettings>(
    () => ({
      ...DEFAULT_GALLERY_SECTION,
      ...(settings.gallery_section ?? {}),
      images: settings.gallery_section?.images ?? [],
    }),
    [settings.gallery_section],
  );
  const [gallery, setGallery] = useState<GallerySectionSettings>(saved);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(saved, gallery);
  const issues = galleryIssues(gallery);
  const remaining = Math.max(0, MAX_GALLERY_IMAGES - gallery.images.length);

  const setImages = (
    updater: (images: GalleryImage[]) => GalleryImage[],
  ) => {
    setGallery((prev) => ({ ...prev, images: updater(prev.images) }));
  };

  const appendPhoto = (url: string) => {
    if (gallery.images.length >= MAX_GALLERY_IMAGES) {
      Alert.alert(
        'Galería completa',
        `Podés mostrar hasta ${MAX_GALLERY_IMAGES} fotos en tu galería.`,
      );
      return;
    }
    setImages((prev) => [
      ...prev,
      { id: newSlideId(), url, caption: '' },
    ]);
    void Haptics.selectionAsync();
  };

  const save = useCallback(async () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá la galería', msgs.join('\n'));
      return false;
    }
    const cleanPayload: GallerySectionSettings = {
      enabled: gallery.enabled,
      title: gallery.title.trim().slice(0, 80) || DEFAULT_GALLERY_SECTION.title,
      subtitle: gallery.subtitle.trim().slice(0, 200),
      images: gallery.images.slice(0, MAX_GALLERY_IMAGES).map((img) => ({
        ...img,
        caption: img.caption?.trim().slice(0, 80) ?? '',
      })),
    };
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({
        gallery_section: cleanPayload,
      });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.gallery_section) {
        setGallery(persisted.gallery_section as GallerySectionSettings);
      } else {
        setGallery(cleanPayload);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(error, 'No pudimos guardar la galería de fotos.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, gallery, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  return (
    <WebsiteScreen
      saving={saving}
      title="Galería de trabajos"
      subtitle={`${gallery.images.length} de ${MAX_GALLERY_IMAGES} fotos`}
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setGallery(saved)}
        />
      }
    >
      <OfflineNotice />

      {!availability.gallery.available ? (
        <Notice
          tone="warning"
          text={`Esta sección requiere ${availability.gallery.requires} para mostrarse en el sitio público.`}
        />
      ) : null}

      {/* Vista previa de la galería en el inicio */}
      <View
        style={[
          styles.previewBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.previewHead}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.previewTitle, { color: colors.text }]}>
              {gallery.title || DEFAULT_GALLERY_SECTION.title}
            </Text>
            {gallery.subtitle ? (
              <Text
                numberOfLines={2}
                style={[styles.previewSub, { color: colors.muted }]}
              >
                {gallery.subtitle}
              </Text>
            ) : null}
          </View>
          <StatusPill
            label={
              !gallery.enabled
                ? 'Oculta'
                : gallery.images.length > 0
                  ? 'Visible'
                  : 'Sin fotos'
            }
            tone={
              !gallery.enabled
                ? 'neutral'
                : gallery.images.length > 0
                  ? 'success'
                  : 'warning'
            }
          />
        </View>

        {gallery.images.length === 0 ? (
          <View
            style={[
              styles.previewEmpty,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Ionicons name="images-outline" size={24} color={colors.muted} />
            <Text style={[styles.previewEmptyText, { color: colors.muted }]}>
              Subí fotos reales de tus trabajos, cortes o entregas
            </Text>
          </View>
        ) : (
          <View style={styles.mosaic}>
            {gallery.images.slice(0, 6).map((img, i) => (
              <View key={img.id || i} style={styles.mosaicCell}>
                <Image
                  source={{ uri: img.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                {img.caption ? (
                  <View style={styles.mosaicCap}>
                    <Text numberOfLines={1} style={styles.mosaicCapText}>
                      {img.caption}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <Section
        title="Presentación de la sección"
        icon="camera-outline"
        right={<StatusPill label={`${mediaQuota.count}/${mediaQuota.limit} medios`} />}
      >
        <ToggleRow
          label="Mostrar galería en el inicio"
          hint="Muestra tus fotos reales debajo de los servicios o destacados"
          value={gallery.enabled}
          onValueChange={(enabled) => setGallery((p) => ({ ...p, enabled }))}
        />
        <Field
          label="Título"
          value={gallery.title}
          onChangeText={(title) => setGallery((p) => ({ ...p, title }))}
          placeholder="Nuestros trabajos"
          maxLength={80}
          showCount
        />
        <Field
          label="Texto de apoyo"
          value={gallery.subtitle}
          onChangeText={(subtitle) => setGallery((p) => ({ ...p, subtitle }))}
          placeholder="Algunos de los cortes, trabajos y entregas que realizamos."
          multiline
          maxLength={200}
          showCount
        />
      </Section>

      <Section
        title={`Fotos de la galería (${gallery.images.length}/${MAX_GALLERY_IMAGES})`}
        icon="images-outline"
        hint={
          remaining > 0
            ? `Podés sumar hasta ${remaining} foto${remaining === 1 ? '' : 's'} más desde tu galería o del historial.`
            : 'Llegaste al máximo de 12 fotos en la galería.'
        }
      >
        {remaining > 0 ? (
          <WebsiteImageField
            label="Agregar foto a la galería"
            value={null}
            kind="gallery"
            slideId={`galeria-${gallery.images.length + 1}`}
            aspect="square"
            help="Las fotos verticales o cuadradas se ven mejor en el mosaico."
            onUploaded={appendPhoto}
          />
        ) : null}

        {gallery.images.map((image, idx) => (
          <View
            key={image.id || idx}
            style={[
              styles.photoCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Image
              source={{ uri: image.url }}
              style={styles.photoThumb}
              contentFit="cover"
            />
            <View style={styles.flex}>
              <Field
                label={`Foto #${idx + 1} · Texto corto (opcional)`}
                value={image.caption ?? ''}
                onChangeText={(caption) =>
                  setImages((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, caption } : item,
                    ),
                  )
                }
                placeholder="Ej: Corte fade clásico"
                maxLength={80}
                showCount
              />
              <View style={styles.photoFooter}>
                <ReorderRow
                  onUp={() => setImages((prev) => moveItem(prev, idx, -1))}
                  onDown={() => setImages((prev) => moveItem(prev, idx, 1))}
                  onRemove={() =>
                    setImages((prev) => prev.filter((_, i) => i !== idx))
                  }
                  disableUp={idx === 0}
                  disableDown={idx === gallery.images.length - 1}
                />
              </View>
            </View>
          </View>
        ))}

        <Text style={[styles.hintFooter, { color: colors.muted }]}>
          Quitar una foto de la galería no la borra de tu cupo de 20 imágenes guardadas: podés gestionarlo desde «Fotos» en el Studio.
        </Text>
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  previewBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewTitle: { fontSize: 15, fontWeight: '800' },
  previewSub: { fontSize: 12, marginTop: 2 },
  previewEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 6,
  },
  previewEmptyText: { fontSize: 12, textAlign: 'center', paddingHorizontal: 16 },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mosaicCell: {
    width: '31.5%',
    aspectRatio: 0.85,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    justifyContent: 'flex-end',
  },
  mosaicCap: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  mosaicCapText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  photoThumb: {
    width: 78,
    height: 98,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  photoFooter: { alignItems: 'flex-end', marginTop: 6 },
  hintFooter: { fontSize: 11, lineHeight: 16 },
});
