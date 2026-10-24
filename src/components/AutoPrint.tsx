"use client";
import { useEffect } from "react";

/** Abre el cuadro de imprimir solo (para "Descargar PDF": ahí se elige Guardar como PDF). */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
