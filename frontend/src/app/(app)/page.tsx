"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ESTADOS_ANTICIPO, ESTADOS_GARANTIA, ETAPAS } from "@/lib/etiquetas";
import { fecha, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  EstadoVacio,
  MensajeError,
  Tarjeta,
  tonoEtapa,
} from "@/components/ui";

interface Dashboard {
  proyectosActivos: number;
  facturacionPorProyecto: {
    id: string;
    nombre: string;
    cliente: string;
    moneda: string;
    etapa: string;
    tipo: string;
    monto: number | null;
    facturado: number;
    porcentaje: number | null;
    atrasado: boolean;
    entregaEstimada: string | null;
  }[];
  anticipos: {
    porEstado: Record<string, { cantidad: number; total: number }>;
    pendientesVerificar: number;
  };
  garantias: {
    pendientes: number;
    vencidas: number;
    lista: {
      id: string;
      retentionValue: string;
      estimatedProcessDate: string | null;
      status: string;
      project: { id: string; name: string; currency: string };
    }[];
  };
  cuellosDeBotella: {
    actasSinDts: number;
    dtsAtrasados: number;
    cotizacionesEsperandoMas15Dias: number;
  };
  erroresPorPersona: { nombre: string; total: number }[];
}

function KPI({
  etiqueta,
  valor,
  alerta,
  href,
}: {
  etiqueta: string;
  valor: string | number;
  alerta?: boolean;
  href?: string;
}) {
  const contenido = (
    <div className="glass flex h-full flex-col rounded-2xl p-4 transition hover:-translate-y-0.5">
      <p className="min-h-[2.6em] text-[11px] font-semibold uppercase leading-[1.3] tracking-wider text-muted">
        {etiqueta}
      </p>
      <p
        className={`mt-auto text-3xl font-semibold tracking-tight ${
          alerta ? "text-danger" : ""
        }`}
      >
        {valor}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="h-full">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}

export default function InicioPage() {
  const { usuario, puede } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const esGerencial = puede("DASHBOARD_GERENCIAL");

  const cargar = useCallback(async () => {
    if (!esGerencial) return;
    try {
      const d = await api<Dashboard>("/api/dashboard/gerencial");
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [esGerencial]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!esGerencial) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {usuario?.name?.split(" ")[0]}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Bienvenido al gestor de proyectos de Vitralux y VLX Windows. Usa el
          menú de la izquierda para entrar a tus módulos; en Notificaciones
          verás cuándo el balón pasa a tu cancha.
        </p>
      </div>
    );
  }

  const cuellos = data?.cuellosDeBotella;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Panel gerencial
      </h1>
      <p className="mt-1 text-sm text-muted">
        Visión global de la operación: facturación, anticipos, atrasos,
        garantías y cuellos de botella.
      </p>
      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {data && (
        <>
          {/* KPIs (marcos de vidrio) */}
          <div className="mt-5 grid grid-cols-3 gap-4 lg:grid-cols-6">
            <KPI
              etiqueta="Proyectos activos"
              valor={data.proyectosActivos}
              href="/proyectos"
            />
            <KPI
              etiqueta="Proyectos atrasados"
              valor={data.facturacionPorProyecto.filter((p) => p.atrasado).length}
              alerta={data.facturacionPorProyecto.some((p) => p.atrasado)}
              href="/proyectos"
            />
            <KPI
              etiqueta="Actas sin DTs"
              valor={cuellos?.actasSinDts ?? 0}
              alerta={(cuellos?.actasSinDts ?? 0) > 0}
              href="/produccion"
            />
            <KPI
              etiqueta="DTs atrasados"
              valor={cuellos?.dtsAtrasados ?? 0}
              alerta={(cuellos?.dtsAtrasados ?? 0) > 0}
              href="/produccion"
            />
            <KPI
              etiqueta="Cotiz. sin respuesta +15 días"
              valor={cuellos?.cotizacionesEsperandoMas15Dias ?? 0}
              alerta={(cuellos?.cotizacionesEsperandoMas15Dias ?? 0) > 0}
              href="/cotizaciones"
            />
            <KPI
              etiqueta="Garantías vencidas"
              valor={data.garantias.vencidas}
              alerta={data.garantias.vencidas > 0}
              href="/garantias"
            />
          </div>

          {/* Facturación por proyecto */}
          <Tarjeta className="mt-6 overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold">% de facturación por proyecto</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Facturado</th>
                  <th className="px-4 py-3 w-56">Avance</th>
                </tr>
              </thead>
              <tbody>
                {data.facturacionPorProyecto.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/proyectos/${p.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {p.nombre}
                      </Link>
                      <span className="block text-xs text-muted">
                        {p.cliente}
                        {p.atrasado && (
                          <span className="ml-2">
                            <Badge tono="rojo">
                              atrasado (est. {fecha(p.entregaEstimada)})
                            </Badge>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tono={tonoEtapa(p.etapa)}>{ETAPAS[p.etapa]}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {moneda(p.monto, p.moneda)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {moneda(p.facturado, p.moneda)}
                    </td>
                    <td className="px-4 py-3">
                      {p.porcentaje !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{
                                width: `${Math.min(100, p.porcentaje)}%`,
                              }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-semibold">
                            {porcentaje(p.porcentaje)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">sin monto</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.facturacionPorProyecto.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EstadoVacio>No hay proyectos activos.</EstadoVacio>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Tarjeta>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {/* Anticipos */}
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">Anticipos</h2>
              {Object.keys(data.anticipos.porEstado).length === 0 ? (
                <p className="mt-3 text-sm text-muted">Sin anticipos.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(data.anticipos.porEstado).map(([estado, v]) => (
                    <li key={estado} className="flex justify-between">
                      <span
                        className={
                          estado !== "VERIFICADO" ? "text-accent-dark" : ""
                        }
                      >
                        {ESTADOS_ANTICIPO[estado] ?? estado}
                      </span>
                      <span className="font-semibold">{v.cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            {/* Garantías próximas */}
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">
                Garantías pendientes de cobrar
              </h2>
              {data.garantias.lista.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No hay garantías pendientes.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {data.garantias.lista.map((g) => (
                    <li key={g.id} className="flex justify-between gap-2">
                      <Link
                        href={`/proyectos/${g.project.id}`}
                        className="truncate text-brand hover:underline"
                      >
                        {g.project.name}
                      </Link>
                      <span className="whitespace-nowrap text-xs text-muted">
                        {ESTADOS_GARANTIA[g.status]} ·{" "}
                        {moneda(g.retentionValue, g.project.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            {/* Errores por persona */}
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">Errores por persona</h2>
              {data.erroresPorPersona.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Sin errores registrados.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {data.erroresPorPersona.slice(0, 6).map((e, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{e.nombre}</span>
                      <span className="font-semibold">{e.total}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/errores"
                className="mt-3 block text-xs font-medium text-brand hover:underline"
              >
                Ver módulo de errores
              </Link>
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  );
}
