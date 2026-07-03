"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ESTADOS_DT,
  ESTADOS_REMISION,
  PRIORIDADES,
  TIPOS_ERROR,
} from "@/lib/etiquetas";
import { diasDesde, fecha, fechaHora } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Entrada,
  AreaTexto,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface ActaVanos {
  id: string;
  details: unknown;
  surveyedAt: string;
  requiredDeliveryNotes: string | null;
  priority: string;
  supervisor: { name: string };
  dts: { id: string; code: string | null; status: string }[];
}

interface DT {
  id: string;
  code: string | null;
  despiece: unknown;
  requiredDeliveryDate: string;
  status: string;
  priority: string;
  remision: { id: string; dispatchedAt: string; status: string } | null;
}

interface Remision {
  id: string;
  destination: string;
  dispatchedAt: string;
  status: string;
  observations: string | null;
  signedBy: { name: string } | null;
  dts: { id: string; code: string | null }[];
}

function tonoPrioridad(p: string): string {
  return p === "URGENTE" ? "rojo" : p === "ALTA" ? "naranja" : "gris";
}

function tonoDT(s: string): string {
  switch (s) {
    case "TERMINADO":
      return "verde";
    case "DESPACHADO":
      return "azulOscuro";
    case "EN_PRODUCCION":
      return "azul";
    default:
      return "gris";
  }
}

export function TabProduccion({
  projectId,
  puedeEditar,
}: {
  projectId: string;
  puedeEditar: boolean;
}) {
  const [actas, setActas] = useState<ActaVanos[]>([]);
  const [dts, setDts] = useState<DT[]>([]);
  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formActa, setFormActa] = useState(false);
  const [formDT, setFormDT] = useState<string | null>(null); // actaVanosId
  const [formRemision, setFormRemision] = useState(false);
  const [recibiendo, setRecibiendo] = useState<string | null>(null);
  const [conObservacion, setConObservacion] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [a, d, r] = await Promise.all([
        api<{ actas: ActaVanos[] }>(`/api/projects/${projectId}/actas-vanos`),
        api<{ dts: DT[] }>(`/api/projects/${projectId}/dts`),
        api<{ remisiones: Remision[] }>(
          `/api/projects/${projectId}/remisiones`,
        ),
      ]);
      setActas(a.actas);
      setDts(d.dts);
      setRemisiones(r.remisiones);
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

  async function crearActa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await accion(() =>
      api(`/api/projects/${projectId}/actas-vanos`, {
        method: "POST",
        body: JSON.stringify({
          details: { descripcion: form.get("details") },
          surveyedAt: form.get("surveyedAt") || undefined,
          requiredDeliveryNotes: form.get("requiredDeliveryNotes") || undefined,
          priority: form.get("priority"),
        }),
      }),
    );
    setFormActa(false);
  }

  async function crearDT(e: FormEvent<HTMLFormElement>, actaId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await accion(() =>
      api(`/api/projects/${projectId}/dts`, {
        method: "POST",
        body: JSON.stringify({
          actaVanosId: actaId,
          despiece: { descripcion: form.get("despiece") },
          requiredDeliveryDate: form.get("requiredDeliveryDate"),
          priority: form.get("priority"),
        }),
      }),
    );
    setFormDT(null);
  }

  const terminados = dts.filter((d) => d.status === "TERMINADO");

  return (
    <div className="space-y-6">
      <MensajeError>{error}</MensajeError>

      {/* Actas de Vanos */}
      <Tarjeta className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Actas de Vanos</h2>
          {puedeEditar && (
            <BotonPrimario onClick={() => setFormActa((v) => !v)}>
              Levantar acta de vanos
            </BotonPrimario>
          )}
        </div>
        {formActa && (
          <form
            onSubmit={crearActa}
            className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-4"
          >
            <Campo etiqueta="Medidas y vanos (detalle)" ancho="col-span-2">
              <AreaTexto
                name="details"
                required
                rows={3}
                placeholder="Torre A: 24 vanos de 1.20x1.50, apertura derecha; 8 puertaventanas 2.00x2.20..."
              />
            </Campo>
            <Campo etiqueta="Fecha de levantamiento">
              <Entrada name="surveyedAt" type="date" />
            </Campo>
            <Campo etiqueta="Prioridad">
              <Selector name="priority" defaultValue="MEDIA">
                {Object.entries(PRIORIDADES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Fechas de entrega requeridas (notas)" ancho="col-span-2">
              <Entrada
                name="requiredDeliveryNotes"
                placeholder="Torre A completa antes del 15 de agosto"
              />
            </Campo>
            <div className="col-span-2 flex gap-2">
              <BotonPrimario type="submit">Guardar acta</BotonPrimario>
              <BotonSecundario type="button" onClick={() => setFormActa(false)}>
                Cancelar
              </BotonSecundario>
            </div>
          </form>
        )}
        {actas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            El supervisor aún no ha levantado actas de vanos.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {actas.map((a) => {
              const dias = diasDesde(a.surveyedAt);
              const dormida = a.dts.length === 0 && (dias ?? 0) > 7;
              return (
                <li key={a.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium">
                        Levantada el {fecha(a.surveyedAt)}
                      </span>{" "}
                      <span className="text-muted">
                        por {a.supervisor.name}
                      </span>
                      <span className="ml-2">
                        <Badge tono={tonoPrioridad(a.priority)}>
                          {PRIORIDADES[a.priority]}
                        </Badge>
                      </span>
                      {a.dts.length === 0 ? (
                        <Badge tono={dormida ? "rojo" : "naranja"}>
                          {dormida
                            ? `Sin DTs hace ${dias} días`
                            : "Pendiente de DTs"}
                        </Badge>
                      ) : (
                        <span className="ml-2 text-xs text-muted">
                          {a.dts.length} DT{a.dts.length !== 1 && "s"}
                        </span>
                      )}
                      {a.requiredDeliveryNotes && (
                        <p className="mt-1 text-xs text-accent-dark">
                          Entrega requerida: {a.requiredDeliveryNotes}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted">
                        {typeof a.details === "object" &&
                        a.details !== null &&
                        "descripcion" in a.details
                          ? String(
                              (a.details as { descripcion: string })
                                .descripcion,
                            )
                          : JSON.stringify(a.details)}
                      </p>
                    </div>
                    {puedeEditar && (
                      <BotonSecundario
                        onClick={() =>
                          setFormDT(formDT === a.id ? null : a.id)
                        }
                      >
                        Generar DT
                      </BotonSecundario>
                    )}
                  </div>
                  {formDT === a.id && (
                    <form
                      onSubmit={(e) => crearDT(e, a.id)}
                      className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-background p-3"
                    >
                      <Campo etiqueta="Despiece (material, cantidades, colores de vidrio)" ancho="col-span-3">
                        <AreaTexto
                          name="despiece"
                          required
                          rows={2}
                          placeholder="Perfil 5020 x 48 uds, vidrio bronce 4mm x 24 paños..."
                        />
                      </Campo>
                      <Campo etiqueta="Fecha de entrega requerida (obligatoria)">
                        <Entrada name="requiredDeliveryDate" type="date" required />
                      </Campo>
                      <Campo etiqueta="Prioridad">
                        <Selector name="priority" defaultValue={a.priority}>
                          {Object.entries(PRIORIDADES).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Selector>
                      </Campo>
                      <div className="flex items-end">
                        <BotonPrimario type="submit">Crear DT</BotonPrimario>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      {/* DTs */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Documentos Técnicos (DTs)</h2>
        {dts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin DTs generados.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2">DT</th>
                <th className="py-2">Entrega requerida</th>
                <th className="py-2">Prioridad</th>
                <th className="py-2">Estado</th>
                {puedeEditar && <th className="py-2">Avanzar</th>}
              </tr>
            </thead>
            <tbody>
              {dts.map((d) => {
                const atrasado =
                  d.status !== "DESPACHADO" &&
                  new Date(d.requiredDeliveryDate) < new Date();
                return (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono font-medium">{d.code}</td>
                    <td className={`py-2 ${atrasado ? "font-semibold text-danger" : ""}`}>
                      {fecha(d.requiredDeliveryDate)}
                      {atrasado && " · atrasado"}
                    </td>
                    <td className="py-2">
                      <Badge tono={tonoPrioridad(d.priority)}>
                        {PRIORIDADES[d.priority]}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge tono={tonoDT(d.status)}>
                        {ESTADOS_DT[d.status]}
                      </Badge>
                    </td>
                    {puedeEditar && (
                      <td className="py-2">
                        {d.status !== "DESPACHADO" ? (
                          <Selector
                            value={d.status}
                            onChange={(e) =>
                              accion(() =>
                                api(`/api/dts/${d.id}`, {
                                  method: "PUT",
                                  body: JSON.stringify({
                                    status: e.target.value,
                                  }),
                                }),
                              )
                            }
                            className="max-w-[170px]"
                          >
                            {Object.entries(ESTADOS_DT)
                              .filter(([v]) => v !== "DESPACHADO")
                              .map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                          </Selector>
                        ) : (
                          <span className="text-xs text-muted">
                            En remisión
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Tarjeta>

      {/* Remisiones */}
      <Tarjeta className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Remisiones (despachos a obra)</h2>
          {puedeEditar && terminados.length > 0 && (
            <BotonPrimario onClick={() => setFormRemision((v) => !v)}>
              Despachar terminados ({terminados.length})
            </BotonPrimario>
          )}
        </div>
        {formRemision && (
          <form
            className="mt-3 rounded-lg border border-border bg-background p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              await accion(() =>
                api(`/api/projects/${projectId}/remisiones`, {
                  method: "POST",
                  body: JSON.stringify({
                    destination: form.get("destination"),
                    dtIds: form.getAll("dts").map(String),
                  }),
                }),
              );
              setFormRemision(false);
            }}
          >
            <Campo etiqueta="Destino">
              <Entrada name="destination" required placeholder="Obra Torres del Río, Cali" />
            </Campo>
            <div className="mt-2 space-y-1">
              {terminados.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="dts"
                    value={d.id}
                    defaultChecked
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  <span className="font-mono">{d.code}</span>
                  <span className="text-xs text-muted">
                    entrega req. {fecha(d.requiredDeliveryDate)}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <BotonPrimario type="submit">Generar remisión</BotonPrimario>
              <BotonSecundario
                type="button"
                onClick={() => setFormRemision(false)}
              >
                Cancelar
              </BotonSecundario>
            </div>
          </form>
        )}
        {remisiones.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin despachos registrados.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {remisiones.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{r.destination}</span>
                    <span className="ml-2 text-xs text-muted">
                      {fechaHora(r.dispatchedAt)} ·{" "}
                      {r.dts.map((d) => d.code).join(", ")}
                    </span>
                    <span className="ml-2">
                      <Badge
                        tono={
                          r.status === "RECIBIDO_CONFORME"
                            ? "verde"
                            : r.status === "RECIBIDO_CON_OBSERVACIONES"
                              ? "rojo"
                              : "azul"
                        }
                      >
                        {ESTADOS_REMISION[r.status]}
                      </Badge>
                    </span>
                    {r.signedBy && (
                      <span className="ml-2 text-xs text-muted">
                        Firmó: {r.signedBy.name}
                      </span>
                    )}
                    {r.observations && (
                      <p className="mt-1 text-xs text-danger">
                        {r.observations}
                      </p>
                    )}
                  </div>
                  {puedeEditar && r.status === "DESPACHADO" && (
                    <BotonSecundario onClick={() => setRecibiendo(r.id)}>
                      Registrar recepción
                    </BotonSecundario>
                  )}
                </div>
                {recibiendo === r.id && (
                  <form
                    className="mt-3 space-y-3 rounded-lg bg-background p-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const conforme = form.get("conforme") === "si";
                      await accion(() =>
                        api(`/api/remisiones/${r.id}/recibir`, {
                          method: "POST",
                          body: JSON.stringify({
                            conforme,
                            observations: form.get("observations") || undefined,
                            ...(conforme
                              ? {}
                              : {
                                  retroceso: {
                                    tipo: form.get("tipoError"),
                                    descripcion:
                                      form.get("observations") ||
                                      "Devolución en obra",
                                  },
                                }),
                          }),
                        }),
                      );
                      setRecibiendo(null);
                      setConObservacion(false);
                    }}
                  >
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="conforme"
                          value="si"
                          defaultChecked
                          onChange={() => setConObservacion(false)}
                          className="accent-[var(--brand)]"
                        />
                        Recibido conforme
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="conforme"
                          value="no"
                          onChange={() => setConObservacion(true)}
                          className="accent-[var(--brand)]"
                        />
                        Con observaciones (genera retroceso)
                      </label>
                    </div>
                    {conObservacion && (
                      <div className="flex flex-wrap items-end gap-3">
                        <Campo etiqueta="Tipo de problema">
                          <Selector name="tipoError">
                            {Object.entries(TIPOS_ERROR).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </Selector>
                        </Campo>
                        <Campo etiqueta="Observaciones" ancho="flex-1">
                          <Entrada
                            name="observations"
                            required={conObservacion}
                            placeholder="Qué llegó mal y en qué cantidad"
                          />
                        </Campo>
                      </div>
                    )}
                    <BotonPrimario type="submit">
                      Firmar recepción
                    </BotonPrimario>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
