"use client";
import type { Property } from "@/lib/tour/types";

const AMENITY_SUGGESTIONS = ["Alberca", "Jardín", "Terraza", "Cocina integral", "Cuarto de servicio", "Seguridad 24/7", "Vista", "Roof garden", "Gimnasio", "Bodega", "Paneles solares", "Amueblada"];

/** Formulario con los datos de la propiedad. Lo que no se llene, no sale en el video. */
export function PropertyFields({ value, onChange }: { value: Property; onChange: (p: Property) => void }) {
  const set = <K extends keyof Property>(k: K, v: Property[K]) => onChange({ ...value, [k]: v });
  const num = (v: string) => (v.trim() ? Number(v.replace(/[^\d.]/g, "")) || null : null);
  const amenities = value.amenities ?? [];
  const field = "input !py-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["venta", "renta", "preventa"] as const).map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => set("operation", value.operation === op ? null : op)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold capitalize ${value.operation === op ? "border-purple bg-purple text-white" : "border-line bg-white"}`}
          >
            {op}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={field} value={value.price ?? ""} onChange={(e) => set("price", e.target.value || null)} placeholder="Precio (ej: $3,450,000)" />
        <input className={field} value={value.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="Ubicación (ej: Campestre, Chihuahua)" />
        <input className={`${field} sm:col-span-2`} value={value.title ?? ""} onChange={(e) => set("title", e.target.value || null)} placeholder="Título (opcional, si no la IA lo escribe)" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(
          [
            ["bedrooms", "Recámaras"],
            ["bathrooms", "Baños"],
            ["builtM2", "m² const."],
            ["landM2", "m² terreno"],
            ["parking", "Autos"],
            ["floors", "Plantas"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="space-y-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{l}</span>
            <input className={field} inputMode="decimal" value={value[k] ?? ""} onChange={(e) => set(k, num(e.target.value))} />
          </label>
        ))}
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Amenidades</div>
        <div className="flex flex-wrap gap-1.5">
          {AMENITY_SUGGESTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => set("amenities", amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a].slice(0, 8))}
              className={`rounded-full border px-3 py-1 text-xs ${amenities.includes(a) ? "border-purple bg-purple text-white" : "border-line bg-white"}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={field} value={value.agentName ?? ""} onChange={(e) => set("agentName", e.target.value || null)} placeholder="Asesor (nombre)" />
        <input className={field} value={value.agentPhone ?? ""} onChange={(e) => set("agentPhone", e.target.value || null)} placeholder="Teléfono o WhatsApp" />
        <input className={field} value={value.cta ?? ""} onChange={(e) => set("cta", e.target.value || null)} placeholder="Cierre (ej: Agenda tu visita)" />
      </div>
    </div>
  );
}

/** Textos para un video cinemático de cualquier giro (comida, productos, lugares). */
export function CinematicFields({ value, onChange }: { value: Property; onChange: (p: Property) => void }) {
  const set = <K extends keyof Property>(k: K, v: Property[K]) => onChange({ ...value, [k]: v });
  const field = "input !py-2 text-sm";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input className={`${field} sm:col-span-2`} value={value.title ?? ""} onChange={(e) => set("title", e.target.value || null)} placeholder="Título (ej: Nuevo menú de temporada)" />
      <input className={field} value={value.price ?? ""} onChange={(e) => set("price", e.target.value || null)} placeholder="Promo o precio (ej: 2x1 los martes)" />
      <input className={field} value={value.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="Dónde (ej: Av. Juárez 123)" />
      <input className={field} value={value.cta ?? ""} onChange={(e) => set("cta", e.target.value || null)} placeholder="Cierre (ej: Te esperamos)" />
      <input className={field} value={value.agentPhone ?? ""} onChange={(e) => set("agentPhone", e.target.value || null)} placeholder="Teléfono o WhatsApp (opcional)" />
    </div>
  );
}
