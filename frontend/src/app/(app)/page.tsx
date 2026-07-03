"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ESTADOS_ANTICIPO, ESTADOS_GARANTIA, ETAPAS } from "@/lib/etiquetas";
import { fecha, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  BarraProgreso,
  ContadorAnimado,
  Esqueleto,
  EsqueletoTabla,
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

type ProyectoFacturacion = Dashboard["facturacionPorProyecto"][number];

// Agrupa los proyectos por constructora con subtotales por moneda
function agruparPorCliente(proyectos: ProyectoFacturacion[]) {
  const mapa = new Map<string, ProyectoFacturacion[]>();
  for (const p of proyectos) {
    const lista = mapa.get(p.cliente) ?? [];
    lista.push(p);
    mapa.set(p.cliente, lista);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cliente, lista]) => {
      const porMoneda = new Map<string, { contrato: number; facturado: number }>();
      for (const p of lista) {
        const t = porMoneda.get(p.moneda) ?? { contrato: 0, facturado: 0 };
        t.contrato += p.monto ?? 0;
        t.facturado += p.facturado;
        porMoneda.set(p.moneda, t);
      }
      const totales = [...porMoneda.entries()].map(([moneda, t]) => ({
        moneda,
        ...t,
      }));
      const conMonto = totales.filter((t) => t.contrato > 0);
      const porcentaje =
        conMonto.length > 0
          ? (conMonto.reduce((s, t) => s + t.facturado, 0) /
              conMonto.reduce((s, t) => s + t.contrato, 0)) *
            100
          : null;
      return { cliente, proyectos: lista, totales, porcentaje };
    });
}

function FilaProyecto({
  p,
  conCliente = false,
  sangria = false,
}: {
  p: ProyectoFacturacion;
  conCliente?: boolean;
  sangria?: boolean;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={`px-4 py-3 ${sangria ? "pl-8" : ""}`}>
        <Link
          href={`/proyectos/${p.id}`}
          className="font-medium text-brand hover:underline"
        >
          {p.nombre}
        </Link>
        {p.atrasado && (
          <span className="block text-xs">
            <Badge tono="rojo">
              atrasado (est. {fecha(p.entregaEstimada)})
            </Badge>
          </span>
        )}
      </td>
      {conCliente && <td className="px-4 py-3 text-muted">{p.cliente}</td>}
      <td className="px-4 py-3">
        <Badge tono={tonoEtapa(p.etapa)}>{ETAPAS[p.etapa]}</Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {moneda(p.monto, p.moneda)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {moneda(p.facturado, p.moneda)}
      </td>
      <td className="px-4 py-3">
        {p.porcentaje !== null ? (
          <div className="flex items-center gap-2">
            <BarraProgreso pct={p.porcentaje} />
            <span className="w-12 text-right text-xs font-semibold">
              {porcentaje(p.porcentaje)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted">sin monto</span>
        )}
      </td>
    </tr>
  );
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
        {typeof valor === "number" ? <ContadorAnimado valor={valor} /> : valor}
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
  const [agrupar, setAgrupar] = useState(false);
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

      {!data && !error && (
        <>
          <div className="mt-5 grid grid-cols-3 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-4">
                <Esqueleto className="h-3 w-3/4" />
                <Esqueleto className="mt-3 h-8 w-12" />
              </div>
            ))}
          </div>
          <Tarjeta className="mt-6 overflow-hidden">
            <EsqueletoTabla filas={4} />
          </Tarjeta>
        </>
      )}

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
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">% de facturación por proyecto</h2>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={agrupar}
                  onChange={(e) => setAgrupar(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                Agrupar por constructora
              </label>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Proyecto</th>
                  {!agrupar && <th className="px-4 py-3">Constructora</th>}
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3 text-right">Contrato</th>
                  <th className="px-4 py-3 text-right">Facturado</th>
                  <th className="px-4 py-3 w-56">Avance</th>
                </tr>
              </thead>
              <tbody>
                {(agrupar
                  ? agruparPorCliente(data.facturacionPorProyecto)
                  : [null]
                ).map((grupo, gi) =>
                  grupo === null ? (
                    // Vista plana
                    data.facturacionPorProyecto.map((p) => (
                      <FilaProyecto key={p.id} p={p} conCliente />
                    ))
                  ) : (
                    <Fragment key={gi}>
                      <tr className="border-b border-border bg-brand-light/25">
                        <td className="px-4 py-2.5 font-semibold" colSpan={2}>
                          {grupo.cliente}
                          <span className="ml-2 text-xs font-normal text-muted">
                            {grupo.proyectos.length}{" "}
                            {grupo.proyectos.length === 1
                              ? "proyecto"
                              : "proyectos"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                          {grupo.totales.map((t) => (
                            <span key={t.moneda} className="block">
                              {moneda(t.contrato, t.moneda)}
                            </span>
                          ))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                          {grupo.totales.map((t) => (
                            <span key={t.moneda} className="block">
                              {moneda(t.facturado, t.moneda)}
                            </span>
                          ))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold">
                          {grupo.porcentaje !== null
                            ? porcentaje(grupo.porcentaje)
                            : "—"}
                        </td>
                      </tr>
                      {grupo.proyectos.map((p) => (
                        <FilaProyecto key={p.id} p={p} sangria />
                      ))}
                    </Fragment>
                  ),
                )}
                {data.facturacionPorProyecto.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
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
