"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const usuario = await iniciarSesion(email, password);
      router.replace(usuario.mustChangePassword ? "/cambiar-password" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="glass animar-entrada w-full max-w-sm rounded-2xl p-8">
        <div className="mb-8 text-center">
          <Image
            src="/logo-vitralux.png"
            alt="Vitralux Windows"
            width={220}
            height={65}
            priority
            unoptimized
            className="mx-auto dark:brightness-0 dark:invert-[0.92]"
          />
          <p className="mt-4 text-sm text-muted">Gestor de Proyectos</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@vitralux.co"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-brand-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
