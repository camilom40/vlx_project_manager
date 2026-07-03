"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  CATEGORIAS_COMPRA,
  ESTADOS_ANTICIPO,
  ESTADOS_COMPRA,
  ESTADOS_CONTRATO,
  ESTADOS_POLIZA,
} from "@/lib/etiquetas";
import { fecha, moneda, porcentaje } from "@/lib/formato";
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

interface Contrato {
  id: string;
  status: string;
  observations: string | null;
  deliveryTermDays: number | null;
  receivedAt: string | null;
  signedAt: string | null;
  reviewedBy: { name: string } | null;
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

export function TabContrato({
  projectId,
  currency,
  puedeEditar,
}: {
  projectId: string;
  currency: string;
  puedeEditar: boolean;
}) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rechazandoContrato, setRechazandoContrato] = useState<string | null>(
    null,
  );

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

  return (
    <div className="space-y-6">
      <MensajeError>{error}</MensajeError>

      {/* Contrato */}
      <Tarjeta className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Contrato</h2>
          {puedeEditar && contratos.length === 0 && (
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
          contratos.map((c) => (
            <div key={c.id} className="mt-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Badge
                    tono={
                      c.status === "FIRMADO"
                        ? "verde"
                        : c.status === "RECHAZADO_CON_OBSERVACIONES"
                          ? "rojo"
                          : "azul"
                    }
                  >
                    {ESTADOS_CONTRATO[c.status]}
                  </Badge>
                  <span className="ml-2 text-sm text-muted">
                    Recibido {fecha(c.receivedAt)}
                    {c.deliveryTermDays &&
                      ` · Plazo de entrega: ${c.deliveryTermDays} días`}
                    {c.signedAt && ` · Firmado ${fecha(c.signedAt)}`}
                  </span>
                  {c.observations && (
                    <p className="mt-1 text-xs text-danger">
                      Observaciones: {c.observations}
                    </p>
                  )}
                </div>
                {puedeEditar && c.status !== "FIRMADO" && (
                  <div className="flex gap-2">
                    {c.status === "RECIBIDO" && (
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
                        Iniciar revisión
                      </BotonSecundario>
                    )}
                    {c.status === "EN_REVISION" && (
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
                    {c.status === "RECHAZADO_CON_OBSERVACIONES" && (
                      <BotonSecundario
                        onClick={() =>
                          accion(() =>
                            api(`/api/contratos/${c.id}`, {
                              method: "PUT",
                              body: JSON.stringify({ status: "RECIBIDO" }),
                            }),
                          )
                        }
                      >
                        Versión corregida recibida
                      </BotonSecundario>
                    )}
                  </div>
                )}
              </div>
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
          ))
        )}
      </Tarjeta>

      {/* Pólizas */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Pólizas</h2>
        {puedeEditar && (
          <form onSubmit={crearPoliza} className="mt-3 flex flex-wrap items-end gap-3">
            <Campo etiqueta="Tipo de póliza">
              <Entrada name="type" required placeholder="Cumplimiento" />
            </Campo>
            <Campo etiqueta="Aseguradora">
              <Entrada name="insurer" placeholder="Opcional" />
            </Campo>
            <Campo etiqueta="Valor">
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
                {puedeEditar && <th className="py-2">Avanzar</th>}
              </tr>
            </thead>
            <tbody>
              {polizas.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{p.type}</td>
                  <td className="py-2 text-muted">{p.insurer ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">
                    {moneda(p.value, currency)}
                  </td>
                  <td className="py-2">
                    <Badge
                      tono={p.status === "ENVIADA_AL_CLIENTE" ? "verde" : "azul"}
                    >
                      {ESTADOS_POLIZA[p.status]}
                    </Badge>
                  </td>
                  {puedeEditar && (
                    <td className="py-2">
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
                        className="max-w-[210px]"
                      >
                        {Object.entries(ESTADOS_POLIZA).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Selector>
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
          {puedeEditar && (
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
                  {puedeEditar && a.status !== "VERIFICADO" && (
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
        <p className="mt-1 text-xs text-muted">
          Las compras se habilitan cuando el anticipo está verificado, o si
          Gerencia autoriza el inicio sin anticipo.
        </p>
        {puedeEditar && (
          <form onSubmit={crearCompra} className="mt-3 flex flex-wrap items-end gap-3">
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
                      ) : puedeEditar ? (
                        <button
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
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Marcar entregada hoy
                        </button>
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
