# Menú lateral contraído al entrar al dashboard

**Fecha:** 2026-08-15
**Estado:** aprobado para planificación

## Objetivo

Hacer que el menú lateral principal inicie contraído cada vez que el usuario entra o actualiza el dashboard, y volver más visible y comprensible el control para expandirlo o contraerlo.

## Comportamiento

- El estado inicial siempre será contraído; no se restaurará el valor histórico de `dashboard-sidebar-collapsed` desde `localStorage`.
- En escritorio, el estado contraído conservará la barra angosta de iconos.
- En móvil, el estado contraído mantendrá el menú fuera de pantalla y sin overlay.
- Después de expandirlo, el menú conservará ese estado durante la navegación cliente dentro del dashboard.
- Una recarga completa o una nueva entrada al dashboard volverá a iniciar el menú contraído.
- El cambio no se aplicará a los layouts de administración, técnico o superadministración.

## Control visual

El botón existente seguirá dentro del encabezado del menú, pero tendrá contraste permanente mediante borde, fondo del color principal y estado de foco visible. Su etiqueta accesible y tooltip cambiarán entre **Expandir menú** y **Contraer menú**. Cuando la barra esté contraída, el control de expansión será especialmente visible y permanecerá centrado dentro del ancho disponible.

El botón móvil del encabezado conservará su función actual y su etiqueta se alineará con **Abrir menú**.

## Implementación

`DashboardLayoutProvider` iniciará `sidebarCollapsed` en `true` y eliminará la lectura y escritura persistente de esta preferencia. El estado seguirá viviendo en el provider para conservarse entre rutas cliente. `Sidebar` actualizará clases, etiquetas y tooltip del botón sin alterar la estructura de navegación ni los permisos.

## Pruebas

- El provider renderiza inicialmente el estado contraído incluso si existe un valor antiguo `false` en `localStorage`.
- El usuario puede expandir y volver a contraer el menú durante la sesión.
- Un montaje nuevo vuelve a iniciar contraído.
- El botón muestra nombre accesible y tooltip correctos para ambos estados.
- La navegación móvil continúa cerrada inicialmente y abre mediante su control existente.
