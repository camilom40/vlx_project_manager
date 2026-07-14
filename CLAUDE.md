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

## Contexto de diseño (impeccable)
Kit impeccable instalado en `.claude/skills/impeccable`. **Leer [PRODUCT.md](./PRODUCT.md) (estrategia: usuarios, personalidad, anti-referencias, principios) y [DESIGN.md](./DESIGN.md) (tokens, componentes, layout, motion) antes de cualquier trabajo de UI.** Modo live preconfigurado en `.impeccable/live/config.json`.

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

## Convenciones estructurales (post-entrega, 2026-07-15)
- **Responsabilidad "el balón en tu cancha"**: ÚNICA fuente en `backend/src/lib/responsabilidad.ts` (`cotizacionRequiereAccion`, `puedeAsignarCotizaciones`). La consumen el contador `/api/pendientes`, el flag `requiereAccion` que devuelve `GET /api/quotes` (el frontend NO re-implementa la regla) y los permisos de asignación. Si cambia una responsabilidad del flujo, se cambia solo ahí.
- **Pruebas de integración**: `cd backend && npm test` (vitest + supertest contra la app real en `src/app.ts`, separada de `index.ts`). Crean sus propios usuarios/datos con prefijo [TEST] y se limpian solos. Ampliar la suite al agregar flujos.
- **Fechas solo-día** (inputs `type="date"`): parsearlas SIEMPRE con `parseFecha()` de `backend/src/lib/fechas.ts` (mediodía UTC, evita el corrimiento de un día en UTC-5).
- **Equipos del sistema** (Gerencia, Presupuesto, Contabilidad, Tesorería, Planeación): el código depende de sus nombres; el endpoint de renombrar los bloquea (`EQUIPOS_DEL_SISTEMA` en `routes/teams.ts`).
- **Notificaciones**: `notify(..., projectId?, quoteId?)` — pasar el `quoteId` en eventos de cotización para que la bandeja muestre "Ver cotización".
- **Máquina de estados de cotización**: los endpoints validan el estado de origen (aprobar solo desde EN_REVISION, responder solo desde ENVIADA/SIN_RESPUESTA, completar solo desde BORRADOR/CAMBIOS_SOLICITADOS que además limpia aprobaciones anteriores).

## Estado de fases
- [x] Fase 0 — Setup, estructura, git conectado al remoto.
- [x] Fase 1 — Schema de Prisma completo (31 tablas), migración `init` aplicada, smoke test de conexión OK.
- [x] Fase 2 — Auth (bcryptjs + JWT en localStorage), usuarios, equipos, permisos granulares (TeamPermission base + UserPermission override; Gerencia acceso total implícito), reset con contraseña temporal + cambio forzado. Seed: equipos del spec + admin `gerencia@vitralux.co`. UI: login, cambiar-password, layout con sidebar filtrada por permisos, páginas usuarios y equipos.
- [x] Fase 3 — Núcleo de proyectos: rutas `/api/projects` (CRUD, filtros, `POST /:id/etapa` con retroceso que exige motivo, `PUT /:id/equipo`) y `/api/installer-groups`. Adicionales validados (no adicional de adicional). UI: /proyectos (lista+filtros+crear), /proyectos/[id] (stepper 5 etapas, equipo, adicionales, historial, excepción sin anticipo), /grupos. Componentes compartidos en `components/ui.tsx`, formato en `lib/formato.ts`, etiquetas de todos los enums en `lib/etiquetas.ts`.
- [x] Fase 4 — Módulos por etapa completos. Backend: `quotes.ts` (aprobación dual, envío bloqueado sin aprobar, respuesta con razón de rechazo obligatoria, bitácora, `/api/quotes/analitica`), `etapa2.ts` (contrato con firma solo-Gerencia, pólizas, anticipos, compras bloqueadas sin anticipo verificado salvo excepción), `produccion.ts` (actas vanos, DTs con fecha requerida obligatoria, remisiones solo de DTs terminados, recepción con retroceso→ReworkError, `/api/produccion/cola`), `actas.ts` (corte/entrega/cierre, % facturación, cierre auto-crea garantía a 4 meses), `warranties.ts` (alertas vencida/próxima), `errors.ts` (+estadísticas por persona). Frontend: detalle de proyecto con 6 pestañas filtradas por permisos (`components/proyecto/Tab*.tsx`) y páginas globales /cotizaciones (CRM), /produccion (cola), /garantias, /errores.
- [x] Fase 5 — Transversales. `lib/notifications.ts`: notify() correo (Nodemailer) + WhatsApp (Twilio), resiliente — sin credenciales queda registrada en la app con error y no rompe nada. Disparadores conectados: cambio de etapa→asignados, cotización aprobada→cotizador+Contabilidad+Tesorería, contrato firmado→Planeación+Contabilidad (centro de costo), anticipo verificado→Presupuesto+Planeación, acta vanos→planeador, DT→jefe taller, remisión→supervisor, devolución→jefe taller (transporte) o Planeación (técnico), cierre→Tesorería, tarea asignada/desbloqueada→responsables. Rutas: /api/notifications (bandeja+leer), /api/.../tareas con dependencias bloqueantes, /api/carga, /api/audit (paginado), /api/templates (+aplicar crea tareas encadenadas). UI: /notificaciones (contador en sidebar), pestaña "Tareas y Gantt" (Gantt CSS planeado vs real), /carga, /auditoria, /plantillas.
- [x] Fase 6 — Dashboard gerencial en `/` (`/api/dashboard/gerencial`: % facturación con barras, KPIs de cuellos de botella, anticipos, garantías, errores por persona; usuarios sin permiso ven bienvenida simple). Liquid glass aplicado según la regla del spec: `.glass` (blur+saturate) SOLO en sidebar y KPI cards, data densa sobre `--surface` sólido; fondo ambiental con radiales de marca; animación de entrada suave; dark mode completo. **Isologo real extraído del PDF del brand book** → `frontend/public/logo-vitralux.png` (transparente, en sidebar y login; en dark mode se invierte). Verificado: 0 cadenas en inglés visibles (solo atributos técnicos type=submit/password). README con guía de despliegue Railway.

## Proyecto COMPLETO (2026-07-03)
Las 6 fases construidas y verificadas contra el checklist de la sección 8 del spec. Pendiente del usuario: desplegar en Railway (guía en README) y configurar SMTP/Twilio para envíos reales.

## Post-entrega
- **Cotizaciones independientes del proyecto** (petición del usuario, 2026-07-14): la cotización nace ANTES del proyecto (no toda cotización se vuelve proyecto). `Quote` es entidad propia: `title`, `description`, cliente propio (`clientId`+`clientName`), `market/company/currency`, `receivedAt`, `amount/marginPercent` nullable; estado inicial `INGRESADA`; `projectId String? @unique` = proyecto GENERADO (1-a-1, SetNull). `User.isTeamLead`: solo líderes de Presupuesto (o Gerencia) asignan (`POST /api/quotes/:id/asignar`); no-líderes solo trabajan las suyas (`canManageQuote`). Aceptada → `POST /api/quotes/:id/generar-proyecto` crea el proyecto pre-llenado en etapa CONTRATO. **`ProjectStage.COTIZACION` eliminado**: stepper de 4 etapas (Contrato→Producción→Instalación→Garantías), proyectos nacen en CONTRATO (creación manual sigue existiendo). UI: /cotizaciones con pestañas Tablero (bandeja "Por asignar" + tabla) y CRM/analítica (+tiempos de asignación y ciclo); detalle /cotizaciones/[id] (línea de tiempo, acciones, bitácora, generar proyecto); TabCotizaciones del proyecto eliminado → fila "Cotización de origen" en Resumen; checkbox "Líder de equipo" en /usuarios; `SelectorCliente` compartido (proyecto/cotización). Endpoint `GET /api/quotes/asignables` (miembros de Presupuesto, sin exigir permiso USUARIOS). Migración `cotizaciones_independientes` con backfill desde proyectos.
- Módulo de **Clientes** (petición del usuario, 2026-07-03): modelo `Client` (nombre único, contacto, correo, teléfono, NIT, dirección, ciudad, notas, activo), `Project.clientId` FK opcional + `clientName` denormalizado que se sincroniza al renombrar. `AppModule.CLIENTES` (migración `clients`). GET /api/clients permite ver con permiso CLIENTES o PROYECTOS; mutaciones exigen CLIENTES editar (seed: Presupuesto editar, Contabilidad ver). UI: página /clientes (CRUD + búsqueda + activar/desactivar) y selector obligatorio en crear proyecto con "+ Crear cliente nuevo" inline; los adicionales heredan el cliente del padre automáticamente.
