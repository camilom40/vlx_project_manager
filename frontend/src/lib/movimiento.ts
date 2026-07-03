"use client";

import { useEffect, useState } from "react";

// Preferencia de animaciones de la app: permite forzarlas activas
// independientemente de la configuración de "movimiento reducido" del
// sistema operativo. Se guarda en localStorage y se refleja como
// data-motion="on"|"off" en <html> (fijado sin parpadeo por SCRIPT_SIN_PARPADEO
// en el layout raíz) para que el CSS lo lea sin esperar a React.

const CLAVE = "vlx_motion";
const EVENTO = "vlx-motion-change";

export type PreferenciaMovimiento = "sistema" | "on" | "off";

export function sistemaPrefiereReducido(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function leerPreferencia(): PreferenciaMovimiento {
  if (typeof window === "undefined") return "sistema";
  const v = localStorage.getItem(CLAVE);
  return v === "on" || v === "off" ? v : "sistema";
}

export function animacionesActivas(pref?: PreferenciaMovimiento): boolean {
  const p = pref ?? leerPreferencia();
  if (p === "on") return true;
  if (p === "off") return false;
  return !sistemaPrefiereReducido();
}

function aplicarAtributo(activo: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = activo ? "on" : "off";
}

export function guardarPreferencia(pref: PreferenciaMovimiento): void {
  if (typeof window === "undefined") return;
  if (pref === "sistema") localStorage.removeItem(CLAVE);
  else localStorage.setItem(CLAVE, pref);
  aplicarAtributo(animacionesActivas(pref));
  window.dispatchEvent(new Event(EVENTO));
}

/** Script inline para <head>: fija data-motion antes del primer paint (sin parpadeo). */
export const SCRIPT_SIN_PARPADEO = `
(function () {
  try {
    var v = localStorage.getItem("${CLAVE}");
    var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var activo = v === "on" ? true : v === "off" ? false : !reducido;
    document.documentElement.dataset.motion = activo ? "on" : "off";
  } catch (e) {
    document.documentElement.dataset.motion = "off";
  }
})();
`;

/** Preferencia guardada + setter, para el interruptor de configuración. */
export function usePreferenciaMovimiento(): [
  PreferenciaMovimiento,
  (p: PreferenciaMovimiento) => void,
] {
  const [pref, setPref] = useState<PreferenciaMovimiento>(() =>
    leerPreferencia(),
  );
  useEffect(() => {
    const actualizar = () => setPref(leerPreferencia());
    window.addEventListener(EVENTO, actualizar);
    return () => window.removeEventListener(EVENTO, actualizar);
  }, []);
  const establecer = (p: PreferenciaMovimiento) => {
    guardarPreferencia(p);
    setPref(p);
  };
  return [pref, establecer];
}

/** Estado reactivo: ¿deben correr las animaciones ahora mismo? */
export function useAnimacionesActivas(): boolean {
  const [activo, setActivo] = useState(() => animacionesActivas());
  useEffect(() => {
    const actualizar = () => setActivo(animacionesActivas());
    actualizar();
    window.addEventListener(EVENTO, actualizar);
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    mql.addEventListener("change", actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      mql.removeEventListener("change", actualizar);
    };
  }, []);
  return activo;
}
