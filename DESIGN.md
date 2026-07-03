# Design

Sistema visual del Gestor de Proyectos Vitralux / VLX. Capturado del código real (`frontend/src/app/globals.css`, `frontend/src/components/ui.tsx`). Fuente de verdad de marca: `./VITRALUX_BRAND BOOK.pdf` (si hay conflicto, gana el brand book, excepto tipografía: decisión explícita del usuario de usar Geist).

## Theme

Liquid glass tipo Apple con disciplina industrial: fondo ambiental con radiales sutiles de los azules de marca (`background-attachment: fixed`), vidrio real (`.glass`: blur 22px + saturate 1.5, borde hairline, sombra suave) SOLO en sidebar y tarjetas KPI. Todas las zonas de datos densos (tablas, listas, bitácoras) usan superficie sólida `--surface`. Dark mode nativo por `prefers-color-scheme`, con el logo invertido vía filtro.

## Color Palette

Tokens CSS en `:root` (claro / oscuro):

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--brand` | `#4677BA` | `#6A99D8` | Azul principal (brand book): acciones, enlaces, activo |
| `--brand-dark` | `#32386D` | `#32386D` | Azul oscuro (brand book): títulos de marca, hover |
| `--brand-light` | `#D3E9FB` | `#1A2C47` | Azul claro (brand book): fondos suaves, hover de nav |
| `--accent` | `#F29714` | `#F29714` | Naranja (brand book, swatch RGB): alertas medias, badges de atención — uso escaso |
| `--accent-dark` | `#DC9129` | `#DC9129` | Variante oscura del acento |
| `--background` | `#EEF3F9` | `#0B1220` | Fondo (neutro tintado hacia el azul de marca) |
| `--surface` | `#FDFEFF` | `#131C2E` | Superficie sólida de datos |
| `--foreground` | `#1A2740` | `#E6EDF8` | Texto principal (nunca negro/blanco puros) |
| `--muted` | `#5E6F8A` | `#8FA1BC` | Texto secundario |
| `--border` | `#D7E1EE` | `#223350` | Bordes hairline |
| `--danger` | `#C23B3B` | — | Errores, atrasos, retrocesos |
| `--success` | `#2F9E63` | — | Estados completados, verificados |

Regla: el naranja y el rojo se reservan para lo que exige acción (atrasos, vencidas, retrocesos). Todo lo demás vive en la familia azul.

## Typography

- **Geist Sans** (`--font-geist-sans`, vía `next/font`): toda la UI. Equivalente moderno de SF Pro (decisión del usuario: NO usar las fuentes del brand book Galano/Gotham).
- **Geist Mono** (`--font-geist-mono`): cifras de dinero, códigos de DT, datos tabulares que se comparan en columna.
- Jerarquía: títulos de página `text-2xl font-semibold tracking-tight`; secciones `font-semibold`; encabezados de tabla `text-xs uppercase tracking-wide text-muted`; cuerpo `text-sm`.

## Components

Primitivas en `frontend/src/components/ui.tsx` — usar SIEMPRE estas en vez de recrear estilos:

- `BotonPrimario` (fondo brand, texto blanco) / `BotonSecundario` (borde, fantasma) — jerarquía de acciones estricta: un primario por vista.
- `Entrada`, `Selector`, `AreaTexto`, `Campo` (label + control) — foco con anillo de marca.
- `Badge` con tonos semánticos (`gris|azul|azulOscuro|verde|rojo|naranja`) + `tonoEtapa()` para las 5 etapas del proyecto.
- `Tarjeta` (superficie sólida con borde) para datos; clase `.glass` solo para marcos/KPIs.
- `MensajeError`, `EstadoVacio` — estados vacíos que enseñan qué hacer, en español.
- Etiquetas de enums centralizadas en `frontend/src/lib/etiquetas.ts`; formato de moneda/fecha/porcentaje en `frontend/src/lib/formato.ts` (es-CO / en-US según divisa).

## Layout

- App shell: sidebar fija de vidrio (240px, `sticky`, agrupada en Inicio/Operación/Administración) + `main` con `p-8` y animación de entrada (`animar-entrada`, respeta reduced motion).
- Contenido acotado por página (`max-w-4xl`–`max-w-6xl`) alineado a la izquierda.
- KPIs en grid de tarjetas glass con altura uniforme (etiqueta a 2 líneas reservadas, número anclado abajo).
- Tablas de ancho completo dentro de `Tarjeta` con encabezado `bg-background/60`.
- Formularios en grids de 2–3 columnas dentro de superficie sólida; creación inline colapsable en vez de modales.

## Motion

Una sola entrada suave por navegación (`entrada-suave`: 350ms, cubic-bezier(0.22,1,0.36,1), translateY 6px). Micro-transiciones en hover (`transition` de Tailwind, `hover:-translate-y-0.5` en KPIs). Sin bounce, sin animar propiedades de layout. `prefers-reduced-motion` desactiva la entrada.
