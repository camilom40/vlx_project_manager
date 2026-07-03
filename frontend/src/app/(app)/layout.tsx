"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS: { href: string; label: string; modulo: string }[] = [
  { href: "/", label: "Inicio", modulo: "" },
  { href: "/proyectos", label: "Proyectos", modulo: "PROYECTOS" },
  { href: "/cotizaciones", label: "Cotizaciones", modulo: "COTIZACIONES" },
  { href: "/produccion", label: "Producción", modulo: "PRODUCCION" },
  { href: "/garantias", label: "Garantías", modulo: "GARANTIAS" },
  { href: "/errores", label: "Errores y retrabajos", modulo: "ERRORES" },
  { href: "/carga", label: "Carga de trabajo", modulo: "PROYECTOS" },
  { href: "/plantillas", label: "Plantillas", modulo: "PLANTILLAS" },
  { href: "/notificaciones", label: "Notificaciones", modulo: "" },
  { href: "/usuarios", label: "Usuarios", modulo: "USUARIOS" },
  { href: "/equipos", label: "Equipos", modulo: "EQUIPOS" },
  { href: "/grupos", label: "Grupos de instaladores", modulo: "EQUIPOS" },
  { href: "/auditoria", label: "Auditoría", modulo: "AUDITORIA" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario, cargando, cerrarSesion, puede } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sinLeer, setSinLeer] = useState(0);

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

  if (cargando || !usuario || usuario.mustChangePassword) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Cargando...</p>
      </main>
    );
  }

  const visibles = NAV_ITEMS.filter(
    (item) => item.modulo === "" || puede(item.modulo),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-border bg-surface/70 backdrop-blur-xl">
        <div className="border-b border-border px-5 py-5">
          <div className="text-lg font-bold tracking-tight text-brand-dark dark:text-foreground">
            VITRALUX
            <span className="block text-[10px] font-medium tracking-[0.3em] text-brand">
              GESTOR DE PROYECTOS
            </span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibles.map((item) => {
            const activo =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activo
                    ? "bg-brand text-white"
                    : "text-foreground/80 hover:bg-brand-light/50"
                }`}
              >
                {item.label}
                {item.href === "/notificaciones" && sinLeer > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                    {sinLeer > 99 ? "99+" : sinLeer}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium">{usuario.name}</p>
          <p className="truncate text-xs text-muted">
            {usuario.teamName ?? "Sin equipo"}
          </p>
          <button
            onClick={async () => {
              await cerrarSesion();
              router.replace("/login");
            }}
            className="mt-3 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-danger hover:text-danger"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
