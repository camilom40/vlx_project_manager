"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  BotonPrimario,
  Entrada,
  EstadoVacio,
  MensajeError,
  Tarjeta,
} from "@/components/ui";

interface Grupo {
  id: string;
  name: string;
  members: { user: { id: string; name: string; phone: string | null } }[];
  _count: { projects: number };
}

interface UsuarioMin {
  id: string;
  name: string;
  isActive: boolean;
  team: { name: string } | null;
}

export default function GruposPage() {
  const { puede } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioMin[]>([]);
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const puedeEditar = puede("EQUIPOS", "editar");

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ groups: Grupo[] }>("/api/installer-groups");
      setGrupos(data.groups);
      const u = await api<{ users: UsuarioMin[] }>("/api/users").catch(
        () => ({ users: [] }),
      );
      setUsuarios(u.users.filter((x) => x.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/installer-groups", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name") }),
      });
      e.currentTarget.reset();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear grupo.");
    }
  }

  async function guardarMiembros(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api(`/api/installer-groups/${editando.id}/miembros`, {
        method: "PUT",
        body: JSON.stringify({ userIds: form.getAll("miembros").map(String) }),
      });
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  // Prioriza el equipo Instaladores pero permite cualquier usuario
  const instaladores = [...usuarios].sort((a, b) => {
    const ai = a.team?.name === "Instaladores" ? 0 : 1;
    const bi = b.team?.name === "Instaladores" ? 0 : 1;
    return ai - bi || a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Grupos de instaladores
      </h1>
      <p className="mt-1 text-sm text-muted">
        Cada obra tiene asignado uno o más grupos. Los integrantes reciben las
        notificaciones de sus tareas por WhatsApp.
      </p>

      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {puedeEditar && (
        <form onSubmit={crear} className="mt-4 flex max-w-md gap-2">
          <Entrada name="name" required placeholder="Nombre del grupo (p. ej. Grupo Palmira 1)" />
          <BotonPrimario type="submit">Crear</BotonPrimario>
        </form>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        {grupos.map((g) => (
          <Tarjeta key={g.id} className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{g.name}</h2>
              <span className="text-xs text-muted">
                {g._count.projects}{" "}
                {g._count.projects === 1 ? "obra activa" : "obras activas"}
              </span>
            </div>
            {editando?.id === g.id ? (
              <form onSubmit={guardarMiembros} className="mt-3">
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {instaladores.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="miembros"
                        value={u.id}
                        defaultChecked={g.members.some(
                          (m) => m.user.id === u.id,
                        )}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      {u.name}
                      {u.team && (
                        <span className="text-xs text-muted">
                          · {u.team.name}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <BotonPrimario type="submit">Guardar</BotonPrimario>
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="text-sm text-muted hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <ul className="mt-3 space-y-1 text-sm">
                  {g.members.length === 0 && (
                    <li className="text-muted">Sin integrantes.</li>
                  )}
                  {g.members.map((m) => (
                    <li key={m.user.id} className="flex justify-between">
                      <span>{m.user.name}</span>
                      <span className="text-xs text-muted">
                        {m.user.phone ?? "sin teléfono"}
                      </span>
                    </li>
                  ))}
                </ul>
                {puedeEditar && (
                  <button
                    onClick={() => setEditando(g)}
                    className="mt-3 text-xs font-medium text-brand hover:underline"
                  >
                    Editar integrantes
                  </button>
                )}
              </>
            )}
          </Tarjeta>
        ))}
        {grupos.length === 0 && (
          <div className="col-span-2">
            <EstadoVacio>
              No hay grupos de instaladores. Crea el primero arriba.
            </EstadoVacio>
          </div>
        )}
      </div>
    </div>
  );
}
