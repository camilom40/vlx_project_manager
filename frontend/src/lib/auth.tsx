"use client";

import { MotionConfig } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, setToken, getToken } from "./api";

export interface Usuario {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  mustChangePassword: boolean;
}

export interface PermisoModulo {
  canView: boolean;
  canEdit: boolean;
}

export type Permisos = Record<string, PermisoModulo>;

interface AuthState {
  usuario: Usuario | null;
  permisos: Permisos;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<Usuario>;
  cerrarSesion: () => Promise<void>;
  refrescar: () => Promise<void>;
  puede: (modulo: string, accion?: "ver" | "editar") => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [permisos, setPermisos] = useState<Permisos>({});
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    if (!getToken()) {
      setUsuario(null);
      setPermisos({});
      setCargando(false);
      return;
    }
    try {
      const data = await api<{ user: Usuario; permissions: Permisos }>(
        "/api/auth/me",
      );
      setUsuario(data.user);
      setPermisos(data.permissions);
    } catch {
      setUsuario(null);
      setPermisos({});
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      const data = await api<{
        token: string;
        user: Usuario;
        permissions: Permisos;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUsuario(data.user);
      setPermisos(data.permissions);
      return data.user;
    },
    [],
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // aunque falle el registro, cerramos localmente
    }
    setToken(null);
    setUsuario(null);
    setPermisos({});
  }, []);

  const puede = useCallback(
    (modulo: string, accion: "ver" | "editar" = "ver") => {
      const p = permisos[modulo];
      if (!p) return false;
      return accion === "ver" ? p.canView || p.canEdit : p.canEdit;
    },
    [permisos],
  );

  return (
    <AuthContext.Provider
      value={{
        usuario,
        permisos,
        cargando,
        iniciarSesion,
        cerrarSesion,
        refrescar,
        puede,
      }}
    >
      {/* Las animaciones de motion respetan prefers-reduced-motion del sistema */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
