"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ESTADOS_GARANTIA } from "@/lib/etiquetas";
import { fecha, moneda } from "@/lib/formato";
import {
  Badge,
  MensajeError,
  Selector,
  Tarjeta,
} from "@/components/ui";

interface Garantia {
  id: string;
  retentionValue: string;
  workEndDate: string | null;
  estimatedProcessDate: string | null;
  status: string;
  alerta: string | null;
  responsible: { id: string; name: string } | null;
  project: { id: string };
}

export function TabGarantia({
  projectId,
  currency,
  puedeEditar,
}: {
  projectId: string;
  currency: string;
  puedeEditar: boolean;
}) {
  const [garantia, setGarantia] = useState<Garantia | null>(null);
  const [sinGarantia, setSinGarantia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ warranties: Garantia[] }>("/api/warranties");
      const w = data.warranties.find((x) => x.project.id === projectId);
      setGarantia(w ?? null);
      setSinGarantia(!w);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [projectId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="space-y-4">
      <MensajeError>{error}</MensajeError>
      {sinGarantia && (
        <Tarjeta className="p-5">
          <p className="text-sm text-muted">
            Este proyecto aún no tiene garantía. Se crea automáticamente al
            registrar el acta de cierre (los adicionales normalmente no
            requieren garantía).
          </p>
        </Tarjeta>
      )}
      {garantia && (
        <Tarjeta className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Garantía del proyecto</h2>
              <p className="mt-2 font-mono text-lg font-semibold">
                {moneda(garantia.retentionValue, currency)}
              </p>
              <p className="mt-1 text-sm text-muted">
                Obra terminada: {fecha(garantia.workEndDate)} · Trámite
                estimado: {fecha(garantia.estimatedProcessDate)}
                {garantia.alerta === "vencida" && (
                  <Badge tono="rojo">¡Fecha de trámite vencida!</Badge>
                )}
                {garantia.alerta === "proxima" && (
                  <Badge tono="naranja">Trámite próximo (30 días)</Badge>
                )}
              </p>
              <p className="mt-1 text-sm text-muted">
                Responsable (Tesorería):{" "}
                {garantia.responsible?.name ?? "Sin asignar"}
              </p>
            </div>
            <div className="text-right">
              <Badge
                tono={garantia.status === "COBRADA" ? "verde" : "naranja"}
              >
                {ESTADOS_GARANTIA[garantia.status]}
              </Badge>
              {puedeEditar && (
                <div className="mt-3">
                  <Selector
                    value={garantia.status}
                    onChange={async (e) => {
                      try {
                        await api(`/api/warranties/${garantia.id}`, {
                          method: "PUT",
                          body: JSON.stringify({ status: e.target.value }),
                        });
                        await cargar();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Error al actualizar.",
                        );
                      }
                    }}
                  >
                    {Object.entries(ESTADOS_GARANTIA).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Selector>
                </div>
              )}
            </div>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
