"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useState,
} from "react";
import { useAnimacionesActivas, usePreferenciaMovimiento } from "@/lib/movimiento";

// Primitivas de UI compartidas — consistencia visual en toda la app

const TONOS: Record<string, string> = {
  gris: "bg-muted/10 text-muted",
  azul: "bg-brand/10 text-brand",
  azulOscuro: "bg-brand-dark/10 text-brand-dark dark:text-brand",
  verde: "bg-success/10 text-success",
  rojo: "bg-danger/10 text-danger",
  naranja: "bg-accent/15 text-accent-dark",
};

export function Badge({
  tono = "gris",
  children,
}: {
  tono?: keyof typeof TONOS | string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONOS[tono] ?? TONOS.gris} ${
        tono === "rojo" ? "pulso-alerta" : ""
      }`}
    >
      {children}
    </span>
  );
}

/** Número que cuenta hasta su valor al aparecer (una sola vez). */
export function ContadorAnimado({ valor }: { valor: number }) {
  const activo = useAnimacionesActivas();
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    if (!activo) {
      setMostrado(valor);
      return;
    }
    let raf = 0;
    const inicio = performance.now();
    const duracion = 700;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const suavizado = 1 - Math.pow(1 - p, 4); // ease-out-quart
      setMostrado(Math.round(valor * suavizado));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, activo]);
  return <>{mostrado}</>;
}

/** Barra de progreso que crece hasta su porcentaje al montarse. */
export function BarraProgreso({
  pct,
  tono = "brand",
}: {
  pct: number;
  tono?: "brand" | "success" | "accent" | "danger";
}) {
  const activo = useAnimacionesActivas();
  const [ancho, setAncho] = useState(activo ? 0 : Math.max(0, Math.min(100, pct)));
  useEffect(() => {
    if (!activo) {
      setAncho(Math.max(0, Math.min(100, pct)));
      return;
    }
    const id = requestAnimationFrame(() =>
      setAncho(Math.max(0, Math.min(100, pct))),
    );
    return () => cancelAnimationFrame(id);
  }, [pct, activo]);
  const color = {
    brand: "bg-brand",
    success: "bg-success",
    accent: "bg-accent",
    danger: "bg-danger",
  }[tono];
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
      <div
        className={`h-full rounded-full ${color} ${
          activo ? "transition-[width] duration-700 ease-out" : ""
        }`}
        style={{ width: `${ancho}%` }}
      />
    </div>
  );
}

/** Panel colapsable con física de resorte (formularios de creación, etc.). */
export function Desplegable({
  abierto,
  children,
}: {
  abierto: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {abierto && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function tonoEtapa(etapa: string): string {
  switch (etapa) {
    case "COTIZACION":
      return "azul";
    case "CONTRATO":
      return "naranja";
    case "PRODUCCION":
      return "azulOscuro";
    case "INSTALACION":
      return "verde";
    case "GARANTIAS":
      return "gris";
    default:
      return "gris";
  }
}

export function BotonPrimario(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-brand-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${className}`}
    />
  );
}

export function BotonSecundario(
  props: ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 transition duration-150 hover:border-brand hover:text-brand active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${className}`}
    />
  );
}

export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`esqueleto ${className}`} />;
}

/** Esqueleto de tabla: filas fantasma mientras cargan los datos reales. */
export function EsqueletoTabla({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Esqueleto className="h-4 w-1/3" />
          <Esqueleto className="h-4 w-1/5" />
          <Esqueleto className="h-4 w-1/6" />
          <Esqueleto className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${className}`}
    />
  );
}

export function Selector(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      {...rest}
      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${className}`}
    />
  );
}

export function AreaTexto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${className}`}
    />
  );
}

export function Campo({
  etiqueta,
  children,
  ancho = "",
}: {
  etiqueta: string;
  children: React.ReactNode;
  ancho?: string;
}) {
  return (
    <div className={ancho}>
      <label className="mb-1 block text-sm font-medium">{etiqueta}</label>
      {children}
    </div>
  );
}

export function MensajeError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Tarjeta({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function EstadoVacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/**
 * Interruptor "Animaciones": fuerza las animaciones activas o inactivas
 * dentro de la app, sin importar la preferencia de movimiento reducido
 * del sistema operativo. Vive en la sidebar.
 */
export function InterruptorAnimaciones() {
  const activo = useAnimacionesActivas();
  const [, establecer] = usePreferenciaMovimiento();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => establecer(activo ? "off" : "on")}
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-medium text-muted transition duration-150 hover:text-foreground"
    >
      <span>Animaciones</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 ${
          activo ? "bg-brand" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 translate-x-1 transform rounded-full bg-white shadow transition-transform duration-150 ${
            activo ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

// ============================================================
// Íconos de acción (SVG en línea, sin librería externa) + botón
// compacto para filas de tabla (Editar, Restablecer, Activar, Eliminar).
// ============================================================

type IconoProps = { className?: string };
const ICONO_BASE = "h-4 w-4";

export function IconoEditar({ className = ICONO_BASE }: IconoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconoLlave({ className = ICONO_BASE }: IconoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 20 3" />
      <path d="M17 6l3 3" />
      <path d="M14 9l2 2" />
    </svg>
  );
}

export function IconoEncender({ className = ICONO_BASE }: IconoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v6" />
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </svg>
  );
}

export function IconoEliminar({ className = ICONO_BASE }: IconoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

const TONOS_ICONO: Record<string, string> = {
  muted: "text-muted hover:text-foreground hover:bg-background",
  brand: "text-brand hover:bg-brand/10",
  accent: "text-accent-dark hover:bg-accent/10",
  danger: "text-danger hover:bg-danger/10",
  success: "text-success hover:bg-success/10",
};

/** Botón compacto solo-ícono para acciones de fila (con tooltip via title). */
export function BotonIcono({
  etiqueta,
  tono = "muted",
  onClick,
  children,
}: {
  etiqueta: string;
  tono?: keyof typeof TONOS_ICONO;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition duration-150 active:scale-90 ${TONOS_ICONO[tono]}`}
    >
      {children}
    </button>
  );
}
