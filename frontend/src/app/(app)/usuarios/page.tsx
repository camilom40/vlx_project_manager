"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Equipo {
  id: string;
  name: string;
}

interface Usuario {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  teamId: string | null;
  team: { id: string; name: string } | null;
}

export default function UsuariosPage() {
  const { puede, usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tempPassword, setTempPassword] = useState<{
    nombre: string;
    valor: string;
  } | null>(null);

  const puedeEditar = puede("USUARIOS", "editar");

  const cargar = useCallback(async () => {
    try {
      const [u, t] = await Promise.all([
        api<{ users: Usuario[] }>("/api/users"),
        api<{ teams: Equipo[] }>("/api/teams").catch(() => ({ teams: [] })),
      ]);
      setUsuarios(u.users);
      setEquipos(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone") || null,
      teamId: form.get("teamId") || null,
    };
    try {
      if (editando) {
        await api(`/api/users/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setAviso("Usuario actualizado.");
      } else {
        const res = await api<{ tempPassword: string; user: Usuario }>(
          "/api/users",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setTempPassword({
          nombre: res.user.name,
          valor: res.tempPassword,
        });
      }
      setMostrarForm(false);
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  async function alternarActivo(u: Usuario) {
    setError(null);
    try {
      await api(`/api/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar.");
    }
  }

  async function resetear(u: Usuario) {
    setError(null);
    try {
      const res = await api<{ tempPassword: string }>(
        `/api/users/${u.id}/reset-password`,
        { method: "POST" },
      );
      setTempPassword({ nombre: u.name, valor: res.tempPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al resetear.");
    }
  }

  async function eliminar(u: Usuario) {
    setError(null);
    setAviso(null);
    if (
      !window.confirm(
        `¿Eliminar a ${u.name}? Esto solo es posible si nunca ha dejado historial en el sistema. Si lo tiene, se te pedirá desactivarlo en su lugar.`,
      )
    ) {
      return;
    }
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      setAviso("Usuario eliminado.");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        {puedeEditar && (
          <button
            onClick={() => {
              setEditando(null);
              setMostrarForm(true);
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Nuevo usuario
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {aviso}
        </p>
      )}

      {tempPassword && (
        <div className="mt-4 rounded-lg border border-accent bg-accent/10 p-4">
          <p className="text-sm font-medium">
            Contraseña temporal para {tempPassword.nombre}:
          </p>
          <p className="mt-1 font-mono text-lg">{tempPassword.valor}</p>
          <p className="mt-1 text-xs text-muted">
            Cópiala ahora: no se volverá a mostrar. El usuario deberá cambiarla
            al ingresar.
          </p>
          <button
            onClick={() => setTempPassword(null)}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            Entendido, ocultar
          </button>
        </div>
      )}

      {mostrarForm && (
        <form
          onSubmit={guardar}
          className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Nombre completo
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={editando?.name ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={editando?.email ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="phone">
              Teléfono (WhatsApp)
            </label>
            <input
              id="phone"
              name="phone"
              placeholder="+57 300 000 0000"
              defaultValue={editando?.phone ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="teamId">
              Equipo
            </label>
            <select
              id="teamId"
              name="teamId"
              defaultValue={editando?.teamId ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Sin equipo</option>
              {equipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              {editando ? "Guardar cambios" : "Crear usuario"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarForm(false);
                setEditando(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Equipo</th>
              <th className="px-4 py-3">Estado</th>
              {puedeEditar && <th className="px-4 py-3">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">{u.team?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {u.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                {puedeEditar && (
                  <td className="space-x-3 px-4 py-3 text-xs">
                    <button
                      onClick={() => {
                        setEditando(u);
                        setMostrarForm(true);
                      }}
                      className="font-medium text-brand hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => resetear(u)}
                      className="font-medium text-accent-dark hover:underline"
                    >
                      Restablecer contraseña
                    </button>
                    {u.id === usuario?.id ? (
                      <span className="text-muted" title="No puedes desactivar tu propio usuario">
                        (tu cuenta)
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => alternarActivo(u)}
                          className={`font-medium hover:underline ${
                            u.isActive ? "text-danger" : "text-success"
                          }`}
                        >
                          {u.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          onClick={() => eliminar(u)}
                          className="font-medium text-danger hover:underline"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td
                  colSpan={puedeEditar ? 5 : 4}
                  className="px-4 py-8 text-center text-muted"
                >
                  No hay usuarios registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
