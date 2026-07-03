"use client";

import { useAuth } from "@/lib/auth";

export default function InicioPage() {
  const { usuario } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Hola, {usuario?.name?.split(" ")[0]}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Bienvenido al gestor de proyectos de Vitralux y VLX Windows. Los
        módulos de proyectos, cotizaciones y producción estarán disponibles en
        las próximas fases.
      </p>
    </div>
  );
}
