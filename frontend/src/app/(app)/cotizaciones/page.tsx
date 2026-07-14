"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  EMPRESAS,
  ESTADOS_COTIZACION,
  RAZONES_RECHAZO,
} from "@/lib/etiquetas";
import { diasDesde, moneda, porcentaje } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Desplegable,
  Entrada,
  EstadoVacio,
  Interruptor,
  MensajeError,
  Selector,
  Tarjeta,
  tonoCotizacion,
} from "@/components/ui";
import { SelectorCliente } from "@/components/SelectorCliente";
import { useAuth } from "@/lib/auth";

interface Cotizacion {
  id: string;
  title: string;
  clientName: string;
  currency: string;
  amount: string | null;
  marginPercent: string | null;
  status: string;
  receivedAt: string;
  sentAt: string | null;
  quoter: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  rejection: { reason: string } | null;
}

interface Asignable {
  id: string;
  name: string;
  isTeamLead: boolean;
}

interface Analitica {
  cotizadores: {
    id: string;
    nombre: string;
    total: number;
    enviadas: number;
    aceptadas: number;
    rechazadas: number;
    tasaConversion: number | null;
    tiempoPromedioEntregaDias: number | null;
    margenPromedio: number | null;
  }[];
  rechazosPorRazon: Record<string, number>;
  tiempoPromedioRespuestaClienteDias: number | null;
  tiempoPromedioAsignacionDias: number | null;
  tiempoPromedioCicloDias: number | null;
  sinAsignar: number;
  margenPromedioGlobal: number | null;
  totalCotizaciones: number;
}

export default function CotizacionesPage() {
  const { puede, usuario } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [analitica, setAnalitica] = useState<Analitica | null>(null);
  const [asignables, setAsignables] = useState<Asignable[]>([]);
  const [tab, setTab] = useState<"tablero" | "crm">("tablero");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [soloMias, setSoloMias] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteSel, setClienteSel] = useState("");
  const [asignando, setAsignando] = useState<Record<string, string>>({});

  const puedeEditar = puede("COTIZACIONES", "editar");
  const puedeAsignar = Boolean(
    usuario &&
      (usuario.teamName === "Gerencia" ||
        (usuario.isTeamLead && usuario.teamName === "Presupuesto")),
  );

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ quotes: Cotizacion[] }>("/api/quotes");
      setCotizaciones(data.quotes);
      if (puede("CRM")) {
        const a = await api<Analitica>("/api/quotes/analitica");
        setAnalitica(a);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [puede]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!puedeAsignar) return;
    api<{ users: Asignable[] }>("/api/quotes/asignables")
      .then((d) => setAsignables(d.users))
      .catch(() => {});
  }, [puedeAsignar]);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description") || undefined,
          clientId: clienteSel || undefined,
          contactName: form.get("contactName") || undefined,
          market: form.get("market"),
          company: form.get("company"),
          currency: form.get("currency"),
          receivedAt: form.get("receivedAt") || undefined,
        }),
      });
      setMostrarForm(false);
      setClienteSel("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar.");
    }
  }

  async function asignar(quoteId: string, quoterId: string) {
    setError(null);
    if (!quoterId) {
      setError("Selecciona el cotizador responsable.");
      return;
    }
    try {
      await api(`/api/quotes/${quoteId}/asignar`, {
        method: "POST",
        body: JSON.stringify({ quoterId }),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar.");
    }
  }

  const porAsignar = cotizaciones.filter((q) => q.status === "INGRESADA");

  const filtradas = cotizaciones.filter((q) => {
    if (filtroEstado && q.status !== filtroEstado) return false;
    if (soloMias && q.quoter?.id !== usuario?.id) return false;
    if (filtroResponsable && q.quoter?.id !== filtroResponsable) return false;
    return true;
  });

  // Pendientes de respuesta ordenadas por días transcurridos (vista CRM)
  const pendientes = cotizaciones
    .filter((q) => ["ENVIADA", "SIN_RESPUESTA"].includes(q.status) && q.sentAt)
    .sort(
      (a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime(),
    );

  const responsables = Array.from(
    new Map(
      cotizaciones
        .filter((q) => q.quoter)
        .map((q) => [q.quoter!.id, q.quoter!]),
    ).values(),
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
        {puedeEditar && (
          <BotonPrimario onClick={() => setMostrarForm((v) => !v)}>
            Nueva cotización
          </BotonPrimario>
        )}
      </div>

      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      <Desplegable abierto={mostrarForm}>
        <form
          onSubmit={crear}
          className="mt-4 grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <Campo etiqueta="Título / obra" ancho="col-span-2">
            <Entrada
              name="title"
              required
              placeholder="Torres del Parque — Fachada norte"
            />
          </Campo>
          <Campo etiqueta="Fecha de ingreso">
            <Entrada
              name="receivedAt"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Campo>
          <Campo etiqueta="Cliente / constructora">
            <SelectorCliente
              value={clienteSel}
              onChange={setClienteSel}
              onError={setError}
            />
          </Campo>
          <Campo etiqueta="Persona de contacto">
            <Entrada name="contactName" placeholder="Nombre de quien solicita" />
          </Campo>
          <Campo etiqueta="Mercado">
            <Selector name="market" defaultValue="CO">
              <option value="CO">Colombia</option>
              <option value="USA">Estados Unidos</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Empresa comercial">
            <Selector name="company" defaultValue="VITRALUX">
              {Object.entries(EMPRESAS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Moneda">
            <Selector name="currency" defaultValue="COP">
              <option value="COP">COP — Peso colombiano</option>
              <option value="USD">USD — Dólar</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Descripción (opcional)" ancho="col-span-2">
            <Entrada
              name="description"
              placeholder="Alcance, sistema, observaciones del cliente..."
            />
          </Campo>
          <div className="col-span-3 flex gap-3">
            <BotonPrimario type="submit">Registrar cotización</BotonPrimario>
            <BotonSecundario type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </BotonSecundario>
          </div>
        </form>
      </Desplegable>

      {/* Pestañas: tablero operativo y CRM/analítica */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        <button
          onClick={() => setTab("tablero")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
            tab === "tablero"
              ? "border border-b-0 border-border bg-surface text-brand"
              : "text-muted hover:text-foreground"
          }`}
        >
          Tablero
        </button>
        {puede("CRM") && (
          <button
            onClick={() => setTab("crm")}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              tab === "crm"
                ? "border border-b-0 border-border bg-surface text-brand"
                : "text-muted hover:text-foreground"
            }`}
          >
            CRM y analítica
          </button>
        )}
      </div>

      {tab === "tablero" && (
        <>
          {/* Bandeja: ingresadas por asignar */}
          {porAsignar.length > 0 && (
            <Tarjeta className="mt-4 p-5">
              <h2 className="text-sm font-semibold">
                Por asignar ({porAsignar.length})
              </h2>
              <ul className="mt-3 space-y-2">
                {porAsignar.map((q) => {
                  const dias = diasDesde(q.receivedAt) ?? 0;
                  return (
                    <li
                      key={q.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <span>
                        <Link
                          href={`/cotizaciones/${q.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {q.title}
                        </Link>
                        <span className="ml-2 text-muted">{q.clientName}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tono={dias > 7 ? "rojo" : dias > 3 ? "naranja" : "azul"}>
                          {dias === 0
                            ? "Hoy"
                            : `${dias} ${dias === 1 ? "día" : "días"} sin asignar`}
                        </Badge>
                        {puedeAsignar && (
                          <>
                            <Selector
                              value={asignando[q.id] ?? ""}
                              onChange={(e) =>
                                setAsignando((m) => ({
                                  ...m,
                                  [q.id]: e.target.value,
                                }))
                              }
                              className="max-w-[190px]"
                            >
                              <option value="">Responsable...</option>
                              {asignables.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </Selector>
                            <BotonPrimario
                              onClick={() => asignar(q.id, asignando[q.id] ?? "")}
                            >
                              Asignar
                            </BotonPrimario>
                            <BotonSecundario
                              onClick={() => asignar(q.id, usuario!.id)}
                            >
                              Asignarme a mí
                            </BotonSecundario>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          )}

          {/* Todas */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Todas las cotizaciones</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Interruptor activo={soloMias} onCambio={setSoloMias}>
                Solo las mías
              </Interruptor>
              <div className="w-48">
                <Selector
                  value={filtroResponsable}
                  onChange={(e) => setFiltroResponsable(e.target.value)}
                >
                  <option value="">Todos los responsables</option>
                  {responsables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Selector>
              </div>
              <div className="w-48">
                <Selector
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADOS_COTIZACION).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Selector>
              </div>
            </div>
          </div>
          <Tarjeta className="mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Cotización</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Días desde ingreso</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((q) => {
                  const dias = diasDesde(q.receivedAt);
                  return (
                    <tr
                      key={q.id}
                      className="border-b border-border last:border-0 hover:bg-brand-light/20"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/cotizaciones/${q.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {q.title}
                        </Link>
                        <span className="block text-xs text-muted">
                          {q.clientName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {q.quoter?.name ?? (
                          <span className="text-muted">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {moneda(q.amount, q.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tono={tonoCotizacion(q.status)}>
                          {ESTADOS_COTIZACION[q.status]}
                        </Badge>
                        {q.rejection && (
                          <span className="block text-xs text-muted">
                            {RAZONES_RECHAZO[q.rejection.reason]}
                          </span>
                        )}
                        {q.project && (
                          <Link
                            href={`/proyectos/${q.project.id}`}
                            className="block text-xs text-accent-dark hover:underline"
                          >
                            Proyecto: {q.project.name}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {dias !== null
                          ? `${dias} ${dias === 1 ? "día" : "días"}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EstadoVacio>
                        No hay cotizaciones que coincidan. Registra la primera
                        con &quot;Nueva cotización&quot;.
                      </EstadoVacio>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}

      {tab === "crm" && analitica && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-4">
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">Total cotizaciones</p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.totalCotizaciones}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">Margen promedio</p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.margenPromedioGlobal !== null
                  ? porcentaje(analitica.margenPromedioGlobal)
                  : "—"}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">
                Respuesta del cliente (prom.)
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.tiempoPromedioRespuestaClienteDias !== null
                  ? `${analitica.tiempoPromedioRespuestaClienteDias.toFixed(1)} días`
                  : "—"}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">
                En espera de respuesta
              </p>
              <p className="mt-1 text-2xl font-semibold">{pendientes.length}</p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">
                Tiempo prom. de asignación
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.tiempoPromedioAsignacionDias !== null
                  ? `${analitica.tiempoPromedioAsignacionDias.toFixed(1)} días`
                  : "—"}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">
                Ciclo ingreso → envío (prom.)
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.tiempoPromedioCicloDias !== null
                  ? `${analitica.tiempoPromedioCicloDias.toFixed(1)} días`
                  : "—"}
              </p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-xs uppercase text-muted">Sin asignar</p>
              <p className="mt-1 text-2xl font-semibold">
                {analitica.sinAsignar}
              </p>
            </Tarjeta>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">Analítica por cotizador</h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2">Cotizador</th>
                    <th className="py-2">Total</th>
                    <th className="py-2">Conversión</th>
                    <th className="py-2">Entrega prom.</th>
                    <th className="py-2">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {analitica.cotizadores.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2 font-medium">{c.nombre}</td>
                      <td className="py-2">{c.total}</td>
                      <td className="py-2">
                        {c.tasaConversion !== null
                          ? porcentaje(c.tasaConversion * 100)
                          : "—"}
                      </td>
                      <td className="py-2">
                        {c.tiempoPromedioEntregaDias !== null
                          ? `${c.tiempoPromedioEntregaDias.toFixed(1)} d`
                          : "—"}
                      </td>
                      <td className="py-2">
                        {c.margenPromedio !== null
                          ? porcentaje(c.margenPromedio)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
            <Tarjeta className="p-5">
              <h2 className="text-sm font-semibold">Rechazos por razón</h2>
              {Object.keys(analitica.rechazosPorRazon).length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Sin rechazos registrados.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(analitica.rechazosPorRazon).map(
                    ([razon, count]) => (
                      <li key={razon} className="flex justify-between">
                        <span>{RAZONES_RECHAZO[razon] ?? razon}</span>
                        <span className="font-semibold">{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </Tarjeta>
          </div>

          {/* Pendientes ordenadas por días */}
          {pendientes.length > 0 && (
            <Tarjeta className="mt-4 p-5">
              <h2 className="text-sm font-semibold">
                Pendientes de respuesta (más antiguas primero)
              </h2>
              <ul className="mt-3 space-y-2">
                {pendientes.map((q) => {
                  const dias = diasDesde(q.sentAt)!;
                  return (
                    <li
                      key={q.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <span>
                        <Link
                          href={`/cotizaciones/${q.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {q.title}
                        </Link>
                        <span className="ml-2 text-muted">{q.clientName}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-xs">
                          {moneda(q.amount, q.currency)}
                        </span>
                        <Badge
                          tono={dias > 15 ? "rojo" : dias > 7 ? "naranja" : "azul"}
                        >
                          {dias} {dias === 1 ? "día" : "días"} esperando
                        </Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          )}
        </>
      )}
    </div>
  );
}
