"use client";
import { usePredictivePrefetch } from "@/hooks/usePredictivePrefetch";

export function PredictivePrefetchInit() {
  usePredictivePrefetch();
  return null;
}