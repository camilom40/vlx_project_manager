"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLES_ASIGNACION } from "@/lib/etiquetas";
import { Badge, EstadoVacio, MensajeError, Tarjeta } from "@/components/ui";

interface Carga {
  id: string;
  nombre: string;
  equipo: string | null;
  tareasAbiertas: number;
  cotizacionesAbiertas: number;
  proyectosActivos: { rol: string; proyecto: { id: string; name: string } }[];
}

export default function CargaPage() {
  const [carga, setCarga] = useState<Carga[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ carga: Carga[] }>("/api/carga");
      setCarga(
        data.carga.sort(
          (a, b) =>
            b.tareasAbiertas +
            b.cotizacionesAbiertas +
            b.proyectosActivos.length -
            (a.tareasAbiertas + a.cotizacionesAbiertas + a.proyectosActivos.length),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const maxCarga = Math.max(
    1,
    ...carga.map(
      (c) => c.tareasAbiertas + c.cotizacionesAbiertas + c.proyectosActivos.length,
    ),
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Carga de trabajo
      </h1>
      <p className="mt-1 text-sm text-muted">
        Quién está saturado y quién tiene capacidad, para redistribuir antes de
        asignar.
      </p>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      <div className="mt-4 space-y-3">
        {carga.length === 0 && (
          <EstadoVacio>No hay usuarios activos para mostrar.</EstadoVacio>
        )}
        {carga.map((c) => {
          const total =
            c.tareasAbiertas + c.cotizacionesAbiertas + c.proyectosActivos.length;
          const pct = (total / maxCarga) * 100;
          return (
            <Tarjeta key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{c.nombre}</span>
                  {c.equipo && (
                    <span className="ml-2 text-xs text-muted">{c.equipo}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge tono={pct > 75 ? "rojo" : pct > 40 ? "naranja" : "verde"}>
                    {total} {total === 1 ? "pendiente" : "pendientes"}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full ${
                    pct > 75 ? "bg-danger" : pct > 40 ? "bg-accent" : "bg-success"
                  }`}
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {c.tareasAbiertas} tareas abiertas · {c.cotizacionesAbiertas}{" "}
                cotizaciones en elaboración ·{" "}
                {c.proyectosActivos.length} roles en proyectos activos
              </p>
              {c.proyectosActivos.length > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {c.proyectosActivos.map((p, i) => (
                    <span key={i}>
                      {ROLES_ASIGNACION[p.rol] ?? p.rol} en{" "}
                      <Link
                        href={`/proyectos/${p.proyecto.id}`}
                        className="text-brand hover:underline"
                      >
                        {p.proyecto.name}
                      </Link>
                      {i < c.proyectosActivos.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </p>
              )}
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
