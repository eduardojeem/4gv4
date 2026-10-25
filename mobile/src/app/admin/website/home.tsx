import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { Field, Notice, SaveBar, Section, ToggleRow, WebsiteScreen, useUnsavedChangesGuard } from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import { saveCompanyInfo, saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  HOME_SECTIONS,
  heroIssues,
  isDirty,
  mergeSetting,
  sectionEnabled,
  type EditableSettingKey,
  type HeroContent,
  type WebsiteSettings,
} from '@/lib/website-model';

type Edits = Partial<Record<'company_info' | EditableSettingKey, Record<string, unknown>>>;

export default function HomeScreen() {
  return <WebsiteGate title="Página de inicio">{(settings) => <HomeEditor settings={settings} />}</WebsiteGate>;
}

function HomeEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);

  const edited = useMemo(() => {
    const next: WebsiteSettings = { ...settings };
    for (const [key, patch] of Object.entries(edits)) {
      next[key] = mergeSetting((settings[key] as Record<string, unknown>) ?? {}, patch ?? {});
    }
    return next;
  }, [settings, edits]);

  const changedKeys = (Object.keys(edits) as (keyof Edits)[]).filter((key) => isDirty(settings[key], edited[key]));
  const dirty = changedKeys.length > 0;
  const hero = (edited.hero_content ?? {}) as HeroContent;
  const issues = heroIssues(hero);

  const edit = (key: keyof Edits, patch: Record<string, unknown>) =>
    setEdits((current) => ({ ...current, [key]: { ...(current[key] ?? {}), ...patch } }));

  const save = useCallback(async () => {
    if (Object.keys(issues).length) {
      Alert.alert('Revisá la portada', Object.values(issues).join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const settingKeys = changedKeys.filter((key): key is EditableSettingKey => key !== 'company_info');
      if (settingKeys.length) {
        const persisted = await saveWebsiteSettings(Object.fromEntries(settingKeys.map((key) => [key, edited[key]])));
        applySaved(persisted as Partial<WebsiteSettings>);
      }
      if (changedKeys.includes('company_info')) {
        const result = await saveCompanyInfo(settings.company_info, edits.company_info ?? {});
        applySaved({ company_info: result ?? edited.company_info });
      }
      setEdits({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, changedKeys, edited, edits, settings.company_info, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  const heroOn = hero.enabled !== false;
  return (
    <WebsiteScreen title="Página de inicio" subtitle="Portada y secciones" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />
      <Section title="Portada" icon="sparkles-outline" hint="Lo primero que ven tus clientes.">
        <ToggleRow label="Mostrar portada" value={heroOn} onValueChange={(value) => edit('hero_content', { enabled: value })} />
        {heroOn ? (
          <>
            <Field label="Etiqueta" value={hero.badge ?? ''} onChangeText={(value) => edit('hero_content', { badge: value })} placeholder="Envíos a todo el país" maxLength={100} error={issues.badge} />
            <Field label="Título" value={hero.title ?? ''} onChangeText={(value) => edit('hero_content', { title: value })} placeholder="Todo lo que necesitás, en un solo lugar" maxLength={150} error={issues.title} />
            <Field label="Subtítulo" value={hero.subtitle ?? ''} onChangeText={(value) => edit('hero_content', { subtitle: value })} placeholder="Contá en una frase qué ofrecés" multiline maxLength={300} error={issues.subtitle} help="También es la descripción que muestran Google y las redes." />
            <Field label="Texto del botón principal" value={hero.ctaPrimaryText ?? ''} onChangeText={(value) => edit('hero_content', { ctaPrimaryText: value })} placeholder="Ver productos" maxLength={50} help="El botón lleva al catálogo de tu tienda." />
            <Field label="Texto del botón secundario" value={hero.ctaSecondaryText ?? ''} onChangeText={(value) => edit('hero_content', { ctaSecondaryText: value })} placeholder="Contactanos" maxLength={50} />
          </>
        ) : null}
      </Section>

      <Section title="Secciones visibles" icon="layers-outline" hint="Prendé o apagá lo que se muestra en tu inicio.">
        {HOME_SECTIONS.filter((section) => section.id !== 'hero').map((section) => (
          <ToggleRow
            key={section.id}
            label={section.label}
            hint={section.hint}
            value={sectionEnabled(edited, section)}
            onValueChange={(value) => edit(section.setting, { [section.field]: value })}
          />
        ))}
        <Text style={[styles.note, { color: colors.muted }]}>El orden de las secciones lo define el estilo de tu tienda. El contenido de beneficios, ofertas y marcas se edita desde la web.</Text>
      </Section>
      {edited.promotional_carousel?.enabled && !(edited.promotional_carousel?.slides?.length) ? (
        <Notice tone="warning" text="Prendiste los banners pero todavía no hay ninguno: agregalos en «Banners»." />
      ) : null}
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12 },
});
