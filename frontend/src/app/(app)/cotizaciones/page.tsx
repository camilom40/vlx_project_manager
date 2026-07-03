"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ESTADOS_COTIZACION,
  RAZONES_RECHAZO,
} from "@/lib/etiquetas";
import { diasDesde, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  EstadoVacio,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";

interface Cotizacion {
  id: string;
  amount: string;
  marginPercent: string;
  status: string;
  sentAt: string | null;
  quoter: { id: string; name: string };
  project: {
    id: string;
    name: string;
    clientName: string;
    currency: string;
  };
  rejection: { reason: string } | null;
}

interface Analitica {
  cotizadores: {
    id: string;
    nombre: string;
    total: number;
    enviadas: number;
    aceptadas: number;
    rechazadas: number;
    tasaConversion: number | null;
    tiempoPromedioEntregaDias: number | null;
    margenPromedio: number | null;
  }[];
  rechazosPorRazon: Record<string, number>;
  tiempoPromedioRespuestaClienteDias: number | null;
  margenPromedioGlobal: number | null;
  totalCotizaciones: number;
}

export default function CotizacionesPage() {
  const { puede } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [analitica, setAnalitica] = useState<Analitica | null>(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : "";
      const data = await api<{ quotes: Cotizacion[] }>(
        `/api/quotes${params}`,
      );
      setCotizaciones(data.quotes);
      if (puede("CRM")) {
        const a = await api<Analitica>("/api/quotes/analitica");
        setAnalitica(a);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [filtroEstado, puede]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Pendientes de respuesta ordenadas por días transcurridos (vista admin)
  const pendientes = cotizaciones
    .filter((q) => ["ENVIADA", "SIN_RESPUESTA"].includes(q.status) && q.sentAt)
    .sort(
      (a, b) =>
        new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime(),
    );

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Cotizaciones y seguimiento (CRM)
      </h1>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {/* Analítica */}
      {analitica && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-4">
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">Total cotizaciones</p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.totalCotizaciones}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">Margen promedio</p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.margenPromedioGlobal !== null
                  ? porcentaje(analitica.margenPromedioGlobal)
                  : "—"}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">
                Respuesta del cliente (prom.)
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.tiempoPromedioRespuestaClienteDias !== null
                  ? `${analitica.tiempoPromedioRespuestaClienteDias.toFixed(1)} días`
                  : "—"}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">
                En espera de respuesta
              </p>
              <p className="mt-1 text-2xl font-semibold">{pendientes.length}</p>
            </Tarjeta>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">
                Analítica por cotizador
              </h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2">Cotizador</th>
                    <th className="py-2">Total</th>
                    <th className="py-2">Conversión</th>
                    <th className="py-2">Entrega prom.</th>
                    <th className="py-2">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {analitica.cotizadores.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium">{c.nombre}</td>
                      <td className="py-2">{c.total}</td>
                      <td className="py-2">
                        {c.tasaConversion !== null
                          ? porcentaje(c.tasaConversion * 100)
                          : "—"}
                      </td>
                      <td className="py-2">
                        {c.tiempoPromedioEntregaDias !== null
                          ? `${c.tiempoPromedioEntregaDias.toFixed(1)} d`
                          : "—"}
                      </td>
                      <td className="py-2">
                        {c.margenPromedio !== null
                          ? porcentaje(c.margenPromedio)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">Rechazos por razón</h2>
              {Object.keys(analitica.rechazosPorRazon).length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Sin rechazos registrados.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(analitica.rechazosPorRazon).map(
                    ([razon, count]) => (
                      <li key={razon} className="flex justify-between">
                        <span>{RAZONES_RECHAZO[razon] ?? razon}</span>
                        <span className="font-semibold">{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </Tarjeta>
          </div>
        </>
      )}

      {/* Pendientes ordenadas por días */}
      {pendientes.length > 0 && (
        <Tarjeta className="mt-4 p-5">
          <h2 className="text-sm font-semibold">
            Pendientes de respuesta (más antiguas primero)
          </h2>
          <ul className="mt-3 space-y-2">
            {pendientes.map((q) => {
              const dias = diasDesde(q.sentAt)!;
              return (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <span>
                    <Link
                      href={`/proyectos/${q.project.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {q.project.name}
                    </Link>
                    <span className="ml-2 text-muted">
                      {q.project.clientName}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs">
                      {moneda(q.amount, q.project.currency)}
                    </span>
                    <Badge tono={dias > 15 ? "rojo" : dias > 7 ? "naranja" : "azul"}>
                      {dias} {dias === 1 ? "día" : "días"} esperando
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      {/* Todas */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Todas las cotizaciones</h2>
        <Selector
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="max-w-[220px]"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_COTIZACION).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Selector>
      </div>
      <Tarjeta className="mt-3 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Cotizador</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Margen</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cotizaciones.map((q) => (
              <tr key={q.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/proyectos/${q.project.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {q.project.name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {q.project.clientName}
                  </span>
                </td>
                <td className="px-4 py-3">{q.quoter.name}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {moneda(q.amount, q.project.currency)}
                </td>
                <td className="px-4 py-3">{porcentaje(q.marginPercent)}</td>
                <td className="px-4 py-3">
                  <Badge
                    tono={
                      q.status === "ACEPTADA"
                        ? "verde"
                        : q.status === "RECHAZADA"
                          ? "rojo"
                          : "azul"
                    }
                  >
                    {ESTADOS_COTIZACION[q.status]}
                  </Badge>
                  {q.rejection && (
                    <span className="block text-xs text-muted">
                      {RAZONES_RECHAZO[q.rejection.reason]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {cotizaciones.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8">
                  <EstadoVacio>No hay cotizaciones registradas.</EstadoVacio>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
