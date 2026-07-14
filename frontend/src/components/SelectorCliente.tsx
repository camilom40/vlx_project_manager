"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BotonPrimario, Campo, Entrada, Selector } from "@/components/ui";

interface Cliente {
  id: string;
  name: string;
}

// Selector de cliente con creación rápida inline (compartido por
// "Nuevo proyecto" y "Nueva cotización").
export function SelectorCliente({
  value,
  onChange,
  onError,
  requerido = true,
}: {
  value: string;
  onChange: (clientId: string) => void;
  onError?: (mensaje: string) => void;
  requerido?: boolean;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    contacto: "",
    correo: "",
    telefono: "",
  });

  const cargar = useCallback(() => {
    api<{ clients: Cliente[] }>("/api/clients")
      .then((d) => setClientes(d.clients))
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crearCliente() {
    if (!nuevo.nombre.trim()) {
      onError?.("Escribe el nombre del cliente nuevo.");
      return;
    }
    try {
      const res = await api<{ client: Cliente }>("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: nuevo.nombre,
          contactName: nuevo.contacto || null,
          email: nuevo.correo || null,
          phone: nuevo.telefono || null,
        }),
      });
      setCreando(false);
      setNuevo({ nombre: "", contacto: "", correo: "", telefono: "" });
      cargar();
      onChange(res.client.id);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Error al crear cliente.");
    }
  }

  return (
    <div>
      <Selector
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={requerido}
      >
        <option value="">Selecciona un cliente...</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Selector>
      <button
        type="button"
        onClick={() => setCreando((v) => !v)}
        className="mt-1 text-xs font-medium text-brand hover:underline"
      >
        {creando ? "Cerrar cliente nuevo" : "+ Crear cliente nuevo"}
      </button>
      {creando && (
        <div className="mt-2 grid grid-cols-2 items-end gap-3 rounded-lg border border-dashed border-brand/40 bg-brand-light/20 p-3">
          <Campo etiqueta="Nombre del cliente nuevo">
            <Entrada
              value={nuevo.nombre}
              onChange={(e) =>
                setNuevo((c) => ({ ...c, nombre: e.target.value }))
              }
              placeholder="Constructora ABC S.A.S."
            />
          </Campo>
          <Campo etiqueta="Contacto">
            <Entrada
              value={nuevo.contacto}
              onChange={(e) =>
                setNuevo((c) => ({ ...c, contacto: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada
              type="email"
              value={nuevo.correo}
              onChange={(e) =>
                setNuevo((c) => ({ ...c, correo: e.target.value }))
              }
            />
          </Campo>
          <div className="flex items-end gap-2">
            <Campo etiqueta="Teléfono" ancho="flex-1">
              <Entrada
                value={nuevo.telefono}
                onChange={(e) =>
                  setNuevo((c) => ({ ...c, telefono: e.target.value }))
                }
              />
            </Campo>
            <BotonPrimario type="button" onClick={crearCliente}>
              Crear
            </BotonPrimario>
          </div>
        </div>
      )}
    </div>
  );
}
