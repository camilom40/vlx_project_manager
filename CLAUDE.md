# Gestor de Proyectos Vitralux / VLX Windows

App web de gestión de proyectos para Vitralux Windows S.A.S. (Colombia) y VLX Windows Corp. (USA), fabricantes de sistemas de ventanas y puertas de aluminio. **Una sola fábrica** (Palmira, Colombia); VLX es solo la cara comercial de exportación — no modelar dos plantas.

**Spec completo (fuente de verdad funcional):** [spec_gestor_proyectos_vitralux.md](./spec_gestor_proyectos_vitralux.md) — leerlo al iniciar sesión nueva.
**Brand book (fuente de verdad visual):** `./VITRALUX_BRAND BOOK.pdf` — si hay conflicto visual con el spec, gana el brand book.

## Reglas no negociables
- **Interfaz 100% en español.** Ninguna cadena en inglés visible al usuario (menús, botones, validaciones, correos, WhatsApp, tooltips, placeholders, estados vacíos). Código interno en inglés está bien. Moneda/fechas localizadas (COP / USD).
- **Stack:** Next.js + React + TS (`frontend/`) · Node + Express + TS (`backend/`, API separada) · PostgreSQL + Prisma · deploy en Railway (base de datos separada del cotizador existente).
- **Estilo liquid glass tipo Apple** en elementos de marco (sidebars, headers, cards KPI); superficies sólidas y legibles en zonas de data densa (tablas, listas, bitácoras). Dark mode nativo.
- **Credenciales solo por variables de entorno.** Nunca commitear `.env`; mantener `.env.example` actualizado.
- **Trabajo por fases (spec §9):** al terminar cada fase, detenerse y esperar visto bueno del usuario. Commit + push al cierre de cada fase que funcione (`Fase N: <resumen>`). Repo: https://github.com/camilom40/vlx_project_manager.git

## Identidad visual (extraída del brand book)
- **Colores:** azul principal `#4677BA` · azul oscuro `#32386D` · naranja acento `#F29714` (el PDF lista HEX `#DC9129` pero su RGB 242,151,20 y el swatch corresponden a `#F29714`; usar `#DC9129` como variante oscura del acento) · azul claro `#D3E9FB` · blanco `#FFFFFF`.
- **Tipografía (decisión del usuario, 2026-07-03):** NO usar las fuentes del brand book (Galano Grotesque / Gotham). Usar tipografía moderna estilo Apple/macOS: **Geist Sans** (UI) y **Geist Mono** (datos numéricos/tabulares), ya integradas vía `next/font`.
- **Logo:** isologo indivisible (texto + marco), con área de reserva; prohibido: sombras, contornos, distorsión, colores fuera de paleta. Tono de marca: elegante, fuerte, confiable, moderna.

## Estructura
- `frontend/` — Next.js (App Router, TS, Tailwind). Dev: `npm run dev` (puerto 3000).
- `backend/` — Express + TS + Prisma (`prisma/schema.prisma`). Dev: `npm run dev` (puerto 4000, health check en `/health`).

## Base de datos local (desarrollo)
PostgreSQL 17 **portable** en `C:\Users\Camilo Mejia\pgsql17` (la instalación con winget falló por UAC). No es servicio de Windows: si `localhost:5432` no responde, arrancarlo con `pg_ctl.exe -D ...\pgsql17\data start` (comando completo en el README). Base: `vitralux_pm`, usuario `postgres`.

## Decisiones de modelado (Fase 1)
- Prisma 7: generador `prisma-client` emite a `src/generated/prisma`; el cliente exige driver adapter → usar siempre el singleton `backend/src/lib/prisma.ts` (`@prisma/adapter-pg`).
- Instaladores SON `User` (reciben WhatsApp); se agrupan vía `InstallerGroupMember`. Proyecto ↔ grupo de instaladores es muchos-a-muchos (`ProjectInstallerGroup`) con historial.
- Permisos: `TeamPermission` (base por equipo) + `UserPermission` (override individual que gana), por `AppModule` con `canView`/`canEdit`.
- `ProjectStageHistory` registra toda transición de etapa (incluye retrocesos con motivo).
- `despiece` (DT) y detalle de vanos (ActaVanos) son `Json` en v1.
- Timestamps de analítica en `Quote` (assignedAt/completedAt/sentAt/clientRespondedAt) alimentan el CRM.
- Enums en español-mayúsculas (p. ej. `EN_REVISION`); la UI los traduce a etiquetas legibles.

## Estado de fases
- [x] Fase 0 — Setup, estructura, git conectado al remoto.
- [x] Fase 1 — Schema de Prisma completo (31 tablas), migración `init` aplicada, smoke test de conexión OK.
- [ ] Fase 2 — Auth (bcrypt + JWT), usuarios, equipos, permisos granulares por usuario, reset de contraseña por Gerencia.
- [ ] Fase 3 — Núcleo de proyectos: 5 etapas con retrocesos, adicionales (`parentProjectId`), asignación de equipo por proyecto.
- [ ] Fase 4 — Módulos por etapa: cotización + mini-CRM · contrato/pólizas/anticipo · producción (acta de vanos → DTs → remisión) · instalación/actas · garantías.
- [ ] Fase 5 — Transversales: notificaciones correo + WhatsApp ("pasar el balón"), errores/retrabajos, carga de trabajo, dependencias, Gantt, audit trail, templates.
- [ ] Fase 6 — Dashboards (gerencial, CRM, garantías) + identidad visual + verificación de español 100%.
