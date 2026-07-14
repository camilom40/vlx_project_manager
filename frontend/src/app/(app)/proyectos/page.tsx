"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  EMPRESAS,
  ESTADOS_PROYECTO,
  ETAPAS,
  TIPOS_PROYECTO,
} from "@/lib/etiquetas";
import { moneda } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Desplegable,
  Entrada,
  EsqueletoTabla,
  EstadoVacio,
  MensajeError,
  Selector,
  Tarjeta,
  tonoEtapa,
} from "@/components/ui";
import { SelectorCliente } from "@/components/SelectorCliente";

interface ProyectoResumen {
  id: string;
  name: string;
  clientName: string;
  market: string;
  company: string;
  currency: string;
  costCenter: string | null;
  contractAmount: string | null;
  currentStage: string;
  status: string;
  type: string;
  parentProject: { id: string; name: string } | null;
  _count: { children: number };
}

export default function ProyectosPage() {
  const { puede } = useAuth();
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState("PRINCIPAL");
  const [principales, setPrincipales] = useState<ProyectoResumen[]>([]);
  const [clienteSel, setClienteSel] = useState("");

  const puedeEditar = puede("PROYECTOS", "editar");

  const cargar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroEtapa) params.set("etapa", filtroEtapa);
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (buscar) params.set("buscar", buscar);
      const data = await api<{ projects: ProyectoResumen[] }>(
        `/api/projects?${params.toString()}`,
      );
      setProyectos(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    } finally {
      setCargando(false);
    }
  }, [filtroEtapa, filtroTipo, buscar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (mostrarForm) {
      api<{ projects: ProyectoResumen[] }>("/api/projects?tipo=PRINCIPAL")
        .then((d) => setPrincipales(d.projects))
        .catch(() => {});
    }
  }, [mostrarForm]);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          clientId: tipoNuevo !== "ADICIONAL" ? clienteSel || undefined : undefined,
          market: form.get("market"),
          company: form.get("company"),
          currency: form.get("currency"),
          type: form.get("type"),
          parentProjectId: form.get("parentProjectId") || undefined,
          costCenter: form.get("costCenter") || undefined,
          contractAmount: form.get("contractAmount") || undefined,
          startDate: form.get("startDate") || undefined,
        }),
      });
      setMostrarForm(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear.");
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
        {puedeEditar && (
          <BotonPrimario onClick={() => setMostrarForm((v) => !v)}>
            Nuevo proyecto
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
          <Campo etiqueta="Nombre del proyecto" ancho="col-span-2">
            <Entrada name="name" required placeholder="Torres del Parque — Etapa 2" />
          </Campo>
          <Campo etiqueta="Tipo">
            <Selector
              name="type"
              value={tipoNuevo}
              onChange={(e) => setTipoNuevo(e.target.value)}
            >
              {Object.entries(TIPOS_PROYECTO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Selector>
          </Campo>
          {tipoNuevo === "ADICIONAL" && (
            <Campo etiqueta="Proyecto principal" ancho="col-span-3">
              <Selector name="parentProjectId" required>
                <option value="">Selecciona el proyecto principal...</option>
                {principales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.clientName}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          {tipoNuevo === "ADICIONAL" ? (
            <Campo etiqueta="Cliente / constructora">
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted">
                Hereda el cliente del proyecto principal.
              </p>
            </Campo>
          ) : (
            <Campo etiqueta="Cliente / constructora">
              <SelectorCliente
                value={clienteSel}
                onChange={setClienteSel}
                onError={setError}
              />
            </Campo>
          )}
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
          <Campo etiqueta="Centro de costo">
            <Entrada name="costCenter" required placeholder="CC-0000" />
          </Campo>
          <Campo etiqueta="Monto de contrato (opcional)">
            <Entrada name="contractAmount" type="number" min="0" step="0.01" />
          </Campo>
          <Campo etiqueta="Fecha de inicio (opcional)">
            <Entrada name="startDate" type="date" />
          </Campo>
          <div className="col-span-3 flex gap-3">
            <BotonPrimario type="submit">Crear proyecto</BotonPrimario>
            <BotonSecundario type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </BotonSecundario>
          </div>
        </form>
      </Desplegable>

      <div className="mt-4 flex flex-wrap gap-3">
        <Entrada
          placeholder="Buscar por nombre o cliente..."
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className="max-w-xs"
        />
        <Selector
          value={filtroEtapa}
          onChange={(e) => setFiltroEtapa(e.target.value)}
          className="max-w-[180px]"
        >
          <option value="">Todas las etapas</option>
          {Object.entries(ETAPAS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Selector>
        <Selector
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="max-w-[160px]"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_PROYECTO).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Selector>
      </div>

      <Tarjeta className="mt-4 overflow-hidden">
        {cargando ? (
          <EsqueletoTabla filas={5} />
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Mercado</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 hover:bg-brand-light/20"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/proyectos/${p.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.type === "ADICIONAL" && p.parentProject && (
                    <span className="block text-xs text-muted">
                      Adicional de{" "}
                      <Link
                        href={`/proyectos/${p.parentProject.id}`}
                        className="text-accent-dark hover:underline"
                      >
                        {p.parentProject.name}
                      </Link>
                    </span>
                  )}
                  {p._count.children > 0 && (
                    <span className="block text-xs text-muted">
                      {p._count.children}{" "}
                      {p._count.children === 1 ? "adicional" : "adicionales"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{p.clientName}</td>
                <td className="px-4 py-3">
                  <Badge tono={tonoEtapa(p.currentStage)}>
                    {ETAPAS[p.currentStage]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tono={p.status === "ACTIVO" ? "verde" : "gris"}>
                    {ESTADOS_PROYECTO[p.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {moneda(p.contractAmount, p.currency)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {p.market === "CO" ? "Colombia" : "USA"}
                </td>
              </tr>
            ))}
            {proyectos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <EstadoVacio>
                    No hay proyectos que coincidan. Crea el primero con
                    &quot;Nuevo proyecto&quot;.
                  </EstadoVacio>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </Tarjeta>
    </div>
  );
}
