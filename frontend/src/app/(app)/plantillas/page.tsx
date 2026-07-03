"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ETAPAS, PRIORIDADES } from "@/lib/etiquetas";
import {
  BotonPrimario,
  BotonSecundario,
  Campo,
  Entrada,
  EstadoVacio,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface TareaPlantilla {
  nombre: string;
  etapa?: string;
  prioridad?: string;
  duracionDias?: number;
  dependeDe?: number[];
}

interface Plantilla {
  id: string;
  name: string;
  description: string | null;
  config: { tareas: TareaPlantilla[] };
}

export default function PlantillasPage() {
  const { puede } = useAuth();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [tareas, setTareas] = useState<TareaPlantilla[]>([]);

  const puedeEditar = puede("PLANTILLAS", "editar");

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ templates: Plantilla[] }>("/api/templates");
      setPlantillas(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function agregarTarea(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setTareas((prev) => [
      ...prev,
      {
        nombre: String(form.get("nombre")),
        etapa: String(form.get("etapa")) || undefined,
        prioridad: String(form.get("prioridad")) || undefined,
        duracionDias: Number(form.get("duracionDias")) || 3,
        dependeDe: prev.length > 0 && form.get("dependeAnterior") === "on"
          ? [prev.length - 1]
          : [],
      },
    ]);
    e.currentTarget.reset();
  }

  async function guardarPlantilla(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (tareas.length === 0) {
      setError("Agrega al menos una tarea a la plantilla.");
      return;
    }
    try {
      await api("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || undefined,
          tareas,
        }),
      });
      setCreando(false);
      setTareas([]);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plantillas de proyecto
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tareas preconfiguradas para crear proyectos nuevos rápido. Se
            aplican desde la pestaña &quot;Tareas y Gantt&quot; de cada
            proyecto.
          </p>
        </div>
        {puedeEditar && (
          <BotonPrimario onClick={() => setCreando((v) => !v)}>
            Nueva plantilla
          </BotonPrimario>
        )}
      </div>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {creando && (
        <Tarjeta className="mt-4 p-5">
          <form onSubmit={guardarPlantilla} className="grid grid-cols-2 gap-4">
            <Campo etiqueta="Nombre de la plantilla">
              <Entrada name="name" required placeholder="Obra residencial estándar" />
            </Campo>
            <Campo etiqueta="Descripción">
              <Entrada name="description" placeholder="Opcional" />
            </Campo>
            <div className="col-span-2">
              <BotonPrimario type="submit">
                Guardar plantilla ({tareas.length}{" "}
                {tareas.length === 1 ? "tarea" : "tareas"})
              </BotonPrimario>
            </div>
          </form>

          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Tareas de la plantilla</h3>
            {tareas.length > 0 && (
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
                {tareas.map((t, i) => (
                  <li key={i}>
                    {t.nombre}
                    <span className="text-xs text-muted">
                      {" "}
                      · {t.duracionDias} días
                      {t.etapa && ` · ${ETAPAS[t.etapa]}`}
                      {(t.dependeDe?.length ?? 0) > 0 &&
                        ` · depende de la tarea ${t.dependeDe![0] + 1}`}
                    </span>
                    <button
                      onClick={() =>
                        setTareas((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="ml-2 text-xs text-danger hover:underline"
                    >
                      quitar
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <form
              onSubmit={agregarTarea}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <Campo etiqueta="Nombre de la tarea">
                <Entrada name="nombre" required placeholder="Despiece" />
              </Campo>
              <Campo etiqueta="Etapa">
                <Selector name="etapa" defaultValue="">
                  <option value="">Sin etapa</option>
                  {Object.entries(ETAPAS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Prioridad">
                <Selector name="prioridad" defaultValue="MEDIA">
                  {Object.entries(PRIORIDADES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Días">
                <Entrada
                  name="duracionDias"
                  type="number"
                  min="1"
                  defaultValue="3"
                  className="max-w-[80px]"
                />
              </Campo>
              {tareas.length > 0 && (
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="dependeAnterior"
                    defaultChecked
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Depende de la anterior
                </label>
              )}
              <BotonSecundario type="submit">Agregar tarea</BotonSecundario>
            </form>
          </div>
        </Tarjeta>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        {plantillas.length === 0 && !creando && (
          <div className="col-span-2">
            <EstadoVacio>
              No hay plantillas. Crea la primera para acelerar los proyectos
              nuevos.
            </EstadoVacio>
          </div>
        )}
        {plantillas.map((p) => (
          <Tarjeta key={p.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{p.name}</h2>
                {p.description && (
                  <p className="mt-1 text-sm text-muted">{p.description}</p>
                )}
              </div>
              {puedeEditar && (
                <button
                  onClick={async () => {
                    if (window.confirm("¿Eliminar esta plantilla?")) {
                      await api(`/api/templates/${p.id}`, {
                        method: "DELETE",
                      });
                      await cargar();
                    }
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
            <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-muted">
              {(p.config?.tareas ?? []).map((t, i) => (
                <li key={i}>
                  {t.nombre}
                  <span className="text-xs"> · {t.duracionDias ?? 3} días</span>
                </li>
              ))}
            </ol>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
