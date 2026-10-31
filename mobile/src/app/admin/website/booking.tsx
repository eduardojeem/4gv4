import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  BOOKING_PRESETS,
  DEFAULT_BOOKING_SECTION,
  bookingIssues,
  isDirty,
  mergeSetting,
  type BookingSection,
  type WebsiteSettings,
} from '@/lib/website-model';

export default function BookingScreen() {
  return (
    <WebsiteGate title="Reservas y citas">
      {(settings) => <BookingEditor settings={settings} />}
    </WebsiteGate>
  );
}

function BookingEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = (settings.booking_section ?? DEFAULT_BOOKING_SECTION) as BookingSection;
  const [patch, setPatch] = useState<Partial<BookingSection>>({});
  const [saving, setSaving] = useState(false);

  const booking = useMemo(() => mergeSetting<BookingSection>(saved, patch), [saved, patch]);
  const dirty = isDirty(saved, booking);
  const issues = bookingIssues(booking);

  const edit = (changes: Partial<BookingSection>) => setPatch((current) => ({ ...current, ...changes }));

  const applyPreset = (preset: (typeof BOOKING_PRESETS)[number]) => {
    edit({
      badge: preset.badge,
      title: preset.title,
      subtitle: preset.subtitle,
    });
    void Haptics.selectionAsync();
  };

  const save = useCallback(async () => {
    if (Object.keys(issues).length > 0) {
      Alert.alert('Revisá los datos de reserva', Object.values(issues).join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({ booking_section: booking });
      applySaved(persisted as Partial<WebsiteSettings>);
      setPatch({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, booking, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  const isEnabled = booking.enabled !== false;

  return (
    <WebsiteScreen
      title="Reservas y citas"
      subtitle="Configuración para tu tienda"
      footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />

      <Section title="Visibilidad" icon="calendar-outline" hint="Activá o desactivá la sección de citas en la portada.">
        <ToggleRow
          label="Mostrar citas en el inicio"
          hint="Permite a tus clientes agendar consultas, citas o turnos desde la web"
          value={isEnabled}
          onValueChange={(value) => edit({ enabled: value })}
        />
      </Section>

      {isEnabled ? (
        <>
          <Section title="Plantillas rápidas multirrubro" icon="sparkles-outline" hint="Tocá un rubro para autocompletar textos recomendados:">
            <View style={styles.presetsGrid}>
              {BOOKING_PRESETS.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() => applyPreset(preset)}
                  accessibilityRole="button"
                  accessibilityLabel={`Plantilla ${preset.name}`}
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Ionicons name={preset.icon} size={18} color={palette.primary} />
                  <Text style={[styles.presetText, { color: colors.text }]}>{preset.name}</Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Textos de la sección" icon="create-outline" hint="Personalizá los mensajes que verán tus visitantes.">
            <Field
              label="Etiqueta superior"
              value={booking.badge ?? ''}
              onChangeText={(val) => edit({ badge: val })}
              placeholder="Ej: Atención personalizada, Servicio técnico"
              maxLength={60}
              error={issues.badge}
              help="Aparece en un chip destacado sobre el título."
            />
            <Field
              label="Título principal"
              value={booking.title ?? ''}
              onChangeText={(val) => edit({ title: val })}
              placeholder="Ej: Agendá tu cita técnica o diagnóstico"
              maxLength={100}
              error={issues.title}
              help="Debe ser claro y conciso (mínimo 2 caracteres)."
            />
            <Field
              label="Descripción o instrucciones"
              value={booking.subtitle ?? ''}
              onChangeText={(val) => edit({ subtitle: val })}
              placeholder="Explicá cómo funciona la atención o cita..."
              multiline
              maxLength={300}
              error={issues.subtitle}
              help="Texto secundario bajo el título (máximo 300 caracteres)."
            />
          </Section>

          <Section title="Vista previa en tu tienda" icon="eye-outline" hint="Así se verá el bloque en tu página de inicio:">
            <View style={[styles.previewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {booking.badge ? (
                <View style={[styles.previewBadge, { backgroundColor: `${palette.primary}18`, borderColor: `${palette.primary}33` }]}>
                  <Text style={[styles.previewBadgeText, { color: palette.primary }]}>{booking.badge}</Text>
                </View>
              ) : null}
              <Text style={[styles.previewTitle, { color: colors.text }]}>{booking.title || 'Título de la reserva'}</Text>
              {booking.subtitle ? (
                <Text style={[styles.previewSubtitle, { color: colors.muted }]}>{booking.subtitle}</Text>
              ) : null}
              <View style={styles.previewAction}>
                <View style={[styles.previewButton, { backgroundColor: palette.primary }]}>
                  <Ionicons name="calendar-outline" size={15} color="#fff" />
                  <Text style={styles.previewButtonText}>Agendar cita</Text>
                </View>
              </View>
            </View>
          </Section>

          <Notice text="Los horarios disponibles, servicios y personal asignado se administran desde la sección Agenda de tu negocio." />
        </>
      ) : (
        <Notice text="La sección está oculta. Tu tienda no mostrará el formulario de citas en la portada." />
      )}
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  presetsGrid: {
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  previewSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewAction: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
