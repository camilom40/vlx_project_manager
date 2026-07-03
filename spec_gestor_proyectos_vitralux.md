# Spec — Gestor de Proyectos Vitralux / VLX Windows

> **Para:** Fable 5 (ejecución del proyecto)
> **Preparado con:** Opus (estructuración)
> **Objetivo:** Construir una aplicación web de gestión de proyectos que refleje el flujo operativo real de una empresa manufacturera de sistemas de ventanas y puertas de aluminio, con visibilidad total, notificaciones entre responsables y analítica gerencial.

---

## 0. Resumen ejecutivo

Vitralux (Colombia) y VLX Windows (USA) hoy operan sin visibilidad centralizada: las cotizaciones se pierden en el limbo, planeación se satura y deja tareas "dormidas" semanas, producción fabrica sin prioridades claras, y garantías se olvidan de cobrar. Esta app resuelve eso modelando el ciclo de vida completo de un proyecto en **5 etapas + adicionales**, con:

- Estado en vivo de cada proyecto y cada tarea.
- Notificaciones automáticas (correo + WhatsApp) cuando un responsable completa su parte y "pasa el balón".
- Un mini-CRM de seguimiento de cotizaciones.
- Permisos granulares por usuario.
- Dashboards gerenciales de facturación, anticipos, atrasos, garantías, productividad y errores.

---

## 1. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Backend | Node.js + Express + TypeScript (API separada del frontend) |
| Base de datos | PostgreSQL |
| ORM | Prisma (migraciones + esquema tipado) |
| Autenticación | bcrypt + JWT |
| Notificaciones correo | Nodemailer o SendGrid |
| Notificaciones WhatsApp | Twilio (WhatsApp Business API) |
| Hosting | Railway (frontend + backend + PostgreSQL en el mismo proyecto) |

**Contexto de despliegue:** ya existe un proyecto en Railway con un servicio PostgreSQL (con volumen persistente) y el servicio `cotizador_simplre_USA` corriendo en `vlx.vitralux.co`. Reutilizar el mismo patrón de conexión (`DATABASE_URL` por variable de entorno). Se recomienda **base de datos separada** para no mezclar datos del cotizador con los del gestor de proyectos. Dominio sugerido para esta app: `pm.vitralux.co` o `proyectos.vitralux.co`.

**Sin integraciones externas** por ahora (el sistema es independiente del software contable de la empresa).

### Skills a instalar en Fable
- **Anthropic Frontend Design** — dirección estética distintiva (liquid glass), tipografía, motion.
- **Vercel React Best Practices** — rendimiento con vistas de mucha data (listas, tablas, dashboards en vivo).
- **Vercel Composition Patterns** — arquitectura de componentes limpia y reutilizable.

**Instalación (ejecutar en la carpeta del proyecto en tu Mac, antes de empezar con Fable):**

```bash
# Requiere Node.js. El CLI "npx skills" instala y enlaza las skills en ~/.claude/skills/
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-composition-patterns

# Verificar que quedaron enlazadas en todos los agentes:
npx skills list
```

> Las skills se instalan **en tu entorno de desarrollo** (donde corre Fable/Claude Code), no dentro de esta app. Fable las lee automáticamente cuando va a escribir el código del frontend. Una vez instaladas, basta con pedirle en lenguaje natural que respete las buenas prácticas de rendimiento y el estilo (p. ej. "revisa el rendimiento React" o "aplica la dirección de diseño").

---

## 2. Estilo visual

**Dirección:** liquid glass tipo Apple (glassmorphism con blur / backdrop-filter, profundidad, transiciones suaves tipo spring). Dark mode nativo.

**Regla de aplicación (importante para usabilidad):** aplicar el efecto glass a los **elementos de marco** (sidebars, headers, cards de resumen, KPIs del dashboard) y usar **superficies más sólidas y legibles** en las zonas de **data densa** (tablas de cotizaciones, listas de DTs, bitácoras). La gente usa esta herramienta muchas horas al día leyendo números; la estética no debe sacrificar la legibilidad del texto sobre fondos translúcidos.

**Idioma — requisito obligatorio:** el programa debe estar **100% en español**. Toda la interfaz visible para el usuario —menús, botones, etiquetas de formularios, encabezados de tablas, estados, mensajes de validación, notificaciones (correo y WhatsApp), correos automáticos, tooltips, textos de error, estados vacíos y placeholders— va en español. No mezclar inglés en ninguna cadena que vea el usuario. El código interno (nombres de variables, tablas, campos de la base de datos) puede quedar en inglés según convenga a la mantenibilidad, pero **nada en inglés debe llegar a la pantalla**. Usar formato de fecha, número y moneda apropiados (COP para Colombia, USD para USA).

**Brand book — fuente de verdad visual:** el proyecto incluye un brand book en la raíz de la carpeta: `./VITRALUX_BRAND BOOK.pdf`. Léelo antes de definir la UI y úsalo como **fuente de verdad** para paleta de colores, tipografía, logotipo, iconografía y voice & tone de Vitralux/VLX. Aplica esa identidad sobre la dirección liquid glass descrita arriba. **Si hay conflicto entre el brand book y este spec en temas visuales, el brand book manda.**

---

## 3. Roles, equipos y permisos

### Equipos / departamentos
Presupuesto · Contabilidad · Producción · Planeación · Tesorería · Gerencia
(el sistema debe permitir crear equipos adicionales).

### Roles funcionales que aparecen en el flujo
- **Gerencia** (Gerente General): firma contratos, aprueba cotizaciones de alto monto/complejidad, ve todo, administra usuarios y permisos.
- **Director de presupuesto**: centraliza y asigna cotizaciones, aprueba y envía cotizaciones, revisa contratos.
- **Cotizador**: elabora cotizaciones.
- **Director/persona de planeación**: hace despieces, genera los **DTs**, investiga errores técnicos.
- **Compras**: cotiza con proveedores y compra material.
- **Jefe de taller / jefe de planta**: recibe DTs, coordina producción, genera retrocesos por daño de transporte.
- **Supervisor de obra**: contacto directo con la constructora; levanta el **Acta de Vanos**, coordina instalación, firma recepciones, firma actas.
- **Grupos de instaladores**: ejecutan instalación en obra (hay varios grupos).
- **Contabilidad**: crea centros de costo, verifica anticipos, factura contra actas de corte.
- **Tesorería**: verifica anticipos, gestiona el cobro de garantías (paz y salvos).

### Sistema de permisos
- Alta / baja de usuarios (solo Gerencia y roles autorizados).
- **Permisos granulares por usuario**: Gerencia define exactamente qué módulos/etapas puede ver cada persona. No hay datos totalmente privados por diseño; todo es configurable. Ejemplo típico: producción no ve el módulo de presupuestos.
- Agrupación por equipos para asignar permisos base por departamento, pero con override por usuario individual.
- **Gerencia puede resetear contraseñas** de cualquier usuario (generar una temporal). Mantener esto simple.

### Asignación de equipo por proyecto
Cada proyecto tiene un **equipo asignado nominal**, para trazar responsabilidad y carga de trabajo:
supervisor · cotizador · planeador · jefe de taller · **grupo de instaladores** asignado (importante: hay varios grupos y hay que saber cuál corresponde a cada obra).

---

## 4. Modelo de datos (entidades principales)

Diseñar en Prisma/PostgreSQL. Entidades núcleo (los campos son orientativos, ampliar según se necesite):

- **User**: id, nombre, email, teléfono (para WhatsApp), passwordHash, teamId, activo.
- **Team**: id, nombre.
- **Permission / UserPermission**: mapeo granular usuario ↔ módulo/etapa ↔ acción (ver/editar).
- **Project**: id, nombre, cliente/constructora, país/mercado (CO / USA), empresa comercial (Vitralux / VLX), centroDeCosto, montoContrato, %anticipo, %retenciónGarantías, etapaActual, estado, fechaInicio, parentProjectId (null si es principal; poblado si es **adicional**), tipo (principal | adicional).
- **ProjectAssignment**: projectId, userId, rol (supervisor, cotizador, planeador, jefeTaller), o grupoInstaladoresId.
- **InstallerGroup**: id, nombre, integrantes.
- **Quote (Cotización)**: id, projectId, cotizadorId, monto, margen(%), estado (borrador | en revisión | aprobada | enviada | aceptada | rechazada | cambios solicitados | sin respuesta), fechaEnvío, requiereAprobaciónGerencia (bool).
- **QuoteContactLog (Bitácora CRM)**: id, quoteId, fecha, usuarioId, canal (llamada/correo), notas.
- **QuoteRejection**: quoteId, razón (enum: muy costosos | no informaron | ubicación no aplica | competencia | otros), notaAdicional.
- **Contract**: id, projectId, estado (recibido | en revisión | rechazado con observaciones | firmado), observaciones, plazoEntrega, fechaFirma.
- **Policy (Póliza)**: id, projectId (o contractId), tipo, aseguradora, estado (requerida | solicitada | expedida | pagada | enviada al cliente), valor.
- **Advance (Anticipo)**: id, projectId, valor, estado (cuenta de cobro generada | enviado al cliente | consignado | verificado), comprobante, fechaVerificación.
- **Purchase (Compra)**: id, projectId, proveedor, %obraComprada (aluminio/vidrio/accesorios), estado, fechaCompra, fechaEntregaEsperada, fechaEntregaReal.
- **ActaVanos**: id, projectId, supervisorId, medidas/vanos, sentidoApertura, fechaLevantamiento, fechasEntregaRequeridas.
- **DT (Documento Técnico / orden de producción)**: id, projectId, actaVanosId, despiece (material, cantidades, colores de vidrio, especificaciones), fechaEntregaRequerida, estado (pendiente | en cola | en producción | terminado | despachado), prioridad.
- **Remision (Remisión / salida de fábrica)**: id, projectId, dtIds, destino, hora, estado (despachado | recibido conforme | recibido con observaciones), observaciones, firmadoPor.
- **ReworkError (Error / retrabajo)**: id, projectId, tipo (daño transporte | error de medidas | sentido de apertura | digitación | cantidades | otro), responsableId, etapa, fecha, impacto (costo/atraso), descripción.
- **ActaCorte**: id, projectId, torre/sección, valorFacturado, fecha, cruceAnticipo, retenciónAplicada.
- **ActaEntrega**: id, projectId, torre/sección, firmaCliente, firmaSupervisor, fecha.
- **ActaCierre**: id, projectId, fecha.
- **Warranty (Garantía)**: id, projectId, valorRetención, fechaTerminaciónObra, fechaTrámiteEstimada (3–6 meses después), estado (pendiente | en proceso | pazysalvos firmados | documentación enviada | cobrada), responsableId (tesorería).
- **Notification**: id, destinatarioId, canal (correo/WhatsApp), evento, projectId, leída, fecha.
- **AuditLog**: id, usuarioId, acción, entidad, entidadId, timestamp (audit trail global).
- **Task / Dependency**: para gestión de recursos, dependencias, Gantt (ver §6).

**Relación clave — adicionales:** un adicional es un `Project` con `parentProjectId` apuntando al proyecto principal y `tipo = adicional`, con su propio `centroDeCosto`. Recorre el mismo flujo y reutiliza las mismas entidades.

---

## 5. Flujo operativo por etapas

El proyecto avanza por 5 etapas, **puede devolverse** entre etapas (retrabajos), y puede generar **adicionales** en cualquier momento. Cada vez que un responsable **completa** su parte, el sistema **notifica automáticamente** al siguiente responsable (correo + WhatsApp), de forma inmediata, en todas las etapas ("el balón pasa a tu cancha").

### Etapa 1 — Cotización
1. **Entrada:** el cliente envía planos de licitación por correo. Puede llegar a Presupuesto o a Gerencia; si llega a Gerencia, se reenvía al Director de Presupuesto.
2. El **Director de Presupuesto asigna** la cotización a un cotizador según el **tipo de proyecto** y la **carga de trabajo** (normalmente al más desocupado).
3. El **cotizador** calcula precios; puede consultar con Ingeniería o con la constructora según necesite. (Plazo variable, según proyecto/constructora/premura.)
4. **Aprobación:** Director de Presupuesto **siempre**; **Gerencia también** cuando el monto o la complejidad lo ameritan.
5. **Envío al cliente:** normalmente el Director de Presupuesto (a veces el cotizador).
6. **Datos visibles en la cotización:** monto total, **margen (% sobre precio de venta)**, estado de aprobación.
7. **Seguimiento (mini-CRM):** ver §6.1.
8. **Cierre de etapa:** el cliente acepta → pasa a Etapa 2. (O rechaza / pide cambios, registrado en el CRM.)

### Etapa 2 — Contrato y formalización
1. **Entrada:** el cliente envía el contrato (normalmente llega a Gerencia, que lo reenvía a Presupuesto).
2. **Revisión** (Presupuesto o delegado del equipo): términos legales, montos, **medidas**, precios, **plazos de entrega**, **% de anticipo**, **% de retención de garantías**, **pólizas requeridas** — todo debe **coincidir con la cotización**.
3. Si hay inconsistencias → **rechaza y devuelve al cliente con observaciones** (el cliente reenvía versión corregida).
4. Si está correcto → **Gerencia firma**.
5. **Contabilidad crea el centro de costo.**
6. **Secuencia post-firma (en orden):**
   1. Identificar las pólizas que exige el contrato (varían por constructora).
   2. Tramitar pólizas: correo a la aseguradora + contrato → la aseguradora indica cuáles se necesitan y las expide → **Vitralux las paga**.
   3. Generar **cuenta de cobro** por el anticipo.
   4. Enviar al cliente: **pólizas + cuenta de cobro** para iniciar el trámite del anticipo y la legalización final.
7. **Anticipo:** el cliente consigna y envía comprobante de transferencia (correo de Gerencia / Contabilidad / Presupuesto). **Contabilidad/Tesorería verifica en el banco.** → registrar fecha y estado.
8. **Excepción:** con clientes de mucha confianza se puede iniciar el **despiece** y las cotizaciones a proveedores **antes** de que llegue el anticipo (el sistema debe permitir marcar esta excepción).
9. **Disparo a operación:** Presupuesto informa a **Planeación** → Planeación hace el **despiece** → informa a **Compras**.
10. **Compras:** cotiza con proveedores, elige la mejor opción y compra. Registrar proveedor(es), **% de obra comprada** (aluminio / vidrio / accesorios), fecha de compra y **fecha de entrega esperada vs. real**.

> **Nota:** no siempre se compra el 100% del contrato de una vez; depende de cuándo y cuánto vaya a necesitar la obra realmente.

### Etapa 3 — Producción y despacho
1. Cada obra tiene un **supervisor** asignado con contacto directo con la constructora. El estado de la obra es delicado: la constructora puede contratar todo pero iniciar por partes (p. ej. contrato de 10 torres, inician con 2).
2. **Acta de Vanos:** el supervisor toma medidas en sitio con la constructora → medidas de vanos, tamaño de ventanas, **sentido de apertura**, fecha de levantamiento y **fechas de entrega requeridas**.
3. El **Acta de Vanos → Planeación**.
4. **Planeación genera los DTs** (documentos técnicos con el despiece completo: material, cantidades, **colores de vidrio**, especificaciones), verificando con Compras si hay material suficiente.
5. **DTs → Jefe de taller.**
6. Producción fabrica; el **mismo operario revisa la calidad** (no hay departamento de calidad). Se arruma la producción cerca del área de despacho (evitar almacenar mucho en bodega).
7. **Despacho** saca lo terminado y empacado → genera **Remisión** (destino, hora).
8. En obra reciben los **instaladores** de mano del **supervisor**, que **firma** la recepción.
9. **Devoluciones (retroceso):** si algo llega mal, se anota en la remisión y se regresa a fábrica:
   - **Daño de transporte** (p. ej. rayado) → el **jefe de planta** genera el retroceso y repone (no llega a Planeación).
   - **Error técnico** (medidas, sentido de apertura contrario) → **Planeación** investiga dónde estuvo el error.

> **Puntos de dolor que este módulo debe resolver:** Planeación deja "dormir" Actas de Vanos semanas/meses sin priorización; el jefe de taller produce sin fechas claras y se pierden órdenes; los DTs no traen la fecha de entrega requerida visible. El sistema debe mostrar claramente **qué Acta está pendiente de DTs, hace cuánto espera, y su prioridad**, y cada DT con **su fecha de entrega requerida**.

### Etapa 4 — Instalación, detallado y cierre
1. **Instalación** por grupos de instaladores de Vitralux; el **supervisor coordina**. Se respetan las **fechas de instalación** acordadas en el contrato.
2. **Revisión:** supervisor y cliente revisan la instalación.
3. **Etapa de detallado:** se documentan los defectos por apartamento, se arma un **plan de correcciones** y se ejecuta. El sistema debe reflejar que una torre/obra está **"en proceso de detallado"**.
4. **Acta de Entrega** (por torre/sección): firman **cliente + supervisor**.
5. **Actas de Corte (parciales):** a medida que se completan entregas, el supervisor envía a Contabilidad → **factura** (se paga en el plazo del contrato, no de inmediato) → **se cruza el anticipo** → **se aplica retención de garantías**.
6. **Acta de Cierre (final):** cuando se termina todo el proyecto.
7. El sistema calcula **% de facturación por proyecto** (facturado vs. monto del contrato) a partir de las actas de corte.

### Etapa 5 — Gestión de garantías
1. Responsable: **Tesorería.**
2. Entre **3 y 6 meses** después de terminada la obra (varía por proyecto) se tramitan las garantías, y solo **después del Acta de Cierre**.
3. Firmar **paz y salvos** (gobierno + obra) y **enviar la documentación** para el trámite de liberación de la retención / pólizas.

> **Punto de dolor:** hoy la persona encargada "se duerme" y no lleva control de cuáles cobrar ni en qué etapa está cada una. El sistema debe tener un **dashboard de garantías** con alertas por fecha estimada de trámite y estado de cada una (pendiente | en proceso | paz y salvos firmados | documentación enviada | cobrada).

---

## 6. Módulos transversales

### 6.1 Mini-CRM de cotizaciones
Para cada cotización enviada:
- **Días en espera** (desde la fecha de envío).
- **Bitácora de contactos:** cada contacto con el cliente (fecha, quién contactó, canal, qué se habló).
- **Estado:** aceptada | rechazada | en revisión | sin respuesta | cambios solicitados.
- **Razón de rechazo (obligatoria si se rechaza):** select { muy costosos | no informaron | ubicación no aplica | competencia | otros } + nota adicional.
- **Analítica por cotizador:** cotizaciones por día, **tasa de conversión** (cotización → proyecto), **% de efectividad**, **tiempo promedio de entrega** de una cotización.
- **Vista admin:** todas las cotizaciones pendientes ordenadas por días transcurridos; tasa de rechazo agrupada por razón; tiempo promedio de respuesta del cliente; márgenes promedio.

### 6.2 Adicionales (sub-proyectos)
- Un adicional es un **sub-proyecto hijo** vinculado al proyecto principal (`parentProjectId`), con **centro de costo propio** (Contabilidad lo crea cuando se solicita, igual que un contrato).
- **Identificación:** la obra lo solicita al supervisor, o directamente a Presupuesto/Gerencia → se envía a **Presupuesto para cotizar** y enviar a la constructora.
- **Flujo:** recorre de nuevo **Cotización → aprobaciones (igual que una cotización normal) → contrato/otro sí u orden de servicio → pólizas si aplica → producción → instalación → cierre**. Normalmente no requiere garantías (salvo adicionales muy grandes).
- **Tipos frecuentes:** solo mano de obra de instaladores (poner papel polarizado, desmontar/montar una ventana), cambiar sentido de apertura, agregar ventanas, cambiar color.
- Debe mantenerse **siempre visible su vínculo** con el proyecto padre. Los adicionales tienden a "perderse en el camino" y hay muchas personas involucradas: el sistema debe darles la misma trazabilidad que a un proyecto.

### 6.3 Notificaciones
- Canales: **correo + WhatsApp**, configurables.
- Disparo: **inmediato** al completar cada etapa/tarea → notifica al **siguiente responsable**.
- Ejemplos: Presupuesto aprueba cotización → Tesorería/Contabilidad; Gerencia firma contrato → Planeación; Acta de Vanos recibida → Jefe de taller; Despacho envía material → Supervisor.

### 6.4 Módulo de errores y retrabajos
- Registrar cada error/retrabajo: **tipo** (daño transporte, error de medidas, sentido de apertura, digitación, cantidades, otro), **responsable** (supervisor al medir, planeación al digitar, producción al fabricar), **etapa**, **fecha**, **impacto** (costo/atraso).
- **Estadísticas por persona** para identificar dónde se cometen más errores y capacitar.

### 6.5 Funcionalidades de project management (best practices aprobadas)
- **Gestión de recursos y carga de trabajo:** ver visualmente quién está saturado (cotizadores, planeación, supervisores, grupos de instaladores) para redistribuir o alertar.
- **Dependencias entre tareas:** p. ej. el despiece no arranca sin Acta de Vanos; la producción no arranca sin DTs. Alertar cuando algo se bloquea.
- **Gantt / timelines:** línea de tiempo del proyecto de cotización a cierre; visualizar atrasos y holguras (planeado vs. real).
- **Audit trail:** registro de quién hizo qué y cuándo (quién aprobó, quién cambió un DT, quién marcó como entregado).
- **Templates de proyecto:** plantillas preconfiguradas (etapas, campos, roles típicos) para crear proyectos nuevos rápido.

### 6.6 Dashboards
- **Dashboard gerencial:** % de facturación por proyecto; estado de **anticipos** (recibidos / pendientes); **proyectos atrasados** con alertas visuales; **garantías pendientes** de cobrar; productividad por equipo; tasa de errores por persona; visión global de **cuellos de botella** para poder intervenir.
- **Dashboard admin / CRM:** el de §6.1.
- **Dashboard de garantías** (Tesorería): el de Etapa 5.

---

## 7. Alcance geográfico y empresas
- **Una sola fábrica:** toda la manufactura ocurre en **Vitralux Colombia (Palmira, Valle del Cauca)**, tanto para los proyectos de Colombia como para los de exportación de **VLX Windows Corp. (USA / Florida)**. VLX es la cara comercial del mercado de exportación, **no** una planta separada. No modelar dos plantas ni dos flujos de producción.
- El proyecto lleva un campo **`país` / mercado destino** (CO / USA) y, cuando aplique, la **empresa** a la que pertenece comercialmente (Vitralux / VLX). Es solo una etiqueta para reportería, facturación y trazabilidad: para la planta la producción es indiferente (solo fabrican ventanas). No requiere lógica distinta de producción por país.

---

## 8. Criterios de aceptación (checklist para Fable)

- [ ] CRUD de usuarios con **permisos granulares por usuario** y agrupación por equipos; Gerencia puede resetear contraseñas.
- [ ] Modelo de proyecto con las 5 etapas, estados por etapa y capacidad de **devolverse** entre etapas.
- [ ] **Adicionales** como sub-proyectos vinculados (`parentProjectId`) con centro de costo propio, recorriendo el flujo completo.
- [ ] **Asignación de equipo por proyecto** incluyendo grupo de instaladores.
- [ ] Cotización con **monto y margen**, aprobaciones (Presupuesto siempre / Gerencia condicional) y **mini-CRM** (bitácora, razones de rechazo, analítica por cotizador).
- [ ] Contrato con revisión, rechazo con observaciones, firma de Gerencia, **pólizas**, **cuenta de cobro/anticipo** con verificación, y **excepción** de avance sin anticipo.
- [ ] **Compras** con % de obra comprada y tracking de entregas (esperada vs. real).
- [ ] **Acta de Vanos → DTs → producción → remisión** con fechas de entrega requeridas visibles y priorización.
- [ ] **Retrocesos** por daño de transporte (jefe de planta) vs. error técnico (planeación) + **módulo de errores** con estadística por persona.
- [ ] **Actas de corte / entrega / cierre**, % de facturación por proyecto, cruce de anticipo y retención.
- [ ] **Gestión de garantías** con alertas por fecha y estados.
- [ ] **Notificaciones** correo + WhatsApp inmediatas al pasar el balón, en todas las etapas.
- [ ] **Gestión de recursos/carga, dependencias, Gantt, audit trail, templates.**
- [ ] **Dashboards** gerencial, admin/CRM y garantías.
- [ ] Estilo **liquid glass** con superficies sólidas legibles en zonas de data densa; dark mode.
- [ ] Identidad visual tomada del **brand book** (`./VITRALUX_BRAND BOOK.pdf`): colores, tipografía, logo, iconografía.
- [ ] **Interfaz 100% en español** (toda cadena visible al usuario, incluidas notificaciones y correos); formatos de fecha/número/moneda localizados (COP/USD).
- [ ] Desplegable en **Railway** (Next.js + Node/Express + PostgreSQL + Prisma), base separada del cotizador.

---

## 9. Plan de ejecución por fases (instrucciones para Fable)

**Cómo abordar este build.** No construir todo de una. Avanzar **por fases**; al terminar cada fase, **detenerse y esperar el visto bueno** del usuario antes de seguir. Antes de una fase grande, entrar en **modo plan** (`/plan`) para proponer los cambios y esperar aprobación. Cuidar el contexto: usar `/compact` o retomar en sesión nueva desde este spec y el estado del repo cuando la sesión se alargue.

**Control de versiones (Git/GitHub).** El repositorio remoto es `https://github.com/camilom40/vlx_project_manager.git`. En la Fase 0, inicializar git, conectar este remoto (`git remote add origin <url>`) y hacer el primer commit. **Al final de cada fase que funcione, Fable hace el commit y el push por su cuenta** (`git add -A`, `git commit -m "Fase N: <resumen>"`, `git push`), con mensajes claros por fase. **Crear un `.gitignore` desde el inicio** que excluya como mínimo: `.env`, `.env.local`, `node_modules/`, `.next/`, `dist/`, `build/`. **Nunca commitear el archivo `.env` ni credenciales** — solo el `.env.example` sin valores reales. (Requisito del entorno: la autenticación de git con GitHub debe estar ya configurada en la máquina del usuario; Fable usa las credenciales existentes, no crea ninguna.)

**Sobre los objetivos `/goal`.** Cada fase tiene abajo un objetivo redactado como **condición verificable** (no vaga). El usuario los teclea en la sesión, uno por fase, para que Fable trabaje hasta cumplir esa condición. No usar un solo `/goal` gigante para todo el proyecto: eso elimina los checkpoints de revisión.

**Sobre el nivel de effort.** Subir a `xhigh` (o `max`) en las fases de razonamiento pesado (modelo de datos, arquitectura de estados, debugging complejo) y usar `high` para el grueso de construcción por patrones; `medium` solo para boilerplate trivial. La disponibilidad de niveles varía por modelo/versión: confiar en lo que muestre `/effort` en la sesión.

**Persistencia recomendada.** Guardar una copia de este spec (o un resumen con enlace a él) como `CLAUDE.md` en la raíz del proyecto, para que cargue automáticamente al inicio de cada sesión y Fable no pierda el contexto entre sesiones.

| Fase | Objetivo de la fase | `/goal` sugerido (condición verificable) | Effort |
|---|---|---|---|
| **0 · Setup** | Leer este spec y el brand book. Scaffolding: Next.js + React + TS, Express + TS, Prisma, PostgreSQL local. Estructura de carpetas, `.env.example` y `.gitignore`. Inicializar git y conectar el remoto. Sin lógica todavía. | `el proyecto arranca en local (npm run dev), existe .env.example con todas las variables y un .gitignore que excluye .env y node_modules, y el repo está inicializado, conectado a github.com/camilom40/vlx_project_manager.git y con el primer commit pusheado` | high |
| **1 · Modelo de datos** | Schema de Prisma completo según la **sección 4**. Columna vertebral — revisar a fondo antes de seguir. | `el schema de Prisma cubre todas las entidades de la sección 4 con sus relaciones (incluido parentProjectId para adicionales) y "npx prisma migrate dev" corre sin errores` | **xhigh** |
| **2 · Auth y permisos** | Autenticación (bcrypt + JWT), usuarios, equipos y **permisos granulares por usuario**. Reset de contraseña por gerencia. | `un usuario puede loguearse y desloguearse, gerencia puede resetear la contraseña de otro usuario, y los permisos granulares ocultan/bloquean los módulos no autorizados (p. ej. producción no ve presupuestos)` | high |
| **3 · Núcleo de proyectos** | Modelo de proyecto con las 5 etapas, estados y transiciones; capacidad de **devolverse** entre etapas; **adicionales** vinculados; **asignación de equipo por proyecto** (incluye grupo de instaladores). | `se puede crear un proyecto, moverlo entre las 5 etapas y devolverlo, crear un adicional vinculado con su parentProjectId, y asignarle equipo (supervisor, cotizador, planeador, jefe de taller, grupo de instaladores)` | **xhigh** |
| **4 · Módulos por etapa** | Cotización + mini-CRM · contrato/pólizas/anticipo · producción (acta de vanos → DTs → remisión) · instalación/detallado/actas · garantías. Construir sub-módulo por sub-módulo. | (uno por sub-módulo, p. ej.) `una cotización se crea con monto y margen, pasa por aprobación de presupuesto (y gerencia si aplica), se envía, y el CRM registra bitácora de contactos y razón de rechazo` | high |
| **5 · Transversales** | Notificaciones (correo + WhatsApp) al pasar el balón · módulo de errores/retrabajos · gestión de carga · dependencias entre tareas · Gantt · audit trail · templates. | `al completar una etapa se dispara notificación por correo y WhatsApp al siguiente responsable, y el audit trail registra quién hizo qué y cuándo` | high |
| **6 · Dashboards y pulido** | Dashboards (gerencial, admin/CRM, garantías). Aplicar identidad del **brand book** y estilo liquid glass; verificar interfaz **100% en español**. | `los tres dashboards muestran datos reales (% de facturación, anticipos, atrasos, garantías, productividad, errores), la UI aplica el brand book y no hay ninguna cadena en inglés visible al usuario` | high (medium para boilerplate) |

**Cierre.** Al terminar la Fase 6, revisar todo contra el **checklist de la sección 8**; por cada ítem no cumplido, señalar el punto concreto a Fable en vez de repetir el spec entero.
