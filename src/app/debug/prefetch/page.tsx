"use client";
import React from "react";
import { PrefetchMetricsPanel } from "@/components/monitoring/PrefetchMetricsPanel";

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug: Prefetch Predictivo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Panel para visualizar patrones de navegación y eventos de prefetch.
      </p>
      <PrefetchMetricsPanel />
    </div>
  );
}