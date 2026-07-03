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
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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
  }, [valor]);
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
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setAncho(Math.max(0, Math.min(100, pct))),
    );
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const color = {
    brand: "bg-brand",
    success: "bg-success",
    accent: "bg-accent",
    danger: "bg-danger",
  }[tono];
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
      <div
        className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out motion-reduce:transition-none`}
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
