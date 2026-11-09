# Onboarding: siguiente y guardado final

Solicitud: recorrer configuración hasta el final, confirmar guardado solo al terminar e integrar Rubro y herramientas.
- Dos consumidores: OnboardingClient (legacy/revisita) y SharedOnboardingWizard (progreso inicial compartido).
- Mantener pasos también en revisitas; añadir resumen final y estado de éxito únicamente tras respuesta correcta.
- En compartido, Siguiente modifica borrador local; guardar los tres pasos con revisión y completar solo al confirmar el resumen. Se conservan contratos y revisiones de APIs/RPC. Un fallo parcial no marca completado y conserva borrador/revisión para reintento.
- Elegir herramientas permitidas por el plan en legacy; preservar selección actual, validar entitlement y dependencias en cliente/servidor antes de escribir.
- No cambiar migraciones, permisos, planes, producción ni aplicar datos reales. Verificar con mocks, tipos/lint y navegador local aislado.

Completado: 155 pruebas, TypeScript y revisión visual con API simulada. Las pruebas de navegador comprobaron cero escrituras antes de la confirmación final. Ver docs/audits/2026-11-08-onboarding-finish.md.
