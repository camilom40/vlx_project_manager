"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ACCION_CONTRATO,
  CATEGORIAS_COMPRA,
  ESTADOS_ANTICIPO,
  ESTADOS_COMPRA,
  ESTADOS_CONTRATO,
  ESTADOS_POLIZA,
} from "@/lib/etiquetas";
import { fecha, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  BotonIcono,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Entrada,
  EntradaMoneda,
  EstadoVacio,
  IconoCheck,
  Interruptor,
  MensajeError,
  PuntoAccion,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface UsuarioMin {
  id: string;
  name: string;
}

interface Contrato {
  id: string;
  status: string;
  observations: string | null;
  deliveryTermDays: number | null;
  receivedAt: string | null;
  signedAt: string | null;
  reviewSubmittedAt: string | null;
  requiresPolicy: boolean;
  requiresAdvance: boolean;
  reviewedBy: UsuarioMin | null;
  reviewer: UsuarioMin | null;
  requiereAccion: boolean;
}

interface Poliza {
  id: string;
  type: string;
  insurer: string | null;
  status: string;
  value: string | null;
}

interface Anticipo {
  id: string;
  value: string;
  status: string;
  verifiedAt: string | null;
  verifiedBy: { name: string } | null;
}

interface Compra {
  id: string;
  supplier: string;
  category: string;
  obraPercent: string;
  status: string;
  expectedDeliveryAt: string | null;
  actualDeliveryAt: string | null;
}

// Estados de póliza que cuentan como "resuelta" para el candado de compras
const POLIZAS_RESUELTAS = new Set(["EXPEDIDA", "PAGADA", "ENVIADA_AL_CLIENTE"]);

export function TabContrato({
  projectId,
  currency,
  puedeEditarContrato,
  puedeEditarPolizas,
  puedeEditarAnticipos,
  puedeEditarCompras,
}: {
  projectId: string;
  currency: string;
  puedeEditarContrato: boolean;
  puedeEditarPolizas: boolean;
  puedeEditarAnticipos: boolean;
  puedeEditarCompras: boolean;
}) {
  const { usuario } = useAuth();
  const esGerencia = usuario?.teamName === "Gerencia";

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [asignables, setAsignables] = useState<UsuarioMin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rechazandoContrato, setRechazandoContrato] = useState<string | null>(
    null,
  );
  const [revisando, setRevisando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [c, p, a, co] = await Promise.all([
        api<{ contracts: Contrato[] }>(`/api/projects/${projectId}/contrato`),
        api<{ policies: Poliza[] }>(`/api/projects/${projectId}/polizas`),
        api<{ advances: Anticipo[] }>(`/api/projects/${projectId}/anticipos`),
        api<{ purchases: Compra[] }>(`/api/projects/${projectId}/compras`),
      ]);
      setContratos(c.contracts);
      setPolizas(p.policies);
      setAnticipos(a.advances);
      setCompras(co.purchases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [projectId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Usuarios para el selector de revisor (solo si puede asignar)
  useEffect(() => {
    if (!puedeEditarContrato) return;
    api<{ users: UsuarioMin[] }>("/api/users/asignables")
      .then((d) => setAsignables(d.users))
      .catch(() => {});
  }, [puedeEditarContrato]);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la operación.");
    }
  }

  async function crearPoliza(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const target = e.currentTarget;
    await accion(() =>
      api(`/api/projects/${projectId}/polizas`, {
        method: "POST",
        body: JSON.stringify({
          type: form.get("type"),
          insurer: form.get("insurer") || undefined,
          value: form.get("value") || undefined,
        }),
      }),
    );
    target.reset();
  }

  async function crearCompra(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const target = e.currentTarget;
    await accion(() =>
      api(`/api/projects/${projectId}/compras`, {
        method: "POST",
        body: JSON.stringify({
          supplier: form.get("supplier"),
          category: form.get("category"),
          obraPercent: form.get("obraPercent") || 0,
          expectedDeliveryAt: form.get("expectedDeliveryAt") || undefined,
        }),
      }),
    );
    target.reset();
  }

  // Estado agregado del candado de compras (para el mensaje del bloque Compras)
  const firmado = contratos.find((c) => c.status === "FIRMADO");
  const polizasResueltas =
    polizas.length > 0 && polizas.every((p) => POLIZAS_RESUELTAS.has(p.status));
  const anticipoVerificado = anticipos.some((a) => a.status === "VERIFICADO");
  const comprasHabilitadas =
    !!firmado &&
    (!firmado.requiresPolicy || polizasResueltas) &&
    (!firmado.requiresAdvance || anticipoVerificado);

  return (
    <div className="space-y-6">
      <MensajeError>{error}</MensajeError>

      {/* Contrato */}
      <Tarjeta className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Contrato</h2>
          {puedeEditarContrato && contratos.length === 0 && (
            <BotonPrimario
              onClick={() =>
                accion(() =>
                  api(`/api/projects/${projectId}/contrato`, {
                    method: "POST",
                    body: JSON.stringify({}),
                  }),
                )
              }
            >
              Registrar contrato recibido
            </BotonPrimario>
          )}
        </div>
        {contratos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Aún no se ha recibido contrato del cliente.
          </p>
        ) : (
          contratos.map((c) => {
            const soyRevisor = c.reviewer?.id === usuario?.id;
            return (
              <div
                key={c.id}
                className="mt-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-2">
                      <Badge
                        tono={
                          c.status === "FIRMADO"
                            ? "verde"
                            : c.status === "RECHAZADO_CON_OBSERVACIONES"
                              ? "rojo"
                              : c.status === "PENDIENTE_FIRMA"
                                ? "naranja"
                                : "azul"
                        }
                      >
                        {ESTADOS_CONTRATO[c.status]}
                      </Badge>
                      <PuntoAccion visible={c.requiereAccion} />
                    </span>
                    <span className="ml-2 text-sm text-muted">
                      Recibido {fecha(c.receivedAt)}
                      {c.deliveryTermDays &&
                        ` · Plazo de entrega: ${c.deliveryTermDays} días`}
                      {c.signedAt && ` · Firmado ${fecha(c.signedAt)}`}
                    </span>
                    <p className="mt-1 text-xs text-muted">
                      {ACCION_CONTRATO[c.status]}
                      {c.reviewer && ` · Revisor: ${c.reviewer.name}`}
                    </p>
                    {c.observations && (
                      <p className="mt-1 text-xs text-danger">
                        Observaciones: {c.observations}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* RECIBIDO → asignar revisor */}
                    {c.status === "RECIBIDO" &&
                      puedeEditarContrato &&
                      asignables.length > 0 && (
                        <form
                          className="flex items-end gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = new FormData(e.currentTarget);
                            await accion(() =>
                              api(
                                `/api/projects/${projectId}/contrato/${c.id}/asignar-revisor`,
                                {
                                  method: "POST",
                                  body: JSON.stringify({
                                    reviewerId: form.get("reviewerId"),
                                  }),
                                },
                              ),
                            );
                          }}
                        >
                          <Selector
                            name="reviewerId"
                            required
                            className="max-w-[220px]"
                          >
                            <option value="">Elegir revisor…</option>
                            {asignables.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </Selector>
                          <BotonPrimario type="submit">
                            Asignar revisor
                          </BotonPrimario>
                        </form>
                      )}

                    {/* EN_REVISION → el revisor edita o envía a firma */}
                    {c.status === "EN_REVISION" && soyRevisor && (
                      <>
                        <BotonSecundario onClick={() => setRevisando(c.id)}>
                          {revisando === c.id ? "Cerrar revisión" : "Revisar"}
                        </BotonSecundario>
                        <BotonPrimario
                          onClick={() =>
                            accion(() =>
                              api(`/api/contratos/${c.id}`, {
                                method: "PUT",
                                body: JSON.stringify({
                                  status: "PENDIENTE_FIRMA",
                                }),
                              }),
                            )
                          }
                        >
                          Enviar a firma
                        </BotonPrimario>
                      </>
                    )}

                    {/* PENDIENTE_FIRMA → Gerencia firma o rechaza */}
                    {c.status === "PENDIENTE_FIRMA" && esGerencia && (
                      <>
                        <BotonPrimario
                          onClick={() =>
                            accion(() =>
                              api(`/api/contratos/${c.id}`, {
                                method: "PUT",
                                body: JSON.stringify({ status: "FIRMADO" }),
                              }),
                            )
                          }
                        >
                          Firmar (Gerencia)
                        </BotonPrimario>
                        <BotonSecundario
                          onClick={() => setRechazandoContrato(c.id)}
                        >
                          Rechazar con observaciones
                        </BotonSecundario>
                      </>
                    )}

                    {/* RECHAZADO → el revisor reanuda la revisión */}
                    {c.status === "RECHAZADO_CON_OBSERVACIONES" &&
                      (soyRevisor || puedeEditarContrato) && (
                        <BotonSecundario
                          onClick={() =>
                            accion(() =>
                              api(`/api/contratos/${c.id}`, {
                                method: "PUT",
                                body: JSON.stringify({ status: "EN_REVISION" }),
                              }),
                            )
                          }
                        >
                          Reanudar revisión
                        </BotonSecundario>
                      )}
                  </div>
                </div>

                {/* Formulario de revisión (anticipo + pólizas requeridas) */}
                {revisando === c.id && soyRevisor && (
                  <FormularioRevision
                    contrato={c}
                    onGuardar={async (payload) => {
                      await accion(() =>
                        api(`/api/contratos/${c.id}/revision`, {
                          method: "PUT",
                          body: JSON.stringify(payload),
                        }),
                      );
                      setRevisando(null);
                    }}
                  />
                )}

                {/* Rechazo con observaciones */}
                {rechazandoContrato === c.id && (
                  <form
                    className="mt-3 flex items-end gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      await accion(() =>
                        api(`/api/contratos/${c.id}`, {
                          method: "PUT",
                          body: JSON.stringify({
                            status: "RECHAZADO_CON_OBSERVACIONES",
                            observations: form.get("observations"),
                          }),
                        }),
                      );
                      setRechazandoContrato(null);
                    }}
                  >
                    <Campo
                      etiqueta="Observaciones para el cliente"
                      ancho="flex-1"
                    >
                      <Entrada name="observations" required />
                    </Campo>
                    <BotonPrimario type="submit">Enviar rechazo</BotonPrimario>
                  </form>
                )}
              </div>
            );
          })
        )}
      </Tarjeta>

      {/* Pólizas */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Pólizas</h2>
        {puedeEditarPolizas && (
          <form
            onSubmit={crearPoliza}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <Campo etiqueta="Tipo de póliza">
              <Entrada name="type" required placeholder="Cumplimiento" />
            </Campo>
            <Campo etiqueta="Aseguradora">
              <Entrada name="insurer" placeholder="Opcional" />
            </Campo>
            <Campo etiqueta="Valor (opcional)">
              <Entrada name="value" type="number" min="0" step="0.01" />
            </Campo>
            <BotonPrimario type="submit">Agregar</BotonPrimario>
          </form>
        )}
        {polizas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin pólizas registradas.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2">Tipo</th>
                <th className="py-2">Aseguradora</th>
                <th className="py-2">Valor</th>
                <th className="py-2">Estado</th>
                {puedeEditarPolizas && <th className="py-2">Avanzar</th>}
              </tr>
            </thead>
            <tbody>
              {polizas.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{p.type}</td>
                  <td className="py-2 text-muted">{p.insurer ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">
                    {p.value ? (
                      moneda(p.value, currency)
                    ) : (
                      <Badge tono="naranja">Falta valor</Badge>
                    )}
                  </td>
                  <td className="py-2">
                    <Badge
                      tono={
                        p.status === "ENVIADA_AL_CLIENTE" ||
                        p.status === "EXPEDIDA" ||
                        p.status === "PAGADA"
                          ? "verde"
                          : "azul"
                      }
                    >
                      {ESTADOS_POLIZA[p.status]}
                    </Badge>
                  </td>
                  {puedeEditarPolizas && (
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Selector
                          value={p.status}
                          onChange={(e) =>
                            accion(() =>
                              api(`/api/polizas/${p.id}`, {
                                method: "PUT",
                                body: JSON.stringify({ status: e.target.value }),
                              }),
                            )
                          }
                          className="max-w-[190px]"
                        >
                          {Object.entries(ESTADOS_POLIZA).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Selector>
                        {!p.value && (
                          <form
                            className="flex items-center gap-1"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = new FormData(e.currentTarget);
                              await accion(() =>
                                api(`/api/polizas/${p.id}`, {
                                  method: "PUT",
                                  body: JSON.stringify({
                                    value: form.get("value"),
                                  }),
                                }),
                              );
                            }}
                          >
                            <Entrada
                              name="value"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Valor"
                              className="max-w-[120px]"
                            />
                            <BotonIcono etiqueta="Guardar valor" tono="brand">
                              <IconoCheck />
                            </BotonIcono>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>

      {/* Anticipos */}
      <Tarjeta className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Anticipos</h2>
          {puedeEditarAnticipos && (
            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const target = e.currentTarget;
                await accion(() =>
                  api(`/api/projects/${projectId}/anticipos`, {
                    method: "POST",
                    body: JSON.stringify({ value: form.get("value") }),
                  }),
                );
                target.reset();
              }}
            >
              <Entrada
                name="value"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="Valor del anticipo"
                className="max-w-[180px]"
              />
              <BotonPrimario type="submit">
                Generar cuenta de cobro
              </BotonPrimario>
            </form>
          )}
        </div>
        {anticipos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin anticipos registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {anticipos.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span className="font-mono font-semibold">
                  {moneda(a.value, currency)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tono={a.status === "VERIFICADO" ? "verde" : "naranja"}>
                    {ESTADOS_ANTICIPO[a.status]}
                  </Badge>
                  {a.verifiedAt && (
                    <span className="text-xs text-muted">
                      Verificado en banco por {a.verifiedBy?.name} el{" "}
                      {fecha(a.verifiedAt)}
                    </span>
                  )}
                  {puedeEditarAnticipos && a.status !== "VERIFICADO" && (
                    <Selector
                      value={a.status}
                      onChange={(e) =>
                        accion(() =>
                          api(`/api/anticipos/${a.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ status: e.target.value }),
                          }),
                        )
                      }
                      className="max-w-[220px]"
                    >
                      {Object.entries(ESTADOS_ANTICIPO).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Selector>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {/* Compras */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Compras de material</h2>
        {firmado ? (
          comprasHabilitadas ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-success">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              Compras habilitadas: se cumplen los requisitos de pólizas y
              anticipo del contrato.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Compras se habilita cuando
              {firmado.requiresPolicy && !polizasResueltas
                ? " las pólizas estén expedidas"
                : ""}
              {firmado.requiresPolicy &&
              !polizasResueltas &&
              firmado.requiresAdvance &&
              !anticipoVerificado
                ? " y"
                : ""}
              {firmado.requiresAdvance && !anticipoVerificado
                ? " el anticipo esté verificado"
                : ""}
              . También si Gerencia autoriza el inicio sin anticipo.
            </p>
          )
        ) : (
          <p className="mt-1 text-xs text-muted">
            Las compras se habilitan una vez firmado el contrato y cumplidos sus
            requisitos de pólizas y anticipo.
          </p>
        )}
        {puedeEditarCompras && (
          <form
            onSubmit={crearCompra}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <Campo etiqueta="Proveedor">
              <Entrada name="supplier" required placeholder="Alumina SAS" />
            </Campo>
            <Campo etiqueta="Categoría">
              <Selector name="category">
                {Object.entries(CATEGORIAS_COMPRA).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="% de la obra">
              <Entrada
                name="obraPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                className="max-w-[100px]"
              />
            </Campo>
            <Campo etiqueta="Entrega esperada">
              <Entrada name="expectedDeliveryAt" type="date" />
            </Campo>
            <BotonPrimario type="submit">Registrar compra</BotonPrimario>
          </form>
        )}
        {compras.length === 0 ? (
          <div className="mt-3">
            <EstadoVacio>Sin compras registradas para esta obra.</EstadoVacio>
          </div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2">Proveedor</th>
                <th className="py-2">Categoría</th>
                <th className="py-2">% obra</th>
                <th className="py-2">Esperada</th>
                <th className="py-2">Real</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => {
                const atrasada =
                  c.expectedDeliveryAt &&
                  !c.actualDeliveryAt &&
                  new Date(c.expectedDeliveryAt) < new Date();
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{c.supplier}</td>
                    <td className="py-2">{CATEGORIAS_COMPRA[c.category]}</td>
                    <td className="py-2">{porcentaje(c.obraPercent)}</td>
                    <td className={`py-2 ${atrasada ? "text-danger" : ""}`}>
                      {fecha(c.expectedDeliveryAt)}
                      {atrasada && " ⚠"}
                    </td>
                    <td className="py-2">
                      {c.actualDeliveryAt ? (
                        fecha(c.actualDeliveryAt)
                      ) : puedeEditarCompras ? (
                        <BotonIcono
                          etiqueta="Marcar entregada hoy"
                          tono="brand"
                          onClick={() =>
                            accion(() =>
                              api(`/api/compras/${c.id}`, {
                                method: "PUT",
                                body: JSON.stringify({
                                  actualDeliveryAt: new Date().toISOString(),
                                  status: "ENTREGADA",
                                }),
                              }),
                            )
                          }
                        >
                          <IconoCheck />
                        </BotonIcono>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      <Badge tono={c.status === "ENTREGADA" ? "verde" : "azul"}>
                        {ESTADOS_COMPRA[c.status]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Tarjeta>
    </div>
  );
}

// Formulario de revisión del contrato: el revisor define el valor del anticipo
// y las pólizas requeridas (nombre obligatorio, valor opcional), o marca que el
// contrato va sin anticipo / sin póliza.
function FormularioRevision({
  contrato,
  onGuardar,
}: {
  contrato: Contrato;
  onGuardar: (payload: {
    advanceValue: number | null;
    requiresAdvance: boolean;
    requiresPolicy: boolean;
    deliveryTermDays: number | null;
    polizas: { type: string; value: number | null }[];
  }) => Promise<void>;
}) {
  const [requiresAdvance, setRequiresAdvance] = useState(
    contrato.requiresAdvance,
  );
  const [requiresPolicy, setRequiresPolicy] = useState(contrato.requiresPolicy);
  const [advanceValue, setAdvanceValue] = useState<number | null>(null);
  const [polizasRev, setPolizasRev] = useState<
    { type: string; value: string }[]
  >([{ type: "", value: "" }]);

  function actualizarPoliza(i: number, campo: "type" | "value", valor: string) {
    setPolizasRev((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)),
    );
  }

  return (
    <form
      className="mt-4 space-y-4 rounded-lg border border-border bg-surface/60 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const dias = form.get("deliveryTermDays");
        await onGuardar({
          advanceValue: requiresAdvance ? advanceValue : null,
          requiresAdvance,
          requiresPolicy,
          deliveryTermDays: dias ? Number(dias) : null,
          polizas: requiresPolicy
            ? polizasRev
                .filter((p) => p.type.trim())
                .map((p) => ({
                  type: p.type.trim(),
                  value: p.value ? Number(p.value) : null,
                }))
            : [],
        });
      }}
    >
      <div className="flex flex-wrap gap-6">
        <Interruptor activo={requiresAdvance} onCambio={setRequiresAdvance}>
          Este contrato requiere anticipo
        </Interruptor>
        <Interruptor activo={requiresPolicy} onCambio={setRequiresPolicy}>
          Este contrato requiere pólizas
        </Interruptor>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {requiresAdvance && (
          <Campo etiqueta="Valor del anticipo">
            <EntradaMoneda
              name="advanceValue"
              onValorCambia={setAdvanceValue}
              placeholder="0"
            />
          </Campo>
        )}
        <Campo etiqueta="Plazo de entrega (días)">
          <Entrada
            name="deliveryTermDays"
            type="number"
            min="0"
            defaultValue={contrato.deliveryTermDays ?? undefined}
            className="max-w-[140px]"
          />
        </Campo>
      </div>

      {requiresPolicy && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Pólizas requeridas</p>
          {polizasRev.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Campo etiqueta="Tipo">
                <Entrada
                  value={p.type}
                  onChange={(e) => actualizarPoliza(i, "type", e.target.value)}
                  placeholder="Cumplimiento"
                />
              </Campo>
              <Campo etiqueta="Valor (opcional)">
                <Entrada
                  value={p.value}
                  onChange={(e) => actualizarPoliza(i, "value", e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="max-w-[160px]"
                />
              </Campo>
              {polizasRev.length > 1 && (
                <BotonSecundario
                  type="button"
                  onClick={() =>
                    setPolizasRev((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  Quitar
                </BotonSecundario>
              )}
            </div>
          ))}
          <BotonSecundario
            type="button"
            onClick={() =>
              setPolizasRev((prev) => [...prev, { type: "", value: "" }])
            }
          >
            + Agregar póliza
          </BotonSecundario>
        </div>
      )}

      <div>
        <BotonPrimario type="submit">Guardar revisión</BotonPrimario>
      </div>
    </form>
  );
}
