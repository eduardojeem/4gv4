"use client";
import { useEffect, useMemo, useState } from "react";
import { PriorityConfig, RepairOrder } from "@/types/repairs";
import { calculatePriorityScore, defaultPriorityConfig, sortRepairsByPriority } from "@/services/repair-priority";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface Props {
  sampleRepairs: RepairOrder[];
  initialConfig?: PriorityConfig;
  onSave?: (config: PriorityConfig) => void;
}

export function PrioritizationSettings({ sampleRepairs, initialConfig, onSave }: Props) {
  const [config, setConfig] = useState<PriorityConfig>(initialConfig ?? defaultPriorityConfig);
  const [ruleName, setRuleName] = useState("");
  const [ruleStage, setRuleStage] = useState<string>("");
  const [ruleIssue, setRuleIssue] = useState("");
  const [ruleBonus, setRuleBonus] = useState(0);

  useEffect(() => {
    // persist simple
    try {
      localStorage.setItem("priorityConfig", JSON.stringify(config));
    } catch {}
  }, [config]);

  const preview = useMemo(() => {
    const list = sortRepairsByPriority(sampleRepairs, config);
    return list.map((r) => ({ id: r.id, score: Number(calculatePriorityScore(r, config).toFixed(3)), title: `${r.deviceModel} • ${r.issueDescription}` }));
  }, [sampleRepairs, config]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="text-lg font-semibold">Pesos de factores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <WeightControl label="Urgencia" value={config.weights.urgencyWeight} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, urgencyWeight: v } })} />
          <WeightControl label="Tiempo de espera" value={config.weights.waitTimeWeight} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, waitTimeWeight: v } })} />
          <WeightControl label="Valor histórico" value={config.weights.historicalValueWeight} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, historicalValueWeight: v } })} />
          <WeightControl label="Complejidad técnica" value={config.weights.technicalComplexityWeight} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, technicalComplexityWeight: v } })} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold">Reglas condicionales</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 items-end">
          <div>
            <label className="text-sm">Nombre</label>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Regla #1" />
          </div>
          <div>
            <label className="text-sm">Etapa</label>
            <Input value={ruleStage} onChange={(e) => setRuleStage(e.target.value)} placeholder="diagnosis, in_repair..." />
          </div>
          <div>
            <label className="text-sm">Incluye en fallo</label>
            <Input value={ruleIssue} onChange={(e) => setRuleIssue(e.target.value)} placeholder="pantalla, batería..." />
          </div>
          <div>
            <label className="text-sm">Bonus</label>
            <Input type="number" value={ruleBonus} onChange={(e) => setRuleBonus(Number(e.target.value))} />
          </div>
          <Button
            onClick={() => {
              const id = `${Date.now()}`;
              const newRule = { id, name: ruleName || `Regla ${id}`, condition: { stage: ruleStage as any, issueIncludes: ruleIssue }, effect: { priorityBonus: ruleBonus } };
              setConfig({ ...config, rules: [...config.rules, newRule] });
              setRuleName("");
              setRuleStage("");
              setRuleIssue("");
              setRuleBonus(0);
            }}
          >
            Añadir regla
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {config.rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between border rounded p-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">{JSON.stringify(r.condition)} → bonus {r.effect.priorityBonus ?? 0}</div>
              </div>
              <Button variant="outline" onClick={() => setConfig({ ...config, rules: config.rules.filter((x) => x.id !== r.id) })}>Eliminar</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold">Previsualización</h3>
        <div className="mt-4 space-y-2">
          {preview.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded p-2">
              <div>{p.title}</div>
              <div className="text-sm font-mono">score {p.score}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => onSave?.(config)}>Guardar configuración</Button>
          <Button variant="outline" onClick={() => setConfig(defaultPriorityConfig)}>Restablecer</Button>
        </div>
      </Card>
    </div>
  );
}

function WeightControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono text-sm">{value.toFixed(2)}</span>
      </div>
      <Slider defaultValue={[value]} min={0} max={1} step={0.05} onValueChange={(vals) => onChange(vals[0])} />
    </div>
  );
}