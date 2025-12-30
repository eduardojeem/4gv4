"use client";
import React from "react";

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="skip-link"
      aria-label="Saltar al contenido principal"
    >
      Saltar al contenido
    </a>
  );
}