import { z } from "zod";

/** Datos de la propiedad. Todo es opcional: lo que no se llene, no sale en el video. */
export const PropertySchema = z.object({
  operation: z.enum(["venta", "renta", "preventa"]).nullable().optional(),
  price: z.string().nullable().optional(), // texto libre: "$3,450,000 MXN", "$1,800 USD/mes"
  title: z.string().nullable().optional(), // "Casa con alberca en Campestre"
  location: z.string().nullable().optional(), // colonia, ciudad
  bedrooms: z.number().nullable().optional(),
  bathrooms: z.number().nullable().optional(), // 2.5 = 2 completos y 1 medio
  builtM2: z.number().nullable().optional(),
  landM2: z.number().nullable().optional(),
  parking: z.number().nullable().optional(),
  floors: z.number().nullable().optional(),
  amenities: z.array(z.string()).nullable().optional(), // "Alberca", "Cocina integral"
  agentName: z.string().nullable().optional(),
  agentPhone: z.string().nullable().optional(),
  cta: z.string().nullable().optional(), // "Agenda tu visita"
  rooms: z.array(z.string()).nullable().optional(), // nombre de cada clip en orden: "Fachada", "Cocina"...
  seconds: z.number().nullable().optional(), // duración deseada del video
});
export type Property = z.infer<typeof PropertySchema>;

/** Limpia lo que llega del navegador. */
export function cleanProperty(input: unknown): Property {
  const o = (typeof input === "object" && input ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
    return Number.isFinite(n) && n > 0 && n < 1e7 ? n : null;
  };
  const list = (v: unknown, n: number) =>
    Array.isArray(v) ? v.map((x) => str(x, 40)).filter((x): x is string => !!x).slice(0, n) : null;
  const op = str(o.operation);
  return {
    operation: op === "venta" || op === "renta" || op === "preventa" ? op : null,
    price: str(o.price, 40),
    title: str(o.title, 70),
    location: str(o.location, 60),
    bedrooms: num(o.bedrooms),
    bathrooms: num(o.bathrooms),
    builtM2: num(o.builtM2),
    landM2: num(o.landM2),
    parking: num(o.parking),
    floors: num(o.floors),
    amenities: list(o.amenities, 8),
    agentName: str(o.agentName, 50),
    agentPhone: str(o.agentPhone, 30),
    cta: str(o.cta, 40),
    rooms: Array.isArray(o.rooms) ? o.rooms.map((x) => str(x, 30) ?? "").slice(0, 20) : null,
    seconds: [15, 30, 45, 60].includes(Number(o.seconds)) ? Number(o.seconds) : null,
  };
}

/** EDL del recorrido: tomas en la línea de tiempo final, ya alineadas al ritmo. */
export const TourEdlSchema = z.object({
  type: z.literal("tour"),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  duration: z.number(), // segundos de salida
  bpm: z.number(),
  shots: z.array(
    z.object({
      start: z.number(), // salida
      end: z.number(),
      src: z.number(), // segundo del video fuente donde empieza la toma
      clip: z.number(),
      move: z.enum(["in", "out", "left", "right"]),
    }),
  ),
  /** golpes en tiempo de salida (para animar al ritmo) */
  beats: z.array(z.number()),
  property: z.any(),
  /** textos escritos por la IA */
  copy: z.object({
    headline: z.string(),
    highlights: z.array(z.string()), // 2 a 4 frases cortas: "Alberca climatizada", "A 5 min de Galerías"
    cta: z.string(),
  }),
  rooms: z.array(z.string()), // etiqueta por clip
  music: z.object({ path: z.string(), title: z.string(), volume: z.number() }).nullable(),
});
export type TourEdl = z.infer<typeof TourEdlSchema>;
