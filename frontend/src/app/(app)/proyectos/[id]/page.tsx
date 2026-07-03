"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  EMPRESAS,
  ESTADOS_PROYECTO,
  ETAPAS,
  ORDEN_ETAPAS,
  ROLES_ASIGNACION,
} from "@/lib/etiquetas";
import { fecha, fechaHora, moneda } from "@/lib/formato";
import {
  Badge,
  BotonPrimario,
  BotonSecundario,
  Campo,
  Entrada,
  MensajeError,
  Selector,
  Tarjeta,
  tonoEtapa,
} from "@/components/ui";

interface UsuarioMin {
  id: string;
  name: string;
}

interface Proyecto {
  id: string;
  name: string;
  clientName: string;
  market: string;
  company: string;
  currency: string;
  costCenter: string | null;
  contractAmount: string | null;
  advancePercent: string | null;
  warrantyRetentionPercent: string | null;
  currentStage: string;
  status: string;
  type: string;
  startDate: string | null;
  estimatedEndDate: string | null;
  notes: string | null;
  earlyStartWithoutAdvance: boolean;
  earlyStartAuthorizedBy: UsuarioMin | null;
  parentProject: { id: string; name: string } | null;
  children: {
    id: string;
    name: string;
    currentStage: string;
    status: string;
    costCenter: string | null;
    contractAmount: string | null;
    currency: string;
  }[];
  assignments: { id: string; role: string; user: UsuarioMin }[];
  installerGroups: {
    id: string;
    isActive: boolean;
    group: { id: string; name: string };
  }[];
  stageHistory: {
    id: string;
    fromStage: string | null;
    toStage: string;
    reason: string | null;
    createdAt: string;
    changedBy: UsuarioMin;
  }[];
}

export default function ProyectoDetallePage() {
  const params = useParams<{ id: string }>();
  const { puede } = useAuth();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [motivoRetroceso, setMotivoRetroceso] = useState("");
  const [editandoEquipo, setEditandoEquipo] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioMin[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; name: string }[]>([]);

  const puedeEditar = puede("PROYECTOS", "editar");

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ project: Proyecto }>(
        `/api/projects/${params.id}`,
      );
      setProyecto(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!editandoEquipo) return;
    api<{ users: (UsuarioMin & { isActive: boolean })[] }>("/api/users")
      .then((d) => setUsuarios(d.users.filter((u) => u.isActive)))
      .catch(() => {});
    api<{ groups: { id: string; name: string }[] }>("/api/installer-groups")
      .then((d) => setGrupos(d.groups))
      .catch(() => {});
  }, [editandoEquipo]);

  async function cambiarEtapa(toStage: string, esRetroceso: boolean) {
    setError(null);
    try {
      await api(`/api/projects/${params.id}/etapa`, {
        method: "POST",
        body: JSON.stringify({
          toStage,
          reason: esRetroceso ? motivoRetroceso : undefined,
        }),
      });
      setMoviendo(null);
      setMotivoRetroceso("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar etapa.");
    }
  }

  async function guardarEquipo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const assignments = Object.keys(ROLES_ASIGNACION)
      .map((role) => ({ role, userId: form.get(`rol_${role}`) as string }))
      .filter((a) => a.userId);
    const installerGroupIds = form.getAll("grupos").map(String);
    try {
      await api(`/api/projects/${params.id}/equipo`, {
        method: "PUT",
        body: JSON.stringify({ assignments, installerGroupIds }),
      });
      setEditandoEquipo(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar equipo.");
    }
  }

  if (!proyecto) {
    return (
      <div>
        <MensajeError>{error}</MensajeError>
        <p className="text-sm text-muted">Cargando proyecto...</p>
      </div>
    );
  }

  const idxActual = ORDEN_ETAPAS.indexOf(proyecto.currentStage);
  const gruposActivos = proyecto.installerGroups.filter((g) => g.isActive);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link href="/proyectos" className="hover:text-brand hover:underline">
              Proyectos
            </Link>
            <span>/</span>
            {proyecto.parentProject && (
              <>
                <Link
                  href={`/proyectos/${proyecto.parentProject.id}`}
                  className="hover:text-brand hover:underline"
                >
                  {proyecto.parentProject.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span>{proyecto.name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {proyecto.name}
            {proyecto.type === "ADICIONAL" && (
              <span className="ml-3 align-middle">
                <Badge tono="naranja">Adicional</Badge>
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {proyecto.clientName} · {EMPRESAS[proyecto.company]} ·{" "}
            {proyecto.market === "CO" ? "Colombia" : "Estados Unidos"}
            {proyecto.costCenter && ` · Centro de costo ${proyecto.costCenter}`}
          </p>
        </div>
        <div className="text-right">
          <Badge tono={proyecto.status === "ACTIVO" ? "verde" : "gris"}>
            {ESTADOS_PROYECTO[proyecto.status]}
          </Badge>
          <p className="mt-2 font-mono text-sm">
            {moneda(proyecto.contractAmount, proyecto.currency)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <MensajeError>{error}</MensajeError>
      </div>

      {/* Línea de etapas */}
      <Tarjeta className="mt-4 p-5">
        <div className="flex items-center gap-1">
          {ORDEN_ETAPAS.map((etapa, i) => {
            const activa = etapa === proyecto.currentStage;
            const pasada = i < idxActual;
            return (
              <div key={etapa} className="flex flex-1 items-center gap-1">
                <button
                  disabled={!puedeEditar || activa}
                  onClick={() => setMoviendo(etapa)}
                  title={
                    activa
                      ? "Etapa actual"
                      : puedeEditar
                        ? `Mover a ${ETAPAS[etapa]}`
                        : undefined
                  }
                  className={`w-full rounded-lg px-2 py-2 text-center text-xs font-medium transition ${
                    activa
                      ? "bg-brand text-white shadow"
                      : pasada
                        ? "bg-brand-light/60 text-brand-dark dark:text-foreground"
                        : "bg-background text-muted hover:bg-brand-light/40"
                  } ${!puedeEditar || activa ? "cursor-default" : "cursor-pointer"}`}
                >
                  {ETAPAS[etapa]}
                </button>
                {i < ORDEN_ETAPAS.length - 1 && (
                  <span className="text-border">›</span>
                )}
              </div>
            );
          })}
        </div>

        {moviendo && (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            {ORDEN_ETAPAS.indexOf(moviendo) < idxActual ? (
              <>
                <p className="text-sm font-medium">
                  Devolver el proyecto a{" "}
                  <Badge tono={tonoEtapa(moviendo)}>{ETAPAS[moviendo]}</Badge>
                </p>
                <p className="mt-1 text-xs text-muted">
                  Los retrocesos quedan registrados con su motivo en el
                  historial.
                </p>
                <Entrada
                  className="mt-3"
                  placeholder="Motivo del retroceso (obligatorio)"
                  value={motivoRetroceso}
                  onChange={(e) => setMotivoRetroceso(e.target.value)}
                />
                <div className="mt-3 flex gap-2">
                  <BotonPrimario
                    disabled={!motivoRetroceso.trim()}
                    onClick={() => cambiarEtapa(moviendo, true)}
                  >
                    Confirmar retroceso
                  </BotonPrimario>
                  <BotonSecundario onClick={() => setMoviendo(null)}>
                    Cancelar
                  </BotonSecundario>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Avanzar el proyecto a{" "}
                  <Badge tono={tonoEtapa(moviendo)}>{ETAPAS[moviendo]}</Badge>
                </p>
                <div className="mt-3 flex gap-2">
                  <BotonPrimario onClick={() => cambiarEtapa(moviendo, false)}>
                    Confirmar
                  </BotonPrimario>
                  <BotonSecundario onClick={() => setMoviendo(null)}>
                    Cancelar
                  </BotonSecundario>
                </div>
              </>
            )}
          </div>
        )}
      </Tarjeta>

      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Equipo asignado */}
        <Tarjeta className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Equipo asignado</h2>
            {puedeEditar && (
              <button
                onClick={() => setEditandoEquipo((v) => !v)}
                className="text-xs font-medium text-brand hover:underline"
              >
                {editandoEquipo ? "Cancelar" : "Editar"}
              </button>
            )}
          </div>
          {!editandoEquipo ? (
            <dl className="mt-3 space-y-2 text-sm">
              {Object.entries(ROLES_ASIGNACION).map(([rol, etiqueta]) => {
                const asignacion = proyecto.assignments.find(
                  (a) => a.role === rol,
                );
                return (
                  <div key={rol} className="flex justify-between">
                    <dt className="text-muted">{etiqueta}</dt>
                    <dd className="font-medium">
                      {asignacion?.user.name ?? "Sin asignar"}
                    </dd>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted">Grupos de instaladores</dt>
                <dd className="text-right font-medium">
                  {gruposActivos.length > 0
                    ? gruposActivos.map((g) => g.group.name).join(", ")
                    : "Sin asignar"}
                </dd>
              </div>
            </dl>
          ) : (
            <form onSubmit={guardarEquipo} className="mt-3 space-y-3">
              {Object.entries(ROLES_ASIGNACION).map(([rol, etiqueta]) => (
                <Campo key={rol} etiqueta={etiqueta}>
                  <Selector
                    name={`rol_${rol}`}
                    defaultValue={
                      proyecto.assignments.find((a) => a.role === rol)?.user
                        .id ?? ""
                    }
                  >
                    <option value="">Sin asignar</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              ))}
              <Campo etiqueta="Grupos de instaladores">
                <div className="space-y-1 rounded-lg border border-border p-2">
                  {grupos.length === 0 && (
                    <p className="text-xs text-muted">
                      No hay grupos creados. Créalos en la sección Grupos.
                    </p>
                  )}
                  {grupos.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="grupos"
                        value={g.id}
                        defaultChecked={gruposActivos.some(
                          (ag) => ag.group.id === g.id,
                        )}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              </Campo>
              <BotonPrimario type="submit">Guardar equipo</BotonPrimario>
            </form>
          )}
        </Tarjeta>

        {/* Datos del proyecto */}
        <Tarjeta className="p-5">
          <h2 className="font-semibold">Datos del proyecto</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Monto de contrato</dt>
              <dd className="font-mono">
                {moneda(proyecto.contractAmount, proyecto.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">% de anticipo</dt>
              <dd>{proyecto.advancePercent ?? "—"}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">% retención garantías</dt>
              <dd>{proyecto.warrantyRetentionPercent ?? "—"}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Fecha de inicio</dt>
              <dd>{fecha(proyecto.startDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Entrega estimada</dt>
              <dd>{fecha(proyecto.estimatedEndDate)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="text-muted">Inicio sin anticipo</dt>
              <dd>
                {proyecto.earlyStartWithoutAdvance ? (
                  <span>
                    <Badge tono="naranja">Autorizado</Badge>
                    {proyecto.earlyStartAuthorizedBy && (
                      <span className="ml-1 text-xs text-muted">
                        por {proyecto.earlyStartAuthorizedBy.name}
                      </span>
                    )}
                  </span>
                ) : (
                  "No"
                )}
              </dd>
            </div>
          </dl>
          {puedeEditar && (
            <button
              onClick={async () => {
                try {
                  await api(`/api/projects/${proyecto.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                      earlyStartWithoutAdvance:
                        !proyecto.earlyStartWithoutAdvance,
                    }),
                  });
                  await cargar();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Error al guardar.",
                  );
                }
              }}
              className="mt-3 text-xs font-medium text-brand hover:underline"
            >
              {proyecto.earlyStartWithoutAdvance
                ? "Revocar autorización de inicio sin anticipo"
                : "Autorizar inicio sin anticipo (cliente de confianza)"}
            </button>
          )}
        </Tarjeta>
      </div>

      {/* Adicionales */}
      {proyecto.type === "PRINCIPAL" && (
        <Tarjeta className="mt-6 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Adicionales</h2>
            {puedeEditar && (
              <Link
                href={`/proyectos?nuevo=adicional&padre=${proyecto.id}`}
                className="text-xs font-medium text-brand hover:underline"
              >
                Crear adicional desde Proyectos
              </Link>
            )}
          </div>
          {proyecto.children.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Este proyecto no tiene adicionales.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {proyecto.children.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <Link
                    href={`/proyectos/${h.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {h.name}
                  </Link>
                  <span className="flex items-center gap-3">
                    {h.costCenter && (
                      <span className="text-xs text-muted">
                        CC {h.costCenter}
                      </span>
                    )}
                    <span className="font-mono text-xs">
                      {moneda(h.contractAmount, h.currency)}
                    </span>
                    <Badge tono={tonoEtapa(h.currentStage)}>
                      {ETAPAS[h.currentStage]}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      {/* Historial de etapas */}
      <Tarjeta className="mt-6 p-5">
        <h2 className="font-semibold">Historial de etapas</h2>
        <ul className="mt-3 space-y-2">
          {proyecto.stageHistory.map((h) => {
            const retroceso =
              h.fromStage &&
              ORDEN_ETAPAS.indexOf(h.toStage) <
                ORDEN_ETAPAS.indexOf(h.fromStage);
            return (
              <li key={h.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 text-xs text-muted whitespace-nowrap">
                  {fechaHora(h.createdAt)}
                </span>
                <span>
                  {h.fromStage ? (
                    <>
                      {retroceso ? "Devuelto" : "Avanzó"} de{" "}
                      <strong>{ETAPAS[h.fromStage]}</strong> a{" "}
                      <strong>{ETAPAS[h.toStage]}</strong>
                    </>
                  ) : (
                    <>
                      Creado en <strong>{ETAPAS[h.toStage]}</strong>
                    </>
                  )}{" "}
                  <span className="text-muted">por {h.changedBy.name}</span>
                  {h.reason && (
                    <span className="block text-xs text-muted">
                      Motivo: {h.reason}
                    </span>
                  )}
                  {retroceso && (
                    <Badge tono="rojo">Retroceso</Badge>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </div>
  );
}
