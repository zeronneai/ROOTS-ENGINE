import type { Property } from "./types";

/** Los datos que sí llenaron, con su ícono, en el orden en que conviene contarlos. */
export function specList(p: Property) {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
  const out: { icon: string; value: string; label: string }[] = [];
  if (p.bedrooms) out.push({ icon: "🛏️", value: fmt(p.bedrooms), label: p.bedrooms === 1 ? "Recámara" : "Recámaras" });
  if (p.bathrooms) out.push({ icon: "🛁", value: fmt(p.bathrooms), label: p.bathrooms === 1 ? "Baño" : "Baños" });
  if (p.builtM2) out.push({ icon: "📐", value: `${fmt(p.builtM2)} m²`, label: "Construcción" });
  if (p.landM2) out.push({ icon: "🌳", value: `${fmt(p.landM2)} m²`, label: "Terreno" });
  if (p.parking) out.push({ icon: "🚗", value: fmt(p.parking), label: p.parking === 1 ? "Estacionamiento" : "Autos" });
  if (p.floors) out.push({ icon: "🏠", value: fmt(p.floors), label: p.floors === 1 ? "Planta" : "Plantas" });
  return out;
}

