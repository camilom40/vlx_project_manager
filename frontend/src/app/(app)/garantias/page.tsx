"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ESTADOS_GARANTIA } from "@/lib/etiquetas";
import { fecha, moneda } from "@/lib/formato";
import {
  Badge,
  EstadoVacio,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface Garantia {
  id: string;
  retentionValue: string;
  workEndDate: string | null;
  estimatedProcessDate: string | null;
  status: string;
  alerta: "vencida" | "proxima" | null;
  responsible: { id: string; name: string } | null;
  project: {
    id: string;
    name: string;
    clientName: string;
    currency: string;
    actaCierre: { closedAt: string } | null;
  };
}

export default function GarantiasPage() {
  const { puede } = useAuth();
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const puedeEditar = puede("GARANTIAS", "editar");

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ warranties: Garantia[] }>("/api/warranties");
      setGarantias(data.warranties);
      if (puede("USUARIOS")) {
        const u = await api<{ users: { id: string; name: string; isActive: boolean }[] }>(
          "/api/users",
        ).catch(() => ({ users: [] }));
        setUsuarios(u.users.filter((x) => x.isActive));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [puede]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function actualizar(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await api(`/api/warranties/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar.");
    }
  }

  const vencidas = garantias.filter((g) => g.alerta === "vencida");
  const proximas = garantias.filter((g) => g.alerta === "proxima");
  const pendienteCobro = garantias.filter((g) => g.status !== "COBRADA");

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Gestión de garantías
      </h1>
      <p className="mt-1 text-sm text-muted">
        Retenciones por cobrar después del acta de cierre. Tesorería es
        responsable del trámite (paz y salvos + documentación).
      </p>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Tarjeta className="p-4">
          <p className="text-xs uppercase text-muted">Con fecha vencida</p>
          <p className={`mt-1 text-2xl font-semibold ${vencidas.length ? "text-danger" : ""}`}>
            {vencidas.length}
          </p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs uppercase text-muted">Próximas (30 días)</p>
          <p className={`mt-1 text-2xl font-semibold ${proximas.length ? "text-accent-dark" : ""}`}>
            {proximas.length}
          </p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs uppercase text-muted">Pendientes de cobro</p>
          <p className="mt-1 text-2xl font-semibold">{pendienteCobro.length}</p>
        </Tarjeta>
      </div>

      <Tarjeta className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Retención</th>
              <th className="px-4 py-3">Obra terminó</th>
              <th className="px-4 py-3">Trámite estimado</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {garantias.map((g) => (
              <tr
                key={g.id}
                className={`border-b border-border last:border-0 ${
                  g.alerta === "vencida" ? "bg-danger/5" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/proyectos/${g.project.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {g.project.name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {g.project.clientName}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {moneda(g.retentionValue, g.project.currency)}
                </td>
                <td className="px-4 py-3">{fecha(g.workEndDate)}</td>
                <td className="px-4 py-3">
                  {fecha(g.estimatedProcessDate)}
                  {g.alerta === "vencida" && (
                    <span className="ml-1">
                      <Badge tono="rojo">vencida</Badge>
                    </span>
                  )}
                  {g.alerta === "proxima" && (
                    <span className="ml-1">
                      <Badge tono="naranja">próxima</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {puedeEditar && usuarios.length > 0 ? (
                    <Selector
                      value={g.responsible?.id ?? ""}
                      onChange={(e) =>
                        actualizar(g.id, {
                          responsibleId: e.target.value || null,
                        })
                      }
                      className="max-w-[180px]"
                    >
                      <option value="">Sin asignar</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Selector>
                  ) : (
                    (g.responsible?.name ?? "Sin asignar")
                  )}
                </td>
                <td className="px-4 py-3">
                  {puedeEditar ? (
                    <Selector
                      value={g.status}
                      onChange={(e) =>
                        actualizar(g.id, { status: e.target.value })
                      }
                      className="max-w-[220px]"
                    >
                      {Object.entries(ESTADOS_GARANTIA).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Selector>
                  ) : (
                    <Badge tono={g.status === "COBRADA" ? "verde" : "naranja"}>
                      {ESTADOS_GARANTIA[g.status]}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
            {garantias.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <EstadoVacio>
                    No hay garantías registradas. Se crean automáticamente al
                    cerrar cada proyecto.
                  </EstadoVacio>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
