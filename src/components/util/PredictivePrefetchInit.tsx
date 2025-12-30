"use client";
import React from "react";
import { usePredictivePrefetch } from "@/hooks/usePredictivePrefetch";

export function PredictivePrefetchInit() {
  usePredictivePrefetch();
  return null;
}