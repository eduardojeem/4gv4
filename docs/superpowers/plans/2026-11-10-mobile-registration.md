# Registro móvil de compradores y empresas

Alcance aprobado: implementar las recomendaciones de la auditoría. Mantener los cambios previos de Claude y /admin. Sin producción, migraciones, push ni deploy.

- Entrada /join: comprar o reservar frente a registrar una empresa. El registro comercial mantiene /register y sus enlaces de planes.
- Compradores: formulario nativo con validaciones y API pública existente; confirmación por email y login general. Ninguna membresía o permiso de personal se crea al ingresar.
- Login: admitir clientes activos verificados por perfiles/roles de la base, conservando rechazo de suspendidos, roles inconsistentes y personal sin membresía. Mantener límites compartidos, revocación y MFA.
- Empresas: requisitos públicos de contraseña y disponibilidad de registro, reintento de planes sin perder datos, bloqueo de campos durante envío.
- Captcha: conservar safeAppReturnUrl; informar la incompatibilidad de Expo Go con un servidor productivo antes de abrir el navegador. El registro completo con servidor publicado necesita build propia. No abrir retornos exp arbitrarios en producción.
- Verificar regresiones existentes, pruebas de acceso y validación, TypeScript y ESLint en raíz y móvil. La prueba física queda separada; no crear cuentas reales como prueba.