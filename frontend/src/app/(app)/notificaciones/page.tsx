"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fechaHora } from "@/lib/formato";
import {
  Badge,
  BotonIcono,
  BotonSecundario,
  EstadoVacio,
  IconoCheck,
  MensajeError,
  Tarjeta,
} from "@/components/ui";

interface Notificacion {
  id: string;
  channel: string;
  title: string;
  body: string;
  read: boolean;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  quote: { id: string; title: string } | null;
}

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ notifications: Notificacion[] }>(
        "/api/notifications",
      );
      setNotificaciones(data.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Notificaciones
        </h1>
        <div className="flex gap-2">
          <BotonSecundario
            onClick={async () => {
              await api("/api/notifications/leer-todas", { method: "PUT" });
              await cargar();
            }}
          >
            Marcar todas como leídas
          </BotonSecundario>
          <BotonSecundario
            disabled={!notificaciones.some((n) => n.read)}
            onClick={async () => {
              await api("/api/notifications/leidas", { method: "DELETE" });
              await cargar();
            }}
          >
            Eliminar leídas
          </BotonSecundario>
        </div>
      </div>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      <div className="lista-stagger mt-4 space-y-2">
        {notificaciones.length === 0 && (
          <EstadoVacio>No tienes notificaciones.</EstadoVacio>
        )}
        {notificaciones.map((n) => (
          <Tarjeta
            key={n.id}
            className={`p-4 ${n.read ? "opacity-70" : "border-brand/40"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {!n.read && (
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand" />
                  )}
                  {n.title}
                </p>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {fechaHora(n.createdAt)} ·{" "}
                  <Badge tono={n.channel === "WHATSAPP" ? "verde" : "azul"}>
                    {n.channel === "WHATSAPP" ? "WhatsApp" : "Correo"}
                  </Badge>{" "}
                  {n.sentAt ? (
                    <span className="text-success">enviada</span>
                  ) : n.error ? (
                    <span title={n.error}>solo en la app ({n.error})</span>
                  ) : (
                    "pendiente"
                  )}
                  {n.project && (
                    <>
                      {" · "}
                      <Link
                        href={`/proyectos/${n.project.id}`}
                        className="text-brand hover:underline"
                      >
                        {n.project.name}
                      </Link>
                    </>
                  )}
                  {n.quote && (
                    <>
                      {" · "}
                      <Link
                        href={`/cotizaciones/${n.quote.id}`}
                        className="text-brand hover:underline"
                      >
                        Ver cotización
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {!n.read && (
                <BotonIcono
                  etiqueta="Marcar leída"
                  tono="brand"
                  onClick={async () => {
                    await api(`/api/notifications/${n.id}/leer`, {
                      method: "PUT",
                    });
                    await cargar();
                  }}
                >
                  <IconoCheck />
                </BotonIcono>
              )}
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
