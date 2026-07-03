"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

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
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONOS[tono] ?? TONOS.gris}`}
    >
      {children}
    </span>
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
      className={`rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60 ${className}`}
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
      className={`rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-brand hover:text-brand disabled:opacity-60 ${className}`}
    />
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
