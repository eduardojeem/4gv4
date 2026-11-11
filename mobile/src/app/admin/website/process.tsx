import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  ReorderRow,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import {
  saveCompanyInfo,
  saveWebsiteSettings,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  PROCESS_STEP_TEMPLATES,
  PROCESS_TEMPLATES_BY_FAMILY,
  brandHex,
  createProcessStepsFromTemplate,
  getConfiguredProcessFlows,
  guidanceFamily,
  isDirty,
  moveItem,
  newSlideId,
  processFlowIssues,
  type ProcessFlow,
  type ProcessStepTemplateId,
  type WebsiteSettings,
} from '@/lib/website-model';

const MAX_FLOWS = 6;
const MAX_STEPS = 8;

export default function ProcessScreen() {
  return (
    <WebsiteGate title="Cómo atendemos">
      {(settings) => <ProcessEditor settings={settings} />}
    </WebsiteGate>
  );
}

function ProcessEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities } = useWebsite();

  const savedFlows = useMemo(
    () =>
      getConfiguredProcessFlows(
        settings.process_flows,
        settings.process_steps,
      ),
    [settings.process_flows, settings.process_steps],
  );
  const savedEnabled = settings.company_info.processSectionEnabled !== false;

  const [flows, setFlows] = useState<ProcessFlow[]>(savedFlows);
  const [sectionEnabled, setSectionEnabled] = useState<boolean>(savedEnabled);
  const [selectedId, setSelectedId] = useState<string>(savedFlows[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const selectedFlow =
    flows.find((f) => f.id === selectedId) ?? flows[0] ?? null;
  const selectedIndex = selectedFlow
    ? flows.findIndex((f) => f.id === selectedFlow.id)
    : -1;

  const flowsDirty = isDirty(savedFlows, flows);
  const enabledDirty = sectionEnabled !== savedEnabled;
  const dirty = flowsDirty || enabledDirty;

  const family = guidanceFamily(capabilities);
  const recommendedIds =
    PROCESS_TEMPLATES_BY_FAMILY[family] ?? PROCESS_TEMPLATES_BY_FAMILY.general;
  const allowPaymentsTemplate = family === 'general' || family === 'other';
  const sortedTemplates = useMemo(() => {
    const rec = recommendedIds
      .map((id) => PROCESS_STEP_TEMPLATES.find((t) => t.id === id))
      .filter((t): t is (typeof PROCESS_STEP_TEMPLATES)[number] => Boolean(t));
    const rest = PROCESS_STEP_TEMPLATES.filter(
      (t) =>
        !recommendedIds.includes(t.id) &&
        (t.id !== 'payments' || allowPaymentsTemplate),
    );
    return { rec, rest };
  }, [recommendedIds, allowPaymentsTemplate]);

  const accent = brandHex(settings.company_info);
  const issues = processFlowIssues(flows);
  const activeFlowsCount = flows.filter((f) => f.active !== false).length;

  const updateSelectedFlow = (updater: (flow: ProcessFlow) => ProcessFlow) => {
    if (!selectedFlow) return;
    setFlows((prev) =>
      prev.map((f) => (f.id === selectedFlow.id ? updater(f) : f)),
    );
  };

  const addFlow = () => {
    if (flows.length >= MAX_FLOWS) {
      Alert.alert(
        'Límite alcanzado',
        `Podés crear hasta ${MAX_FLOWS} procesos diferentes.`,
      );
      return;
    }
    const id = newSlideId();
    const created: ProcessFlow = {
      id,
      title: `Proceso ${flows.length + 1}`,
      description: '',
      active: true,
      steps: [
        {
          id: newSlideId(),
          number: 1,
          title: 'Primer paso',
          description: 'Explicá cómo comienza la atención o compra.',
        },
      ],
    };
    setFlows((prev) => [...prev, created]);
    setSelectedId(id);
    void Haptics.selectionAsync();
  };

  const confirmDeleteFlow = () => {
    if (!selectedFlow || flows.length <= 1) return;
    Alert.alert(
      '¿Eliminar este proceso?',
      `Se quitará "${selectedFlow.title}". Guardá para confirmar en la tienda.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const next = flows.filter((f) => f.id !== selectedFlow.id);
            setFlows(next);
            setSelectedId(next[0]?.id ?? '');
          },
        },
      ],
    );
  };

  const applyTemplate = (templateId: ProcessStepTemplateId) => {
    if (!selectedFlow) return;
    const tpl = PROCESS_STEP_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const hasWrittenSteps = selectedFlow.steps.some(
      (s) => s.title.trim() || s.description.trim(),
    );
    const apply = () => {
      updateSelectedFlow((flow) => ({
        ...flow,
        title: tpl.label,
        description: tpl.description,
        steps: createProcessStepsFromTemplate(templateId),
      }));
      void Haptics.selectionAsync();
    };
    if (!hasWrittenSteps) {
      apply();
      return;
    }
    Alert.alert(
      `Aplicar plantilla «${tpl.label}»`,
      'Esto reemplazará los pasos actuales de este proceso por los de la plantilla.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aplicar', onPress: apply },
      ],
    );
  };

  const addStep = () => {
    if (!selectedFlow) return;
    if (selectedFlow.steps.length >= MAX_STEPS) {
      Alert.alert(
        'Máximo de pasos',
        `Cada proceso admite hasta ${MAX_STEPS} pasos.`,
      );
      return;
    }
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: [
        ...flow.steps,
        {
          id: newSlideId(),
          number: flow.steps.length + 1,
          title: '',
          description: '',
        },
      ],
    }));
    void Haptics.selectionAsync();
  };

  const moveStep = (index: number, delta: -1 | 1) => {
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: moveItem(flow.steps, index, delta).map((step, idx) => ({
        ...step,
        number: idx + 1,
      })),
    }));
  };

  const removeStep = (index: number) => {
    if (!selectedFlow || selectedFlow.steps.length <= 1) {
      Alert.alert('Mínimo 1 paso', 'Cada proceso necesita al menos 1 paso.');
      return;
    }
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: flow.steps
        .filter((_, i) => i !== index)
        .map((step, idx) => ({ ...step, number: idx + 1 })),
    }));
  };

  const save = useCallback(async () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá los procesos', msgs.join('\n'));
      return false;
    }
    if (sectionEnabled && activeFlowsCount === 0) {
      Alert.alert(
        'Activá al menos un proceso',
        'La sección está visible en el inicio y necesita al menos un proceso activo.',
      );
      return false;
    }

    const normalizedFlows: ProcessFlow[] = flows.map((flow) => ({
      ...flow,
      title: flow.title.trim(),
      description: flow.description?.trim() ?? '',
      active: flow.active !== false,
      steps: flow.steps.map((step, idx) => ({
        ...step,
        number: idx + 1,
        title: step.title.trim(),
        description: step.description.trim(),
      })),
    }));

    setSaving(true);
    try {
      if (flowsDirty) {
        const persisted = await saveWebsiteSettings({
          process_flows: normalizedFlows,
        });
        applySaved(persisted as Partial<WebsiteSettings>);
        if (Array.isArray(persisted.process_flows)) {
          setFlows(persisted.process_flows as ProcessFlow[]);
        } else {
          setFlows(normalizedFlows);
        }
      }
      if (enabledDirty) {
        const companyRes = await saveCompanyInfo(settings.company_info, {
          processSectionEnabled: sectionEnabled,
        });
        applySaved({
          company_info:
            companyRes ??
            ({
              ...settings.company_info,
              processSectionEnabled: sectionEnabled,
            }),
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(error, 'No pudimos guardar los procesos.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    issues,
    sectionEnabled,
    activeFlowsCount,
    flows,
    flowsDirty,
    enabledDirty,
    settings.company_info,
    applySaved,
  ]);

  useUnsavedChangesGuard(dirty, save, saving);

  return (
    <WebsiteScreen
      saving={saving}
      title="Cómo atendemos"
      subtitle={`${flows.length} recorrido${flows.length === 1 ? '' : 's'} paso a paso`}
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => {
            setFlows(savedFlows);
            setSectionEnabled(savedEnabled);
            setSelectedId(savedFlows[0]?.id ?? '');
          }}
        />
      }
    >
      <OfflineNotice />

      <Section
        title="Visibilidad y recorridos"
        icon="list-outline"
        right={<StatusPill label={`${flows.length}/${MAX_FLOWS}`} />}
      >
        <ToggleRow
          label="Mostrar sección «Cómo atendemos»"
          hint="Ayuda a tus clientes a entender cómo comprar, reservar o dejar su equipo"
          value={sectionEnabled}
          onValueChange={setSectionEnabled}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {flows.map((flow) => {
            const active = flow.id === selectedFlow?.id;
            return (
              <Pressable
                key={flow.id}
                onPress={() => setSelectedId(flow.id)}
                style={[
                  styles.flowTab,
                  {
                    borderColor: active ? palette.primary : colors.border,
                    backgroundColor: active
                      ? `${palette.primary}14`
                      : colors.background,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        flow.active !== false ? palette.success : colors.muted,
                    },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.flowTabText,
                    { color: active ? palette.primary : colors.text },
                  ]}
                >
                  {flow.title || 'Sin título'}
                </Text>
                <Text style={[styles.flowCount, { color: colors.muted }]}>
                  ({flow.steps.length})
                </Text>
              </Pressable>
            );
          })}
          {flows.length < MAX_FLOWS ? (
            <Pressable
              onPress={addFlow}
              style={[
                styles.addTabBtn,
                { borderColor: `${palette.primary}50` },
              ]}
            >
              <Ionicons name="add" size={16} color={palette.primary} />
              <Text style={styles.addTabText}>Proceso</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </Section>

      {selectedFlow ? (
        <>
          {/* Vista previa del recorrido elegido */}
          <View
            style={[
              styles.previewCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.previewHead}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {selectedFlow.title || 'Cómo atendemos'}
              </Text>
              <StatusPill
                label={selectedFlow.active !== false ? 'Visible' : 'Oculto'}
                tone={selectedFlow.active !== false ? 'success' : 'neutral'}
              />
            </View>
            {selectedFlow.description ? (
              <Text style={[styles.previewDesc, { color: colors.muted }]}>
                {selectedFlow.description}
              </Text>
            ) : null}
            <View style={styles.previewSteps}>
              {selectedFlow.steps.map((step, i) => (
                <View key={step.id || i} style={styles.previewStepRow}>
                  <View
                    style={[styles.stepCircle, { backgroundColor: accent }]}
                  >
                    <Text style={styles.stepCircleText}>{i + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text
                      numberOfLines={1}
                      style={[styles.previewStepTitle, { color: colors.text }]}
                    >
                      {step.title || `Paso ${i + 1}`}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.previewStepDesc, { color: colors.muted }]}
                    >
                      {step.description || 'Completá la explicación'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Section
            title="Plantillas sugeridas"
            icon="sparkles-outline"
            hint="Aplicá una base lista según tu rubro y ajustá los textos:"
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tplRow}
            >
              {[...sortedTemplates.rec, ...sortedTemplates.rest].map((tpl) => {
                const isRec = recommendedIds.includes(tpl.id);
                return (
                  <Pressable
                    key={tpl.id}
                    onPress={() => applyTemplate(tpl.id)}
                    style={[
                      websiteStyles.chip,
                      {
                        borderColor: isRec
                          ? `${palette.primary}60`
                          : colors.border,
                        backgroundColor: isRec
                          ? `${palette.primary}10`
                          : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        websiteStyles.chipText,
                        { color: isRec ? palette.primary : colors.text },
                      ]}
                    >
                      {isRec ? '★ ' : ''}
                      {tpl.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          <Section
            title="Editar recorrido"
            icon="create-outline"
            right={
              flows.length > 1 ? (
                <Pressable onPress={confirmDeleteFlow} hitSlop={6}>
                  <Text style={styles.deleteLink}>Eliminar</Text>
                </Pressable>
              ) : null
            }
          >
            <ToggleRow
              label="Mostrar este proceso"
              value={selectedFlow.active !== false}
              onValueChange={(active) =>
                updateSelectedFlow((f) => ({ ...f, active }))
              }
            />
            <Field
              label="Título del recorrido"
              value={selectedFlow.title}
              onChangeText={(title) =>
                updateSelectedFlow((f) => ({ ...f, title }))
              }
              placeholder="Ej: Cómo trabajamos"
              maxLength={80}
              showCount
              error={issues[`flow_${selectedIndex}_title`]}
            />
            <Field
              label="Descripción breve (opcional)"
              value={selectedFlow.description ?? ''}
              onChangeText={(description) =>
                updateSelectedFlow((f) => ({ ...f, description }))
              }
              placeholder="Ej: De la consulta a la entrega"
              maxLength={200}
            />
          </Section>

          <Section
            title={`Pasos (${selectedFlow.steps.length}/${MAX_STEPS})`}
            icon="footsteps-outline"
          >
            {selectedFlow.steps.map((step, sIdx) => (
              <View
                key={step.id || sIdx}
                style={[
                  styles.stepCard,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <View style={styles.stepTop}>
                  <View
                    style={[styles.stepBadge, { backgroundColor: `${accent}18` }]}
                  >
                    <Text style={[styles.stepBadgeText, { color: accent }]}>
                      Paso {sIdx + 1}
                    </Text>
                  </View>
                  <ReorderRow
                    onUp={() => moveStep(sIdx, -1)}
                    onDown={() => moveStep(sIdx, 1)}
                    onRemove={() => removeStep(sIdx)}
                    disableUp={sIdx === 0}
                    disableDown={sIdx === selectedFlow.steps.length - 1}
                  />
                </View>

                <Field
                  label="Título del paso"
                  value={step.title}
                  onChangeText={(title) =>
                    updateSelectedFlow((f) => ({
                      ...f,
                      steps: f.steps.map((st, idx) =>
                        idx === sIdx ? { ...st, title } : st,
                      ),
                    }))
                  }
                  placeholder="Ej: Diagnóstico"
                  maxLength={100}
                  error={issues[`flow_${selectedIndex}_step_${sIdx}_title`]}
                />

                <Field
                  label="Explicación"
                  value={step.description}
                  onChangeText={(description) =>
                    updateSelectedFlow((f) => ({
                      ...f,
                      steps: f.steps.map((st, idx) =>
                        idx === sIdx ? { ...st, description } : st,
                      ),
                    }))
                  }
                  placeholder="Contá brevemente qué pasa en este paso..."
                  multiline
                  maxLength={300}
                  error={issues[`flow_${selectedIndex}_step_${sIdx}_desc`]}
                />
              </View>
            ))}

            {selectedFlow.steps.length < MAX_STEPS ? (
              <Pressable
                onPress={addStep}
                style={[
                  websiteStyles.secondaryButton,
                  { borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={palette.primary}
                />
                <Text
                  style={[
                    websiteStyles.secondaryText,
                    { color: palette.primary },
                  ]}
                >
                  Agregar paso ({selectedFlow.steps.length}/{MAX_STEPS})
                </Text>
              </Pressable>
            ) : null}
          </Section>
        </>
      ) : null}
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabsRow: { gap: 8, paddingVertical: 2 },
  flowTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 210,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  flowTabText: { fontSize: 12, fontWeight: '800' },
  flowCount: { fontSize: 11, fontWeight: '600' },
  addTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addTabText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  previewDesc: { fontSize: 12 },
  previewSteps: { gap: 10, marginTop: 2 },
  previewStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepCircleText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  previewStepTitle: { fontSize: 13, fontWeight: '800' },
  previewStepDesc: { fontSize: 12, marginTop: 1 },
  tplRow: { gap: 8, paddingVertical: 2 },
  deleteLink: { color: palette.danger, fontSize: 13, fontWeight: '700' },
  stepCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeText: { fontSize: 12, fontWeight: '800' },
});
