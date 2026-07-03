"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  CANALES_CONTACTO,
  ESTADOS_COTIZACION,
  RAZONES_RECHAZO,
} from "@/lib/etiquetas";
import { diasDesde, fechaHora, moneda, porcentaje } from "@/lib/formato";
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

interface Cotizacion {
  id: string;
  amount: string;
  marginPercent: string;
  status: string;
  requiresManagementApproval: boolean;
  sentAt: string | null;
  budgetApprovedBy: { name: string } | null;
  budgetApprovedAt: string | null;
  managementApprovedBy: { name: string } | null;
  managementApprovedAt: string | null;
  quoter: { id: string; name: string };
  rejection: { reason: string; note: string | null } | null;
  contactLogs: {
    id: string;
    channel: string;
    notes: string;
    contactedAt: string;
    user: { name: string };
  }[];
}

function tonoCotizacion(estado: string): string {
  switch (estado) {
    case "ACEPTADA":
      return "verde";
    case "RECHAZADA":
      return "rojo";
    case "APROBADA":
    case "ENVIADA":
      return "azul";
    case "CAMBIOS_SOLICITADOS":
    case "SIN_RESPUESTA":
      return "naranja";
    default:
      return "gris";
  }
}

export function TabCotizaciones({
  projectId,
  currency,
  puedeEditar,
}: {
  projectId: string;
  currency: string;
  puedeEditar: boolean;
}) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [contactando, setContactando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ quotes: Cotizacion[] }>(
        `/api/quotes?projectId=${projectId}`,
      );
      setCotizaciones(data.quotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [projectId]);

  useEffect(() => {
    cargar();
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
      api("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          amount: form.get("amount"),
          marginPercent: form.get("marginPercent"),
          requiresManagementApproval:
            form.get("requiresManagementApproval") === "on",
        }),
      }),
    );
    setMostrarForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Cotizaciones del proyecto</h2>
        {puedeEditar && (
          <BotonPrimario onClick={() => setMostrarForm((v) => !v)}>
            Nueva cotización
          </BotonPrimario>
        )}
      </div>
      <MensajeError>{error}</MensajeError>

      {mostrarForm && (
        <form
          onSubmit={crear}
          className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <Campo etiqueta="Monto total">
            <Entrada name="amount" type="number" min="0" step="0.01" required />
          </Campo>
          <Campo etiqueta="Margen (% sobre precio de venta)">
            <Entrada
              name="marginPercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              required
            />
          </Campo>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              name="requiresManagementApproval"
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Requiere aprobación de Gerencia (monto/complejidad)
          </label>
          <div className="col-span-3 flex gap-2">
            <BotonPrimario type="submit">Crear</BotonPrimario>
            <BotonSecundario type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </BotonSecundario>
          </div>
        </form>
      )}

      {cotizaciones.length === 0 && (
        <EstadoVacio>Este proyecto aún no tiene cotizaciones.</EstadoVacio>
      )}

      {cotizaciones.map((q) => {
        const dias = q.sentAt ? diasDesde(q.sentAt) : null;
        return (
          <Tarjeta key={q.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-semibold">
                    {moneda(q.amount, currency)}
                  </span>
                  <Badge tono={tonoCotizacion(q.status)}>
                    {ESTADOS_COTIZACION[q.status]}
                  </Badge>
                  {dias !== null &&
                    ["ENVIADA", "SIN_RESPUESTA"].includes(q.status) && (
                      <Badge tono={dias > 15 ? "rojo" : "naranja"}>
                        {dias} {dias === 1 ? "día" : "días"} en espera
                      </Badge>
                    )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  Margen {porcentaje(q.marginPercent)} · Cotizador:{" "}
                  {q.quoter.name}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Presupuesto:{" "}
                  {q.budgetApprovedAt
                    ? `aprobada por ${q.budgetApprovedBy?.name}`
                    : "pendiente"}
                  {q.requiresManagementApproval && (
                    <>
                      {" "}
                      · Gerencia:{" "}
                      {q.managementApprovedAt
                        ? `aprobada por ${q.managementApprovedBy?.name}`
                        : "pendiente"}
                    </>
                  )}
                </p>
                {q.rejection && (
                  <p className="mt-1 text-xs text-danger">
                    Razón de rechazo: {RAZONES_RECHAZO[q.rejection.reason]}
                    {q.rejection.note && ` — ${q.rejection.note}`}
                  </p>
                )}
              </div>
              {puedeEditar && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {q.status === "BORRADOR" && (
                    <BotonSecundario
                      onClick={() =>
                        accion(() =>
                          api(`/api/quotes/${q.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ completed: true }),
                          }),
                        )
                      }
                    >
                      Pasar a revisión
                    </BotonSecundario>
                  )}
                  {["EN_REVISION", "BORRADOR"].includes(q.status) &&
                    !q.budgetApprovedAt && (
                      <BotonSecundario
                        onClick={() =>
                          accion(() =>
                            api(`/api/quotes/${q.id}/aprobar`, {
                              method: "POST",
                              body: JSON.stringify({ tipo: "presupuesto" }),
                            }),
                          )
                        }
                      >
                        Aprobar (Presupuesto)
                      </BotonSecundario>
                    )}
                  {q.requiresManagementApproval && !q.managementApprovedAt && (
                    <BotonSecundario
                      onClick={() =>
                        accion(() =>
                          api(`/api/quotes/${q.id}/aprobar`, {
                            method: "POST",
                            body: JSON.stringify({ tipo: "gerencia" }),
                          }),
                        )
                      }
                    >
                      Aprobar (Gerencia)
                    </BotonSecundario>
                  )}
                  {q.status === "APROBADA" && (
                    <BotonPrimario
                      onClick={() =>
                        accion(() =>
                          api(`/api/quotes/${q.id}/enviar`, { method: "POST" }),
                        )
                      }
                    >
                      Enviar al cliente
                    </BotonPrimario>
                  )}
                  {["ENVIADA", "SIN_RESPUESTA", "CAMBIOS_SOLICITADOS"].includes(
                    q.status,
                  ) && (
                    <>
                      <BotonPrimario
                        onClick={() =>
                          accion(() =>
                            api(`/api/quotes/${q.id}/responder`, {
                              method: "POST",
                              body: JSON.stringify({ estado: "ACEPTADA" }),
                            }),
                          )
                        }
                      >
                        Cliente aceptó
                      </BotonPrimario>
                      <BotonSecundario onClick={() => setRechazando(q.id)}>
                        Rechazada
                      </BotonSecundario>
                      <BotonSecundario
                        onClick={() =>
                          accion(() =>
                            api(`/api/quotes/${q.id}/responder`, {
                              method: "POST",
                              body: JSON.stringify({
                                estado: "CAMBIOS_SOLICITADOS",
                              }),
                            }),
                          )
                        }
                      >
                        Pidió cambios
                      </BotonSecundario>
                    </>
                  )}
                </div>
              )}
            </div>

            {rechazando === q.id && (
              <form
                className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  await accion(() =>
                    api(`/api/quotes/${q.id}/responder`, {
                      method: "POST",
                      body: JSON.stringify({
                        estado: "RECHAZADA",
                        razon: form.get("razon"),
                        nota: form.get("nota") || undefined,
                      }),
                    }),
                  );
                  setRechazando(null);
                }}
              >
                <Campo etiqueta="Razón del rechazo (obligatoria)">
                  <Selector name="razon" required>
                    {Object.entries(RAZONES_RECHAZO).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Nota adicional">
                  <Entrada name="nota" placeholder="Detalle opcional" />
                </Campo>
                <BotonPrimario type="submit">Registrar rechazo</BotonPrimario>
                <BotonSecundario
                  type="button"
                  onClick={() => setRechazando(null)}
                >
                  Cancelar
                </BotonSecundario>
              </form>
            )}

            {/* Bitácora CRM */}
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Bitácora de contactos ({q.contactLogs.length})
                </h3>
                {puedeEditar && (
                  <button
                    onClick={() =>
                      setContactando(contactando === q.id ? null : q.id)
                    }
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Registrar contacto
                  </button>
                )}
              </div>
              {contactando === q.id && (
                <form
                  className="mt-2 flex flex-wrap items-end gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    await accion(() =>
                      api(`/api/quotes/${q.id}/contactos`, {
                        method: "POST",
                        body: JSON.stringify({
                          channel: form.get("channel"),
                          notes: form.get("notes"),
                        }),
                      }),
                    );
                    setContactando(null);
                  }}
                >
                  <Campo etiqueta="Canal">
                    <Selector name="channel">
                      {Object.entries(CANALES_CONTACTO).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="¿Qué se habló?" ancho="flex-1">
                    <Entrada name="notes" required />
                  </Campo>
                  <BotonPrimario type="submit">Guardar</BotonPrimario>
                </form>
              )}
              <ul className="mt-2 space-y-1">
                {q.contactLogs.map((c) => (
                  <li key={c.id} className="text-xs text-muted">
                    <span className="font-medium text-foreground">
                      {CANALES_CONTACTO[c.channel]}
                    </span>{" "}
                    · {fechaHora(c.contactedAt)} · {c.user.name}: {c.notes}
                  </li>
                ))}
              </ul>
            </div>
          </Tarjeta>
        );
      })}
    </div>
  );
}
