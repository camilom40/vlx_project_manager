"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fecha, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  BarraProgreso,
  BotonPrimario,
  Campo,
  Entrada,
  MensajeError,
  Tarjeta,
} from "@/components/ui";

interface ActaCorte {
  id: string;
  section: string;
  invoicedValue: string;
  cutDate: string;
  advanceOffset: string;
  retentionApplied: string;
}

interface ActaEntrega {
  id: string;
  section: string;
  clientSignedName: string | null;
  deliveredAt: string;
  supervisor: { name: string };
}

interface Facturacion {
  facturado: number;
  montoContrato: number | null;
  porcentaje: number | null;
  anticipoCruzado: number;
  retencionAcumulada: number;
}

export function TabActas({
  projectId,
  currency,
  puedeEditar,
}: {
  projectId: string;
  currency: string;
  puedeEditar: boolean;
}) {
  const [cortes, setCortes] = useState<ActaCorte[]>([]);
  const [entregas, setEntregas] = useState<ActaEntrega[]>([]);
  const [cierre, setCierre] = useState<{ closedAt: string } | null>(null);
  const [fact, setFact] = useState<Facturacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{
        cortes: ActaCorte[];
        entregas: ActaEntrega[];
        cierre: { closedAt: string } | null;
        facturacion: Facturacion;
      }>(`/api/projects/${projectId}/actas`);
      setCortes(data.cortes);
      setEntregas(data.entregas);
      setCierre(data.cierre);
      setFact(data.facturacion);
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

  async function crearCorte(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const target = e.currentTarget;
    await accion(() =>
      api(`/api/projects/${projectId}/actas-corte`, {
        method: "POST",
        body: JSON.stringify({
          section: form.get("section"),
          invoicedValue: form.get("invoicedValue"),
          advanceOffset: form.get("advanceOffset") || 0,
          retentionApplied: form.get("retentionApplied") || 0,
          cutDate: form.get("cutDate") || undefined,
        }),
      }),
    );
    target.reset();
  }

  async function crearEntrega(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const target = e.currentTarget;
    await accion(() =>
      api(`/api/projects/${projectId}/actas-entrega`, {
        method: "POST",
        body: JSON.stringify({
          section: form.get("section"),
          clientSignedName: form.get("clientSignedName") || undefined,
        }),
      }),
    );
    target.reset();
  }

  return (
    <div className="space-y-6">
      <MensajeError>{error}</MensajeError>

      {/* Facturación */}
      {fact && (
        <Tarjeta className="p-5">
          <h2 className="font-semibold">Facturación del proyecto</h2>
          <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted">Facturado</p>
              <p className="mt-1 font-mono text-lg font-semibold">
                {moneda(fact.facturado, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">Monto contrato</p>
              <p className="mt-1 font-mono text-lg">
                {moneda(fact.montoContrato, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">Anticipo cruzado</p>
              <p className="mt-1 font-mono text-lg">
                {moneda(fact.anticipoCruzado, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">Retención acumulada</p>
              <p className="mt-1 font-mono text-lg">
                {moneda(fact.retencionAcumulada, currency)}
              </p>
            </div>
          </div>
          {fact.porcentaje !== null && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted">
                <span>% de facturación</span>
                <span className="font-semibold text-foreground">
                  {porcentaje(fact.porcentaje)}
                </span>
              </div>
              <div className="mt-1 flex">
                <BarraProgreso pct={fact.porcentaje} />
              </div>
            </div>
          )}
        </Tarjeta>
      )}

      {/* Actas de corte */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Actas de corte (facturación parcial)</h2>
        {puedeEditar && !cierre && (
          <form onSubmit={crearCorte} className="mt-3 flex flex-wrap items-end gap-3">
            <Campo etiqueta="Torre / sección">
              <Entrada name="section" required placeholder="Torre B" />
            </Campo>
            <Campo etiqueta="Valor facturado">
              <Entrada name="invoicedValue" type="number" min="0" step="0.01" required />
            </Campo>
            <Campo etiqueta="Cruce de anticipo">
              <Entrada name="advanceOffset" type="number" min="0" step="0.01" />
            </Campo>
            <Campo etiqueta="Retención aplicada">
              <Entrada name="retentionApplied" type="number" min="0" step="0.01" />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada name="cutDate" type="date" />
            </Campo>
            <BotonPrimario type="submit">Registrar corte</BotonPrimario>
          </form>
        )}
        {cortes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin actas de corte.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2">Sección</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Facturado</th>
                <th className="py-2">Cruce anticipo</th>
                <th className="py-2">Retención</th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{c.section}</td>
                  <td className="py-2">{fecha(c.cutDate)}</td>
                  <td className="py-2 font-mono text-xs">
                    {moneda(c.invoicedValue, currency)}
                  </td>
                  <td className="py-2 font-mono text-xs">
                    {moneda(c.advanceOffset, currency)}
                  </td>
                  <td className="py-2 font-mono text-xs">
                    {moneda(c.retentionApplied, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>

      {/* Actas de entrega */}
      <Tarjeta className="p-5">
        <h2 className="font-semibold">Actas de entrega (por torre/sección)</h2>
        {puedeEditar && !cierre && (
          <form onSubmit={crearEntrega} className="mt-3 flex flex-wrap items-end gap-3">
            <Campo etiqueta="Torre / sección">
              <Entrada name="section" required />
            </Campo>
            <Campo etiqueta="Firma del cliente (nombre)">
              <Entrada name="clientSignedName" placeholder="Ing. Roberto Paz" />
            </Campo>
            <BotonPrimario type="submit">Registrar entrega</BotonPrimario>
          </form>
        )}
        {entregas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin actas de entrega.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {entregas.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <span className="font-medium">{a.section}</span>
                <span className="text-xs text-muted">
                  {fecha(a.deliveredAt)} · Supervisor: {a.supervisor.name}
                  {a.clientSignedName
                    ? ` · Cliente firmó: ${a.clientSignedName}`
                    : " · Pendiente firma del cliente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {/* Acta de cierre */}
      <Tarjeta className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Acta de cierre</h2>
            {cierre ? (
              <p className="mt-1 text-sm">
                <Badge tono="verde">Proyecto cerrado</Badge>
                <span className="ml-2 text-muted">
                  el {fecha(cierre.closedAt)}. La garantía quedó creada con la
                  retención acumulada.
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Al cerrar el proyecto se crea automáticamente la garantía con
                la retención acumulada y su fecha estimada de trámite.
              </p>
            )}
          </div>
          {puedeEditar && !cierre && (
            <BotonPrimario
              onClick={() => {
                if (
                  window.confirm(
                    "¿Registrar el acta de cierre? Esto marca la obra como terminada y crea la garantía.",
                  )
                ) {
                  accion(() =>
                    api(`/api/projects/${projectId}/acta-cierre`, {
                      method: "POST",
                    }),
                  );
                }
              }}
            >
              Registrar acta de cierre
            </BotonPrimario>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}
