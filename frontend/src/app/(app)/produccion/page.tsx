"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ESTADOS_DT, PRIORIDADES } from "@/lib/etiquetas";
import { diasDesde, fecha } from "@/lib/formato";
import { Badge, EstadoVacio, MensajeError, Tarjeta } from "@/components/ui";

interface ActaPendiente {
  id: string;
  surveyedAt: string;
  priority: string;
  requiredDeliveryNotes: string | null;
  project: { id: string; name: string; clientName: string };
  supervisor: { name: string };
}

interface DTCola {
  id: string;
  code: string | null;
  requiredDeliveryDate: string;
  status: string;
  priority: string;
  project: { id: string; name: string };
}

function tonoPrioridad(p: string): string {
  return p === "URGENTE" ? "rojo" : p === "ALTA" ? "naranja" : "gris";
}

export default function ProduccionPage() {
  const [actas, setActas] = useState<ActaPendiente[]>([]);
  const [dts, setDts] = useState<DTCola[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ actasSinDts: ActaPendiente[]; dts: DTCola[] }>(
        "/api/produccion/cola",
      );
      setActas(data.actasSinDts);
      setDts(data.dts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Cola de producción
      </h1>
      <p className="mt-1 text-sm text-muted">
        Actas de vanos esperando DTs y órdenes de producción ordenadas por
        fecha de entrega requerida.
      </p>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      <Tarjeta className="mt-4 p-5">
        <h2 className="font-semibold">
          Actas de Vanos pendientes de DTs
          {actas.length > 0 && (
            <span className="ml-2">
              <Badge tono="naranja">{actas.length}</Badge>
            </span>
          )}
        </h2>
        {actas.length === 0 ? (
          <p className="mt-3 text-sm text-success">
            No hay actas dormidas: todas tienen sus DTs generados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {actas.map((a) => {
              const dias = diasDesde(a.surveyedAt) ?? 0;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <span>
                    <Link
                      href={`/proyectos/${a.project.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {a.project.name}
                    </Link>
                    <span className="ml-2 text-muted">
                      {a.project.clientName} · levantada por{" "}
                      {a.supervisor.name} el {fecha(a.surveyedAt)}
                    </span>
                    {a.requiredDeliveryNotes && (
                      <span className="block text-xs text-accent-dark">
                        Entrega requerida: {a.requiredDeliveryNotes}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tono={tonoPrioridad(a.priority)}>
                      {PRIORIDADES[a.priority]}
                    </Badge>
                    <Badge tono={dias > 14 ? "rojo" : dias > 7 ? "naranja" : "gris"}>
                      esperando hace {dias} {dias === 1 ? "día" : "días"}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta className="mt-4 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">
            DTs activos (ordenados por fecha de entrega requerida)
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">DT</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Entrega requerida</th>
              <th className="px-4 py-3">Prioridad</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {dts.map((d) => {
              const atrasado = new Date(d.requiredDeliveryDate) < new Date();
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono font-medium">{d.code}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/proyectos/${d.project.id}`}
                      className="text-brand hover:underline"
                    >
                      {d.project.name}
                    </Link>
                  </td>
                  <td
                    className={`px-4 py-3 ${atrasado ? "font-semibold text-danger" : ""}`}
                  >
                    {fecha(d.requiredDeliveryDate)}
                    {atrasado && " · atrasado"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tono={tonoPrioridad(d.priority)}>
                      {PRIORIDADES[d.priority]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tono={d.status === "TERMINADO" ? "verde" : "azul"}>
                      {ESTADOS_DT[d.status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {dts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8">
                  <EstadoVacio>No hay DTs activos en producción.</EstadoVacio>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
