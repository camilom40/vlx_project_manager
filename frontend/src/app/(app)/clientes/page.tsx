"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Badge,
  BotonIcono,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Desplegable,
  Entrada,
  EstadoVacio,
  IconoEditar,
  IconoEncender,
  MensajeError,
  Tarjeta,
} from "@/components/ui";

interface Cliente {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  isActive: boolean;
  _count: { projects: number };
}

export default function ClientesPage() {
  const { puede } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const puedeEditar = puede("CLIENTES", "editar");

  const cargar = useCallback(async () => {
    try {
      const params = new URLSearchParams({ activos: "todos" });
      if (buscar) params.set("buscar", buscar);
      const data = await api<{ clients: Cliente[] }>(
        `/api/clients?${params.toString()}`,
      );
      setClientes(data.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [buscar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      contactName: form.get("contactName") || null,
      email: form.get("email") || null,
      phone: form.get("phone") || null,
      taxId: form.get("taxId") || null,
      address: form.get("address") || null,
      city: form.get("city") || null,
      notes: form.get("notes") || null,
    };
    try {
      if (editando) {
        await api(`/api/clients/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setAviso("Cliente actualizado.");
      } else {
        await api("/api/clients", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setAviso("Cliente creado.");
      }
      setMostrarForm(false);
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted">
            Constructoras y clientes que se seleccionan al crear proyectos.
          </p>
        </div>
        {puedeEditar && (
          <BotonPrimario
            onClick={() => {
              setEditando(null);
              setMostrarForm((v) => !v);
            }}
          >
            Nuevo cliente
          </BotonPrimario>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <MensajeError>{error}</MensajeError>
        {aviso && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            {aviso}
          </p>
        )}
      </div>

      <Desplegable abierto={mostrarForm || Boolean(editando)}>
        <form
          onSubmit={guardar}
          className="mt-4 grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <Campo etiqueta="Nombre / razón social">
            <Entrada
              name="name"
              required
              defaultValue={editando?.name ?? ""}
              placeholder="Constructora ABC S.A.S."
            />
          </Campo>
          <Campo etiqueta="Persona de contacto">
            <Entrada
              name="contactName"
              defaultValue={editando?.contactName ?? ""}
              placeholder="Ing. Laura Gómez"
            />
          </Campo>
          <Campo etiqueta="NIT / identificación">
            <Entrada name="taxId" defaultValue={editando?.taxId ?? ""} />
          </Campo>
          <Campo etiqueta="Correo electrónico">
            <Entrada
              name="email"
              type="email"
              defaultValue={editando?.email ?? ""}
              placeholder="contacto@constructora.co"
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada
              name="phone"
              defaultValue={editando?.phone ?? ""}
              placeholder="+57 300 000 0000"
            />
          </Campo>
          <Campo etiqueta="Ciudad">
            <Entrada name="city" defaultValue={editando?.city ?? ""} />
          </Campo>
          <Campo etiqueta="Dirección" ancho="col-span-2">
            <Entrada name="address" defaultValue={editando?.address ?? ""} />
          </Campo>
          <Campo etiqueta="Notas">
            <Entrada
              name="notes"
              defaultValue={editando?.notes ?? ""}
              placeholder="Condiciones, referencias..."
            />
          </Campo>
          <div className="col-span-3 flex gap-3">
            <BotonPrimario type="submit">
              {editando ? "Guardar cambios" : "Crear cliente"}
            </BotonPrimario>
            <BotonSecundario
              type="button"
              onClick={() => {
                setMostrarForm(false);
                setEditando(null);
              }}
            >
              Cancelar
            </BotonSecundario>
          </div>
        </form>
      </Desplegable>

      <div className="mt-4">
        <Entrada
          placeholder="Buscar por nombre, contacto o correo..."
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Tarjeta className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Correo / teléfono</th>
              <th className="px-4 py-3">Proyectos</th>
              <th className="px-4 py-3">Estado</th>
              {puedeEditar && <th className="px-4 py-3">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{c.name}</span>
                  {c.city && (
                    <span className="block text-xs text-muted">{c.city}</span>
                  )}
                </td>
                <td className="px-4 py-3">{c.contactName ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {c.email ?? "—"}
                  {c.phone && (
                    <span className="block text-xs">{c.phone}</span>
                  )}
                </td>
                <td className="px-4 py-3">{c._count.projects}</td>
                <td className="px-4 py-3">
                  <Badge tono={c.isActive ? "verde" : "gris"}>
                    {c.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                {puedeEditar && (
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-0.5">
                      <BotonIcono
                        etiqueta="Editar"
                        tono="brand"
                        onClick={() => {
                          setEditando(c);
                          setMostrarForm(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <IconoEditar />
                      </BotonIcono>
                      <BotonIcono
                        etiqueta={c.isActive ? "Desactivar" : "Activar"}
                        tono={c.isActive ? "danger" : "success"}
                        onClick={async () => {
                          await api(`/api/clients/${c.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ isActive: !c.isActive }),
                          });
                          await cargar();
                        }}
                      >
                        <IconoEncender />
                      </BotonIcono>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 6 : 5} className="px-4 py-8">
                  <EstadoVacio>
                    No hay clientes registrados. Crea el primero con
                    &quot;Nuevo cliente&quot;.
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
