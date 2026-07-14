"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CANALES_CONTACTO,
  EMPRESAS,
  ESTADOS_COTIZACION,
  RAZONES_RECHAZO,
} from "@/lib/etiquetas";
import { diasDesde, fecha, fechaHora, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Entrada,
  MensajeError,
  Selector,
  Tarjeta,
  tonoCotizacion,
} from "@/components/ui";

interface UsuarioMin {
  id: string;
  name: string;
}

interface Cotizacion {
  id: string;
  title: string;
  description: string | null;
  clientName: string;
  client: UsuarioMin | null;
  contactName: string | null;
  market: string;
  company: string;
  currency: string;
  amount: string | null;
  marginPercent: string | null;
  status: string;
  requiresManagementApproval: boolean;
  receivedAt: string;
  assignedAt: string | null;
  completedAt: string | null;
  sentAt: string | null;
  clientRespondedAt: string | null;
  budgetApprovedBy: UsuarioMin | null;
  budgetApprovedAt: string | null;
  managementApprovedBy: UsuarioMin | null;
  managementApprovedAt: string | null;
  quoter: UsuarioMin | null;
  assignedBy: UsuarioMin | null;
  project: { id: string; name: string; currentStage: string } | null;
  rejection: { reason: string; note: string | null } | null;
  contactLogs: {
    id: string;
    channel: string;
    notes: string;
    contactedAt: string;
    user: UsuarioMin;
  }[];
}

interface Asignable {
  id: string;
  name: string;
  isTeamLead: boolean;
}

// Delta legible en días entre dos fechas de la línea de tiempo
function deltaDias(desde: string | null, hasta: string | null): string | null {
  if (!desde || !hasta) return null;
  const dias =
    (new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000;
  if (dias < 1) return "el mismo día";
  const n = Math.round(dias);
  return `${n} ${n === 1 ? "día" : "días"} después`;
}

export default function CotizacionDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { puede, usuario } = useAuth();
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [asignables, setAsignables] = useState<Asignable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [responsableSel, setResponsableSel] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [contactando, setContactando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [mostrarGenerar, setMostrarGenerar] = useState(false);

  const puedeEditar = puede("COTIZACIONES", "editar");
  const puedeAsignar = Boolean(
    usuario &&
      (usuario.teamName === "Gerencia" ||
        (usuario.isTeamLead && usuario.teamName === "Presupuesto")),
  );
  const esResponsable = Boolean(
    usuario && cotizacion?.quoter && cotizacion.quoter.id === usuario.id,
  );
  const puedeGestionar = puedeEditar && (puedeAsignar || esResponsable);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ quote: Cotizacion }>(
        `/api/quotes/${params.id}`,
      );
      setCotizacion(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!puedeAsignar) return;
    api<{ users: Asignable[] }>("/api/quotes/asignables")
      .then((d) => setAsignables(d.users))
      .catch(() => {});
  }, [puedeAsignar]);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la operación.");
    }
  }

  async function generarProyecto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    setGenerando(true);
    try {
      const res = await api<{ project: { id: string } }>(
        `/api/quotes/${params.id}/generar-proyecto`,
        {
          method: "POST",
          body: JSON.stringify({ costCenter: form.get("costCenter") }),
        },
      );
      router.push(`/proyectos/${res.project.id}`);
    } catch (err) {
      setGenerando(false);
      setError(err instanceof Error ? err.message : "Error al generar.");
    }
  }

  async function guardarDatos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await accion(() =>
      api(`/api/quotes/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: form.get("amount") || undefined,
          marginPercent: form.get("marginPercent") || undefined,
          requiresManagementApproval:
            form.get("requiresManagementApproval") === "on",
          description: form.get("description") ?? undefined,
          contactName: form.get("contactName") ?? undefined,
        }),
      }),
    );
    setEditando(false);
  }

  if (!cotizacion) {
    return (
      <div>
        <MensajeError>{error}</MensajeError>
        <p className="text-sm text-muted">Cargando cotización...</p>
      </div>
    );
  }

  const q = cotizacion;
  const diasIngreso = diasDesde(q.receivedAt);
  const diasEspera = q.sentAt ? diasDesde(q.sentAt) : null;
  const enElaboracion = ["BORRADOR", "CAMBIOS_SOLICITADOS"].includes(q.status);
  const listaParaRevision = q.amount !== null && q.marginPercent !== null;

  const lineaTiempo: { etiqueta: string; valor: string | null; detalle?: string | null }[] = [
    { etiqueta: "Ingresó", valor: q.receivedAt },
    {
      etiqueta: "Asignada",
      valor: q.assignedAt,
      detalle: q.assignedAt
        ? [
            q.quoter ? `a ${q.quoter.name}` : null,
            q.assignedBy ? `por ${q.assignedBy.name}` : null,
            deltaDias(q.receivedAt, q.assignedAt),
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
    },
    {
      etiqueta: "Elaborada",
      valor: q.completedAt,
      detalle: deltaDias(q.assignedAt, q.completedAt),
    },
    {
      etiqueta: "Enviada al cliente",
      valor: q.sentAt,
      detalle: deltaDias(q.receivedAt, q.sentAt),
    },
    {
      etiqueta: "Respuesta del cliente",
      valor: q.clientRespondedAt,
      detalle: deltaDias(q.sentAt, q.clientRespondedAt),
    },
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link
              href="/cotizaciones"
              className="hover:text-brand hover:underline"
            >
              Cotizaciones
            </Link>
            <span>/</span>
            <span>{q.title}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {q.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {q.clientName} · {EMPRESAS[q.company]} ·{" "}
            {q.market === "CO" ? "Colombia" : "Estados Unidos"} · Ingresó{" "}
            {fecha(q.receivedAt)}
            {diasIngreso !== null &&
              ` (hace ${diasIngreso} ${diasIngreso === 1 ? "día" : "días"})`}
          </p>
        </div>
        <div className="text-right">
          <span className="flex flex-wrap items-center justify-end gap-2">
            <Badge tono={tonoCotizacion(q.status)}>
              {ESTADOS_COTIZACION[q.status]}
            </Badge>
            {diasEspera !== null &&
              ["ENVIADA", "SIN_RESPUESTA"].includes(q.status) && (
                <Badge tono={diasEspera > 15 ? "rojo" : "naranja"}>
                  {diasEspera} {diasEspera === 1 ? "día" : "días"} sin respuesta
                </Badge>
              )}
          </span>
          <p className="mt-2 font-mono text-lg font-semibold">
            {moneda(q.amount, q.currency)}
          </p>
          {q.marginPercent !== null && (
            <p className="text-xs text-muted">
              Margen {porcentaje(q.marginPercent)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {/* Proyecto generado */}
      {q.project && (
        <Tarjeta className="mt-4 border-success/40 p-4">
          <p className="text-sm">
            Esta cotización generó el proyecto{" "}
            <Link
              href={`/proyectos/${q.project.id}`}
              className="font-semibold text-brand hover:underline"
            >
              {q.project.name}
            </Link>
            .
          </p>
        </Tarjeta>
      )}

      {/* Acciones según estado */}
      {puedeEditar && (
        <Tarjeta className="mt-4 p-5">
          <h2 className="text-sm font-semibold">Acciones</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {/* Asignación */}
            {puedeAsignar &&
              ["INGRESADA", "BORRADOR", "CAMBIOS_SOLICITADOS"].includes(
                q.status,
              ) && (
                <>
                  <Campo
                    etiqueta={
                      q.quoter
                        ? `Responsable actual: ${q.quoter.name}`
                        : "Asignar responsable"
                    }
                  >
                    <Selector
                      value={responsableSel}
                      onChange={(e) => setResponsableSel(e.target.value)}
                      className="min-w-[190px]"
                    >
                      <option value="">Selecciona...</option>
                      {asignables.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                  <BotonPrimario
                    disabled={!responsableSel}
                    onClick={() =>
                      accion(() =>
                        api(`/api/quotes/${q.id}/asignar`, {
                          method: "POST",
                          body: JSON.stringify({ quoterId: responsableSel }),
                        }),
                      )
                    }
                  >
                    {q.quoter ? "Reasignar" : "Asignar"}
                  </BotonPrimario>
                  {!q.quoter && (
                    <BotonSecundario
                      onClick={() =>
                        accion(() =>
                          api(`/api/quotes/${q.id}/asignar`, {
                            method: "POST",
                            body: JSON.stringify({ quoterId: usuario!.id }),
                          }),
                        )
                      }
                    >
                      Asignarme a mí
                    </BotonSecundario>
                  )}
                </>
              )}

            {/* Elaboración → revisión */}
            {enElaboracion && puedeGestionar && (
              <BotonPrimario
                disabled={!listaParaRevision}
                title={
                  listaParaRevision
                    ? undefined
                    : "Registra el monto y el margen primero"
                }
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
              </BotonPrimario>
            )}

            {/* Aprobación dual */}
            {q.status === "EN_REVISION" && !q.budgetApprovedAt && (
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
            {q.status === "EN_REVISION" &&
              q.requiresManagementApproval &&
              !q.managementApprovedAt &&
              usuario?.teamName === "Gerencia" && (
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

            {/* Envío */}
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

            {/* Respuesta del cliente */}
            {["ENVIADA", "SIN_RESPUESTA"].includes(q.status) && (
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
                <BotonSecundario onClick={() => setRechazando((v) => !v)}>
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
                {q.status === "ENVIADA" && (
                  <BotonSecundario
                    onClick={() =>
                      accion(() =>
                        api(`/api/quotes/${q.id}/responder`, {
                          method: "POST",
                          body: JSON.stringify({ estado: "SIN_RESPUESTA" }),
                        }),
                      )
                    }
                  >
                    Marcar sin respuesta
                  </BotonSecundario>
                )}
              </>
            )}

            {/* Generar proyecto */}
            {q.status === "ACEPTADA" &&
              !q.project &&
              puede("PROYECTOS", "editar") && (
                <BotonPrimario onClick={() => setMostrarGenerar((v) => !v)}>
                  Generar proyecto
                </BotonPrimario>
              )}
          </div>

          {mostrarGenerar && (
            <form
              onSubmit={generarProyecto}
              className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-3"
            >
              <Campo etiqueta="Centro de costo (obligatorio)">
                <Entrada name="costCenter" required placeholder="CC-0000" />
              </Campo>
              <BotonPrimario type="submit" disabled={generando}>
                {generando ? "Generando..." : "Confirmar y generar"}
              </BotonPrimario>
              <BotonSecundario
                type="button"
                onClick={() => setMostrarGenerar(false)}
              >
                Cancelar
              </BotonSecundario>
            </form>
          )}

          {rechazando && (
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
                setRechazando(false);
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
              <BotonSecundario type="button" onClick={() => setRechazando(false)}>
                Cancelar
              </BotonSecundario>
            </form>
          )}
        </Tarjeta>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Línea de tiempo */}
        <Tarjeta className="p-5">
          <h2 className="font-semibold">Línea de tiempo</h2>
          <ul className="mt-3 space-y-3">
            {lineaTiempo.map((h) => (
              <li key={h.etiqueta} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    h.valor ? "bg-brand" : "border-2 border-border bg-surface"
                  }`}
                />
                <span>
                  <span
                    className={h.valor ? "font-medium" : "text-muted"}
                  >
                    {h.etiqueta}
                  </span>
                  {h.valor ? (
                    <span className="block text-xs text-muted">
                      {fechaHora(h.valor)}
                      {h.detalle && ` · ${h.detalle}`}
                    </span>
                  ) : (
                    <span className="block text-xs text-muted">Pendiente</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {q.rejection && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-danger">
              Razón de rechazo: {RAZONES_RECHAZO[q.rejection.reason]}
              {q.rejection.note && ` — ${q.rejection.note}`}
            </p>
          )}
        </Tarjeta>

        {/* Datos */}
        <Tarjeta className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Datos de la cotización</h2>
            {puedeGestionar && (
              <button
                onClick={() => setEditando((v) => !v)}
                className="text-xs font-medium text-brand hover:underline"
              >
                {editando ? "Cancelar" : "Editar"}
              </button>
            )}
          </div>
          {!editando ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Responsable</dt>
                <dd className="font-medium">
                  {q.quoter?.name ?? "Sin asignar"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Persona de contacto</dt>
                <dd className="font-medium">{q.contactName ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Monto</dt>
                <dd className="font-mono">{moneda(q.amount, q.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Margen</dt>
                <dd>
                  {q.marginPercent !== null
                    ? porcentaje(q.marginPercent)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Aprobación de Presupuesto</dt>
                <dd>
                  {q.budgetApprovedAt
                    ? `Aprobada por ${q.budgetApprovedBy?.name}`
                    : "Pendiente"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Aprobación de Gerencia</dt>
                <dd>
                  {q.requiresManagementApproval
                    ? q.managementApprovedAt
                      ? `Aprobada por ${q.managementApprovedBy?.name}`
                      : "Pendiente"
                    : "No requerida"}
                </dd>
              </div>
              {q.description && (
                <div className="border-t border-border pt-2">
                  <dt className="text-muted">Descripción</dt>
                  <dd className="mt-1">{q.description}</dd>
                </div>
              )}
            </dl>
          ) : (
            <form onSubmit={guardarDatos} className="mt-3 space-y-3">
              <Campo etiqueta="Persona de contacto">
                <Entrada
                  name="contactName"
                  placeholder="Nombre de quien solicita"
                  defaultValue={q.contactName ?? ""}
                />
              </Campo>
              <Campo etiqueta="Monto total">
                <Entrada
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={q.amount ?? ""}
                />
              </Campo>
              <Campo etiqueta="Margen (% sobre precio de venta)">
                <Entrada
                  name="marginPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={q.marginPercent ?? ""}
                />
              </Campo>
              <Campo etiqueta="Descripción">
                <Entrada
                  name="description"
                  defaultValue={q.description ?? ""}
                />
              </Campo>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="requiresManagementApproval"
                  defaultChecked={q.requiresManagementApproval}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                Requiere aprobación de Gerencia (monto/complejidad)
              </label>
              <BotonPrimario type="submit">Guardar</BotonPrimario>
            </form>
          )}
        </Tarjeta>
      </div>

      {/* Bitácora CRM */}
      {puede("CRM") && (
        <Tarjeta className="mt-6 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Bitácora de contactos ({q.contactLogs.length})
            </h2>
            {puede("CRM", "editar") && (
              <button
                onClick={() => setContactando((v) => !v)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Registrar contacto
              </button>
            )}
          </div>
          {contactando && (
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
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
                setContactando(false);
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
          {q.contactLogs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Sin contactos registrados todavía.
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {q.contactLogs.map((c) => (
                <li key={c.id} className="text-xs text-muted">
                  <span className="font-medium text-foreground">
                    {CANALES_CONTACTO[c.channel]}
                  </span>{" "}
                  · {fechaHora(c.contactedAt)} · {c.user.name}: {c.notes}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
