"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function CambiarPasswordPage() {
  const router = useRouter();
  const { usuario, refrescar } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const forzado = usuario?.mustChangePassword ?? false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    try {
      await api("/api/auth/cambiar-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: forzado ? undefined : actual,
          newPassword: nueva,
        }),
      });
      await refrescar();
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cambiar la contraseña.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="glass animar-entrada w-full max-w-sm rounded-2xl p-8">
        <h1 className="text-lg font-semibold">Cambiar contraseña</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          {forzado
            ? "Tu contraseña es temporal. Debes crear una nueva antes de continuar."
            : "Ingresa tu contraseña actual y la nueva."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          {!forzado && (
            <div>
              <label
                htmlFor="actual"
                className="mb-1 block text-sm font-medium"
              >
                Contraseña actual
              </label>
              <input
                id="actual"
                type="password"
                required
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
          )}
          <div>
            <label htmlFor="nueva" className="mb-1 block text-sm font-medium">
              Nueva contraseña
            </label>
            <input
              id="nueva"
              type="password"
              required
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label
              htmlFor="confirmacion"
              className="mb-1 block text-sm font-medium"
            >
              Confirmar nueva contraseña
            </label>
            <input
              id="confirmacion"
              type="password"
              required
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {enviando ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
