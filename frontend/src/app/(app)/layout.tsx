"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { InterruptorAnimaciones } from "@/components/ui";

const NAV_GRUPOS: {
  titulo: string | null;
  items: { href: string; label: string; modulo: string }[];
}[] = [
  {
    titulo: null,
    items: [
      { href: "/", label: "Inicio", modulo: "" },
      { href: "/notificaciones", label: "Notificaciones", modulo: "" },
    ],
  },
  {
    titulo: "Operación",
    items: [
      { href: "/proyectos", label: "Proyectos", modulo: "PROYECTOS" },
      { href: "/clientes", label: "Clientes", modulo: "CLIENTES" },
      { href: "/cotizaciones", label: "Cotizaciones", modulo: "COTIZACIONES" },
      { href: "/produccion", label: "Producción", modulo: "PRODUCCION" },
      { href: "/garantias", label: "Garantías", modulo: "GARANTIAS" },
      { href: "/errores", label: "Errores y retrabajos", modulo: "ERRORES" },
      { href: "/carga", label: "Carga de trabajo", modulo: "PROYECTOS" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/plantillas", label: "Plantillas", modulo: "PLANTILLAS" },
      { href: "/usuarios", label: "Usuarios", modulo: "USUARIOS" },
      { href: "/equipos", label: "Equipos", modulo: "EQUIPOS" },
      { href: "/grupos", label: "Grupos de instaladores", modulo: "EQUIPOS" },
      { href: "/auditoria", label: "Auditoría", modulo: "AUDITORIA" },
    ],
  },
];

// Qué contadores de pendientes muestra cada entrada del menú (por ruta, para
// no repetir el badge en items que comparten módulo, como Carga de trabajo).
// Proyectos agrega los pendientes de etapas internas sin menú propio (contrato).
const PENDIENTES_POR_RUTA: Record<string, string[]> = {
  "/proyectos": ["PROYECTOS", "CONTRATOS"],
  "/cotizaciones": ["COTIZACIONES"],
  "/produccion": ["PRODUCCION"],
  "/garantias": ["GARANTIAS"],
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario, cargando, cerrarSesion, puede } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sinLeer, setSinLeer] = useState(0);
  const [pendientes, setPendientes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (cargando) return;
    if (!usuario) {
      router.replace("/login");
    } else if (usuario.mustChangePassword) {
      router.replace("/cambiar-password");
    }
  }, [usuario, cargando, router]);

  // Contador de notificaciones sin leer (se refresca al navegar y cada minuto)
  useEffect(() => {
    if (!usuario) return;
    let activo = true;
    const consultar = () =>
      api<{ unread: number }>("/api/notifications")
        .then((d) => activo && setSinLeer(d.unread))
        .catch(() => {});
    consultar();
    const intervalo = setInterval(consultar, 60000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [usuario, pathname]);

  // Contador de pendientes por módulo (Cotizaciones, Producción, Garantías)
  useEffect(() => {
    if (!usuario) return;
    let activo = true;
    const consultar = () =>
      api<{ pendientes: Record<string, number> }>("/api/pendientes")
        .then((d) => activo && setPendientes(d.pendientes))
        .catch(() => {});
    consultar();
    const intervalo = setInterval(consultar, 60000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [usuario, pathname]);

  if (cargando || !usuario || usuario.mustChangePassword) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Cargando...</p>
      </main>
    );
  }

  const grupos = NAV_GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.modulo === "" || puede(item.modulo)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 flex h-screen w-60 flex-col">
        <div className="border-b border-border/60 px-5 py-5">
          <Image
            src="/logo-vitralux.png"
            alt="Vitralux Windows"
            width={150}
            height={45}
            priority
            unoptimized
            className="dark:brightness-0 dark:invert-[0.92]"
          />
          <span className="mt-2 block text-[10px] font-medium tracking-[0.3em] text-brand">
            GESTOR DE PROYECTOS
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {grupos.map((grupo, gi) => (
            <div key={gi} className={gi > 0 ? "mt-5" : ""}>
              {grupo.titulo && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {grupo.titulo}
                </p>
              )}
              <div className="space-y-0.5">
                {grupo.items.map((item) => {
                  const activo =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const contador =
                    item.href === "/notificaciones"
                      ? sinLeer
                      : (PENDIENTES_POR_RUTA[item.href] ?? []).reduce(
                          (t, mod) => t + (pendientes[mod] ?? 0),
                          0,
                        );
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        activo
                          ? "bg-brand text-white shadow-sm"
                          : "text-foreground/75 hover:bg-brand-light/50 hover:text-foreground"
                      }`}
                    >
                      {item.label}
                      {contador > 0 && (
                        <motion.span
                          key={contador}
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 18,
                          }}
                          className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white"
                        >
                          {contador > 99 ? "99+" : contador}
                        </motion.span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border/60 p-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
            >
              {usuario.name
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{usuario.name}</p>
              <p className="truncate text-xs text-muted">
                {usuario.teamName ?? "Sin equipo"}
              </p>
            </div>
          </div>
          <div className="mt-2 border-t border-border/60 pt-2">
            <InterruptorAnimaciones />
          </div>
          <button
            onClick={async () => {
              await cerrarSesion();
              router.replace("/login");
            }}
            className="mt-2 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition duration-150 hover:border-danger hover:text-danger active:scale-[0.98]"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <div key={pathname} className="animar-entrada">
          {children}
        </div>
      </main>
    </div>
  );
}
