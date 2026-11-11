import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  StatusPill,
  WebsiteScreen,
  useUnsavedChangesGuard,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import {
  saveCompanyInfo,
  saveWebsiteSettings,
  storeUrl,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  brandHex,
  heroIssues,
  isDirty,
  mergeSetting,
  type CompanyInfo,
  type HeroContent,
  type WebsiteSettings,
} from '@/lib/website-model';

/**
 * La tienda arma su título con el nombre del comercio y su descripción con el
 * subtítulo de la portada. Acá se editan ambos con vista previa real en Google y WhatsApp.
 */
export default function SeoScreen() {
  return (
    <WebsiteGate title="SEO y vista en Google">
      {(settings) => <SeoEditor settings={settings} />}
    </WebsiteGate>
  );
}

function SeoEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const [name, setName] = useState<string | undefined>(undefined);
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const company = useMemo(
    () => mergeSetting<CompanyInfo>(settings.company_info, { name }),
    [settings.company_info, name],
  );
  const hero = useMemo(
    () => mergeSetting<HeroContent>(settings.hero_content ?? {}, { subtitle }),
    [settings.hero_content, subtitle],
  );
  const companyDirty = isDirty(settings.company_info, company);
  const heroDirty = isDirty(settings.hero_content ?? {}, hero);
  const dirty = companyDirty || heroDirty;
  const title = company.name?.trim() || 'Tu tienda';
  const description =
    hero.subtitle?.trim() || `Conocé ${title} y lo que ofrece.`;
  const nameIssue =
    !company.name || company.name.trim().length < 2
      ? 'El nombre debe tener al menos 2 caracteres.'
      : undefined;
  const subtitleIssue = heroIssues(hero).subtitle;
  const accent = brandHex(company);

  const save = useCallback(async () => {
    if (nameIssue || subtitleIssue) {
      Alert.alert(
        'Revisá los datos',
        [nameIssue, subtitleIssue].filter(Boolean).join('\n'),
      );
      return false;
    }
    setSaving(true);
    try {
      if (heroDirty) {
        const persisted = await saveWebsiteSettings({ hero_content: hero });
        applySaved(persisted as Partial<WebsiteSettings>);
        setSubtitle((current) => (current === subtitle ? undefined : current));
      }
      if (companyDirty) {
        const result = await saveCompanyInfo(settings.company_info, { name });
        applySaved({ company_info: result ?? company });
        setName((current) => (current === name ? undefined : current));
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    nameIssue,
    subtitleIssue,
    heroDirty,
    hero,
    subtitle,
    companyDirty,
    settings.company_info,
    name,
    company,
    applySaved,
  ]);

  useUnsavedChangesGuard(dirty, save, saving);

  const url = storeUrl(company) ?? 'https://mitiendapy.com/tu-tienda';
  const descLen = hero.subtitle?.length ?? 0;

  return (
    <WebsiteScreen
      saving={saving}
      title="SEO y vista en Google"
      subtitle="Cómo aparece en buscadores y redes"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => {
            setName(undefined);
            setSubtitle(undefined);
          }}
        />
      }
    >
      <OfflineNotice />

      {/* Google Search mobile preview */}
      <View
        style={[
          styles.google,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessible
        accessibilityLabel="Vista previa en Google"
      >
        <View style={styles.googleHeader}>
          {company.logoUrl ? (
            <Image
              source={{ uri: company.logoUrl }}
              style={styles.favicon}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.faviconFallback, { backgroundColor: accent }]}>
              <Text style={styles.faviconText}>
                {title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.siteTitle, { color: colors.text }]}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.googleUrl}>
              {url}
            </Text>
          </View>
          <StatusPill label="Google" tone="neutral" />
        </View>
        <Text
          numberOfLines={1}
          style={[styles.googleTitle, { color: '#1A0DAB' }]}
        >
          {title} {company.slogan ? `| ${company.slogan}` : ''}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.googleText, { color: colors.muted }]}
        >
          {description}
        </Text>
      </View>

      {/* WhatsApp / Social Link Preview */}
      <View
        style={[
          styles.socialCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderLeftColor: palette.success,
          },
        ]}
      >
        <View style={styles.socialHead}>
          <Ionicons name="logo-whatsapp" size={14} color={palette.success} />
          <Text style={[styles.socialBadge, { color: colors.muted }]}>
            Vista previa al compartir enlace por WhatsApp
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.socialTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.socialDesc, { color: colors.muted }]}>
          {description}
        </Text>
      </View>

      <Notice text="Es una vista aproximada: los buscadores deciden exactamente qué mostrar al indexar tu tienda." />

      <Section title="Título en buscadores" icon="text-outline">
        <Field
          label="Nombre comercial"
          value={company.name ?? ''}
          onChangeText={setName}
          maxLength={100}
          showCount
          error={nameIssue}
          help="Es el título de tu tienda en Google y al compartir el enlace."
        />
      </Section>

      <Section
        title="Descripción para Google"
        icon="document-text-outline"
        right={
          <StatusPill
            label={`${descLen}/160`}
            tone={descLen > 160 ? 'warning' : 'success'}
          />
        }
      >
        <Field
          label="Subtítulo de la portada"
          value={hero.subtitle ?? ''}
          onChangeText={setSubtitle}
          multiline
          maxLength={300}
          error={subtitleIssue}
          help="Aparece en tu portada y en los resultados de búsqueda. Ideal: 90 a 160 caracteres."
        />
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  google: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  googleHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  favicon: { width: 26, height: 26, borderRadius: 13 },
  faviconFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faviconText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  siteTitle: { fontSize: 12, fontWeight: '700' },
  googleUrl: { fontSize: 11, color: '#15803D' },
  googleTitle: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  googleText: { fontSize: 13, lineHeight: 18 },
  socialCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  socialHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialBadge: { fontSize: 11, fontWeight: '700' },
  socialTitle: { fontSize: 14, fontWeight: '800' },
  socialDesc: { fontSize: 12, lineHeight: 17 },
});
