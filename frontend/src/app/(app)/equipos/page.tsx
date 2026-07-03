"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MODULOS } from "@/lib/etiquetas";

interface PermisoEquipo {
  module: string;
  canView: boolean;
  canEdit: boolean;
}

interface Equipo {
  id: string;
  name: string;
  permissions: PermisoEquipo[];
  _count: { members: number };
}

export default function EquiposPage() {
  const { puede } = useAuth();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [seleccionado, setSeleccionado] = useState<Equipo | null>(null);
  const [matriz, setMatriz] = useState<Record<string, PermisoEquipo>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeEditar = puede("EQUIPOS", "editar");

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ teams: Equipo[] }>("/api/teams");
      setEquipos(data.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function seleccionar(team: Equipo) {
    setSeleccionado(team);
    setAviso(null);
    const base: Record<string, PermisoEquipo> = {};
    for (const modulo of Object.keys(MODULOS)) {
      const existente = team.permissions.find((p) => p.module === modulo);
      base[modulo] = existente ?? {
        module: modulo,
        canView: false,
        canEdit: false,
      };
    }
    setMatriz(base);
  }

  function alternar(modulo: string, campo: "canView" | "canEdit") {
    setMatriz((prev) => {
      const p = { ...prev[modulo], [campo]: !prev[modulo][campo] };
      // editar implica ver
      if (campo === "canEdit" && p.canEdit) p.canView = true;
      if (campo === "canView" && !p.canView) p.canEdit = false;
      return { ...prev, [modulo]: p };
    });
  }

  async function guardarPermisos() {
    if (!seleccionado) return;
    setError(null);
    try {
      await api(`/api/teams/${seleccionado.id}/permisos`, {
        method: "PUT",
        body: JSON.stringify({
          permissions: Object.values(matriz).filter(
            (p) => p.canView || p.canEdit,
          ),
        }),
      });
      setAviso("Permisos guardados.");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  async function crearEquipo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/teams", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name") }),
      });
      e.currentTarget.reset();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear equipo.");
    }
  }

  const esGerencia = seleccionado?.name === "Gerencia";

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Equipos y permisos
      </h1>

      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-[240px_1fr] gap-6">
        <div>
          <ul className="space-y-1">
            {equipos.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => seleccionar(t)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    seleccionado?.id === t.id
                      ? "bg-brand text-white"
                      : "hover:bg-brand-light/50"
                  }`}
                >
                  <span className="font-medium">{t.name}</span>
                  <span
                    className={`block text-xs ${
                      seleccionado?.id === t.id ? "text-white/80" : "text-muted"
                    }`}
                  >
                    {t._count.members}{" "}
                    {t._count.members === 1 ? "integrante" : "integrantes"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {puedeEditar && (
            <form onSubmit={crearEquipo} className="mt-4 flex gap-2">
              <input
                name="name"
                required
                placeholder="Nuevo equipo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Crear
              </button>
            </form>
          )}
        </div>

        <div>
          {!seleccionado ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              Selecciona un equipo para ver y editar sus permisos por módulo.
            </p>
          ) : esGerencia ? (
            <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
              El equipo de Gerencia tiene acceso total a todos los módulos por
              definición. No es necesario configurar sus permisos.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Módulo</th>
                    <th className="px-4 py-3 text-center">Ver</th>
                    <th className="px-4 py-3 text-center">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(MODULOS).map(([modulo, etiqueta]) => (
                    <tr
                      key={modulo}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium">{etiqueta}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          disabled={!puedeEditar}
                          checked={matriz[modulo]?.canView ?? false}
                          onChange={() => alternar(modulo, "canView")}
                          className="h-4 w-4 accent-[var(--brand)]"
                          aria-label={`Ver ${etiqueta}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          disabled={!puedeEditar}
                          checked={matriz[modulo]?.canEdit ?? false}
                          onChange={() => alternar(modulo, "canEdit")}
                          className="h-4 w-4 accent-[var(--brand)]"
                          aria-label={`Editar ${etiqueta}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {puedeEditar && (
                <div className="flex items-center gap-3 border-t border-border px-4 py-3">
                  <button
                    onClick={guardarPermisos}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Guardar permisos
                  </button>
                  {aviso && <span className="text-sm text-success">{aviso}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
