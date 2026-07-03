"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fechaHora } from "@/lib/formato";
import {
  BotonSecundario,
  EstadoVacio,
  MensajeError,
  Tarjeta,
} from "@/components/ui";

interface Registro {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  metadata: Record<string, unknown> | null;
}

const ENTIDADES: Record<string, string> = {
  User: "Usuario",
  Team: "Equipo",
  Project: "Proyecto",
  Quote: "Cotización",
  Contract: "Contrato",
  Policy: "Póliza",
  Advance: "Anticipo",
  Purchase: "Compra",
  ActaVanos: "Acta de vanos",
  DT: "DT",
  Remision: "Remisión",
  ActaCorte: "Acta de corte",
  ActaEntrega: "Acta de entrega",
  ActaCierre: "Acta de cierre",
  Warranty: "Garantía",
  ReworkError: "Error/retrabajo",
  Task: "Tarea",
  InstallerGroup: "Grupo de instaladores",
  ProjectTemplate: "Plantilla",
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<Registro[]>([]);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ logs: Registro[]; paginas: number }>(
        `/api/audit?pagina=${pagina}`,
      );
      setLogs(data.logs);
      setPaginas(data.paginas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Auditoría del sistema
      </h1>
      <p className="mt-1 text-sm text-muted">
        Registro de quién hizo qué y cuándo: aprobaciones, cambios de etapa,
        ediciones y accesos.
      </p>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      <Tarjeta className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Fecha y hora</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Entidad</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted">
                  {fechaHora(l.createdAt)}
                </td>
                <td className="px-4 py-2.5">{l.user?.name ?? "Sistema"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {l.action.replaceAll("_", " ")}
                </td>
                <td className="px-4 py-2.5">{ENTIDADES[l.entity] ?? l.entity}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8">
                  <EstadoVacio>Sin registros de auditoría.</EstadoVacio>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>

      {paginas > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <BotonSecundario
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </BotonSecundario>
          <span className="text-sm text-muted">
            Página {pagina} de {paginas}
          </span>
          <BotonSecundario
            disabled={pagina >= paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </BotonSecundario>
        </div>
      )}
    </div>
  );
}
