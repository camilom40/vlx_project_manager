"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ESTADOS_TAREA, ETAPAS, PRIORIDADES } from "@/lib/etiquetas";
import { fecha } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Entrada,
  EstadoVacio,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface Tarea {
  id: string;
  name: string;
  status: string;
  priority: string;
  stage: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  assignee: { id: string; name: string } | null;
  dependencies: {
    id: string;
    dependsOn: { id: string; name: string; status: string };
  }[];
}

interface Plantilla {
  id: string;
  name: string;
  description: string | null;
}

function tonoTarea(s: string): string {
  switch (s) {
    case "COMPLETADA":
      return "verde";
    case "EN_PROGRESO":
      return "azul";
    case "BLOQUEADA":
      return "rojo";
    case "CANCELADA":
      return "gris";
    default:
      return "naranja";
  }
}

export function TabTareas({
  projectId,
  puedeEditar,
}: {
  projectId: string;
  puedeEditar: boolean;
}) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; name: string }[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ tasks: Tarea[] }>(
        `/api/projects/${projectId}/tareas`,
      );
      setTareas(data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [projectId]);

  useEffect(() => {
    cargar();
    api<{ users: { id: string; name: string; isActive: boolean }[] }>("/api/users")
      .then((d) => setUsuarios(d.users.filter((u) => u.isActive)))
      .catch(() => {});
    api<{ templates: Plantilla[] }>("/api/templates")
      .then((d) => setPlantillas(d.templates))
      .catch(() => {});
  }, [cargar]);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la operación.");
    }
  }

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await accion(() =>
      api(`/api/projects/${projectId}/tareas`, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          assigneeId: form.get("assigneeId") || undefined,
          stage: form.get("stage") || undefined,
          priority: form.get("priority"),
          plannedStart: form.get("plannedStart") || undefined,
          plannedEnd: form.get("plannedEnd") || undefined,
          dependsOnIds: form.getAll("dependsOnIds").map(String),
        }),
      }),
    );
    setMostrarForm(false);
  }

  // Gantt simple: rango total de fechas planeadas
  const conFechas = tareas.filter((t) => t.plannedStart && t.plannedEnd);
  const minT = Math.min(
    ...conFechas.map((t) => new Date(t.plannedStart!).getTime()),
  );
  const maxT = Math.max(
    ...conFechas.map((t) => new Date(t.plannedEnd!).getTime()),
  );
  const rango = Math.max(1, maxT - minT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tareas y cronograma</h2>
        <div className="flex gap-2">
          {puedeEditar && plantillas.length > 0 && (
            <Selector
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                const id = e.target.value;
                e.target.value = "";
                accion(() =>
                  api(`/api/templates/${id}/aplicar`, {
                    method: "POST",
                    body: JSON.stringify({ projectId }),
                  }),
                );
              }}
              className="max-w-[230px]"
            >
              <option value="">Aplicar plantilla...</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Selector>
          )}
          {puedeEditar && (
            <BotonPrimario onClick={() => setMostrarForm((v) => !v)}>
              Nueva tarea
            </BotonPrimario>
          )}
        </div>
      </div>
      <MensajeError>{error}</MensajeError>

      {mostrarForm && (
        <form
          onSubmit={crear}
          className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <Campo etiqueta="Nombre de la tarea" ancho="col-span-2">
            <Entrada name="name" required placeholder="Despiece torre B" />
          </Campo>
          <Campo etiqueta="Responsable">
            <Selector name="assigneeId">
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Etapa">
            <Selector name="stage" defaultValue="">
              <option value="">Sin etapa</option>
              {Object.entries(ETAPAS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Inicio planeado">
            <Entrada name="plannedStart" type="date" />
          </Campo>
          <Campo etiqueta="Fin planeado">
            <Entrada name="plannedEnd" type="date" />
          </Campo>
          <Campo etiqueta="Prioridad">
            <Selector name="priority" defaultValue="MEDIA">
              {Object.entries(PRIORIDADES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Selector>
          </Campo>
          {tareas.length > 0 && (
            <Campo etiqueta="Depende de (no puede iniciar hasta que se completen)" ancho="col-span-2">
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {tareas.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="dependsOnIds"
                      value={t.id}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </Campo>
          )}
          <div className="col-span-3 flex gap-2">
            <BotonPrimario type="submit">Crear tarea</BotonPrimario>
            <BotonSecundario type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </BotonSecundario>
          </div>
        </form>
      )}

      {tareas.length === 0 ? (
        <EstadoVacio>
          Sin tareas. Crea la primera o aplica una plantilla de proyecto.
        </EstadoVacio>
      ) : (
        <>
          {/* Gantt planeado vs. real */}
          {conFechas.length > 0 && (
            <Tarjeta className="p-5">
              <h3 className="text-sm font-semibold">
                Línea de tiempo (planeado en azul, real en verde)
              </h3>
              <div className="mt-3 space-y-2">
                {conFechas.map((t) => {
                  const izq =
                    ((new Date(t.plannedStart!).getTime() - minT) / rango) * 100;
                  const ancho = Math.max(
                    2,
                    ((new Date(t.plannedEnd!).getTime() -
                      new Date(t.plannedStart!).getTime()) /
                      rango) *
                      100,
                  );
                  const realIzq = t.actualStart
                    ? ((new Date(t.actualStart).getTime() - minT) / rango) * 100
                    : null;
                  const realFin = t.actualEnd
                    ? new Date(t.actualEnd).getTime()
                    : Date.now();
                  const realAncho = t.actualStart
                    ? Math.max(
                        1,
                        ((Math.min(realFin, maxT) -
                          new Date(t.actualStart).getTime()) /
                          rango) *
                          100,
                      )
                    : null;
                  return (
                    <div key={t.id} className="grid grid-cols-[180px_1fr] items-center gap-3">
                      <span className="truncate text-xs" title={t.name}>
                        {t.name}
                      </span>
                      <div className="relative h-5 rounded bg-background">
                        <div
                          className="absolute top-0 h-2.5 rounded-full bg-brand/70"
                          style={{ left: `${izq}%`, width: `${ancho}%` }}
                          title={`Planeado: ${fecha(t.plannedStart)} → ${fecha(t.plannedEnd)}`}
                        />
                        {realIzq !== null && realAncho !== null && (
                          <div
                            className="absolute bottom-0 h-2.5 rounded-full bg-success/80"
                            style={{
                              left: `${Math.max(0, realIzq)}%`,
                              width: `${realAncho}%`,
                            }}
                            title={`Real: ${fecha(t.actualStart)} → ${t.actualEnd ? fecha(t.actualEnd) : "en curso"}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {fecha(new Date(minT).toISOString())} —{" "}
                {fecha(new Date(maxT).toISOString())}
              </p>
            </Tarjeta>
          )}

          {/* Lista de tareas */}
          <Tarjeta className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Tarea</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Dependencias</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tareas.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{t.name}</span>
                      {t.stage && (
                        <span className="block text-xs text-muted">
                          {ETAPAS[t.stage]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.assignee?.name ?? "Sin asignar"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {fecha(t.plannedStart)} → {fecha(t.plannedEnd)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {t.dependencies.length === 0
                        ? "—"
                        : t.dependencies.map((d) => (
                            <span
                              key={d.id}
                              className={
                                d.dependsOn.status !== "COMPLETADA"
                                  ? "text-danger"
                                  : "text-success"
                              }
                            >
                              {d.dependsOn.name}{" "}
                            </span>
                          ))}
                    </td>
                    <td className="px-4 py-3">
                      {puedeEditar ? (
                        <Selector
                          value={t.status}
                          onChange={(e) =>
                            accion(() =>
                              api(`/api/tareas/${t.id}`, {
                                method: "PUT",
                                body: JSON.stringify({
                                  status: e.target.value,
                                }),
                              }),
                            )
                          }
                          className="max-w-[160px]"
                        >
                          {Object.entries(ESTADOS_TAREA).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Selector>
                      ) : (
                        <Badge tono={tonoTarea(t.status)}>
                          {ESTADOS_TAREA[t.status]}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
