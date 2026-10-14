import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditStyle } from "./styles/types";

export type Track = { id: string; client_id: string | null; title: string; moods: string[]; energy: number; path: string };

/** Energía natural de cada estilo (-2 calmado … 2 intenso), para escoger música si la IA no puede. */
const PRESET_ENERGY: Record<string, number> = {
  "street-fade": 2,
  "iron-power": 2,
  "food-hype": 1,
  "neon-night": 1,
  "creator-bold": 1,
  "ranch-grit": 0,
  "smile-clean": 0,
  "glow-luxe": -1,
  "counsel-authority": -1,
  "editorial-minimal": 0,
};

/** Canciones disponibles para un cliente: las suyas primero y luego la biblioteca de la agencia. */
export async function loadTracks(db: SupabaseClient, clientId: string): Promise<Track[]> {
  const { data, error } = await db
    .from("music_tracks")
    .select("id, client_id, title, moods, energy, path")
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return []; // sin la migración 0011 simplemente no hay música
  return ((data ?? []) as Track[]).sort((a, b) => Number(!!b.client_id) - Number(!!a.client_id));
}

/** Respaldo sin IA: la de energía más parecida al estilo, prefiriendo las del cliente. */
export function fallbackTrack(tracks: Track[], style: EditStyle, energy?: number): Track | null {
  if (!tracks.length) return null;
  const target = energy ?? PRESET_ENERGY[style.id] ?? 0;
  return [...tracks].sort(
    (a, b) => Math.abs(a.energy - target) - Math.abs(b.energy - target) || Number(!!b.client_id) - Number(!!a.client_id),
  )[0];
}

/**
 * Qué canción lleva un video según lo que eligieron al subirlo:
 * 'none' = sin música, 'track' = la elegida, 'auto' = la que propuso la IA (o el respaldo).
 */
export function chooseMusic(opts: {
  mode: string | null | undefined;
  musicId: string | null | undefined;
  tracks: Track[];
  aiPick?: number | null;
  style: EditStyle;
  force?: boolean; // el modo recorrido siempre lleva música
}): { path: string; title: string } | null {
  if (opts.mode === "none" && !opts.force) return null;
  if (!opts.force && !opts.style.music?.enabled) return null;
  const pick =
    opts.mode === "track"
      ? opts.tracks.find((t) => t.id === opts.musicId)
      : (opts.aiPick != null ? opts.tracks[opts.aiPick] : undefined) ?? fallbackTrack(opts.tracks, opts.style);
  return pick ? { path: pick.path, title: pick.title } : null;
}
