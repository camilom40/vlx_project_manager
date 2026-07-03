"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ETAPAS, TIPOS_ERROR } from "@/lib/etiquetas";
import { fecha, moneda } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  Campo,
  Entrada,
  EstadoVacio,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface ErrorRegistro {
  id: string;
  type: string;
  stage: string;
  description: string;
  occurredAt: string;
  costImpact: string | null;
  delayImpactDays: number | null;
  project: { id: string; name: string };
  responsible: { id: string; name: string } | null;
  reportedBy: { name: string };
}

interface Estadisticas {
  total: number;
  porTipo: Record<string, number>;
  porPersona: {
    id: string;
    nombre: string;
    total: number;
    porTipo: Record<string, number>;
    costoTotal: number;
    diasAtrasoTotal: number;
  }[];
}

export default function ErroresPage() {
  const { puede } = useAuth();
  const [errores, setErrores] = useState<ErrorRegistro[]>([]);
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [proyectos, setProyectos] = useState<{ id: string; name: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; name: string }[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeEditar = puede("ERRORES", "editar");

  const cargar = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([
        api<{ errors: ErrorRegistro[] }>("/api/errors"),
        api<Estadisticas>("/api/errors/estadisticas"),
      ]);
      setErrores(e.errors);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!mostrarForm) return;
    api<{ projects: { id: string; name: string }[] }>("/api/projects")
      .then((d) => setProyectos(d.projects))
      .catch(() => {});
    api<{ users: { id: string; name: string; isActive: boolean }[] }>("/api/users")
      .then((d) => setUsuarios(d.users.filter((u) => u.isActive)))
      .catch(() => {});
  }, [mostrarForm]);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/errors", {
        method: "POST",
        body: JSON.stringify({
          projectId: form.get("projectId"),
          type: form.get("type"),
          stage: form.get("stage"),
          description: form.get("description"),
          responsibleId: form.get("responsibleId") || undefined,
          costImpact: form.get("costImpact") || undefined,
          delayImpactDays: form.get("delayImpactDays") || undefined,
        }),
      });
      setMostrarForm(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar.");
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Errores y retrabajos
          </h1>
          <p className="mt-1 text-sm text-muted">
            Registro de errores por persona y tipo, para identificar dónde
            capacitar.
          </p>
        </div>
        {puedeEditar && (
          <BotonPrimario onClick={() => setMostrarForm((v) => !v)}>
            Registrar error
          </BotonPrimario>
        )}
      </div>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {mostrarForm && (
        <form
          onSubmit={crear}
          className="mt-4 grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <Campo etiqueta="Proyecto">
            <Selector name="projectId" required>
              <option value="">Selecciona...</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Tipo de error">
            <Selector name="type">
              {Object.entries(TIPOS_ERROR).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Etapa donde ocurrió">
            <Selector name="stage" defaultValue="PRODUCCION">
              {Object.entries(ETAPAS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Responsable (para estadística, no para castigo)">
            <Selector name="responsibleId">
              <option value="">Sin identificar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Impacto en costo (opcional)">
            <Entrada name="costImpact" type="number" min="0" step="0.01" />
          </Campo>
          <Campo etiqueta="Días de atraso (opcional)">
            <Entrada name="delayImpactDays" type="number" min="0" />
          </Campo>
          <Campo etiqueta="Descripción" ancho="col-span-3">
            <Entrada
              name="description"
              required
              placeholder="Qué pasó, en qué torre/DT, y cómo se detectó"
            />
          </Campo>
          <div className="col-span-3">
            <BotonPrimario type="submit">Guardar</BotonPrimario>
          </div>
        </form>
      )}

      {stats && stats.total > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Tarjeta className="p-5">
            <h2 className="text-sm font-semibold">Errores por persona</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted">
                  <th className="py-2">Persona</th>
                  <th className="py-2">Errores</th>
                  <th className="py-2">Costo</th>
                  <th className="py-2">Días atraso</th>
                </tr>
              </thead>
              <tbody>
                {stats.porPersona.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{p.nombre}</td>
                    <td className="py-2">{p.total}</td>
                    <td className="py-2 font-mono text-xs">
                      {p.costoTotal ? moneda(p.costoTotal, "COP") : "—"}
                    </td>
                    <td className="py-2">{p.diasAtrasoTotal || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
          <Tarjeta className="p-5">
            <h2 className="text-sm font-semibold">Errores por tipo</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.entries(stats.porTipo)
                .sort(([, a], [, b]) => b - a)
                .map(([tipo, count]) => (
                  <li key={tipo} className="flex items-center justify-between">
                    <span>{TIPOS_ERROR[tipo] ?? tipo}</span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(120, count * 24)}px` }} />
                      <span className="font-semibold">{count}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </Tarjeta>
        </div>
      )}

      <Tarjeta className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {errores.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">
                  {fecha(e.occurredAt)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/proyectos/${e.project.id}`}
                    className="text-brand hover:underline"
                  >
                    {e.project.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tono={e.type === "DANO_TRANSPORTE" ? "naranja" : "rojo"}
                  >
                    {TIPOS_ERROR[e.type]}
                  </Badge>
                </td>
                <td className="px-4 py-3">{ETAPAS[e.stage]}</td>
                <td className="px-4 py-3">
                  {e.responsible?.name ?? "Sin identificar"}
                </td>
                <td className="px-4 py-3 text-muted">{e.description}</td>
              </tr>
            ))}
            {errores.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <EstadoVacio>
                    No hay errores registrados. Ojalá siga así.
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
