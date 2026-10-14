"use server";

import { revalidatePath } from "next/cache";
import { requireAgency, requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { MUSIC_MOODS as MOODS } from "@/lib/music-moods";

function cleanTrack(t: { path: string; title: string; moods?: string[]; energy?: number }) {
  return {
    title: String(t.title || "Sin nombre").slice(0, 80),
    moods: (t.moods ?? []).filter((m) => (MOODS as readonly string[]).includes(m)).slice(0, 5),
    energy: Math.max(-2, Math.min(2, Math.round(Number(t.energy) || 0))),
    path: t.path,
  };
}

/** Canción de la biblioteca de la agencia (sirve para todos los clientes). */
export async function addAgencyTrackAction(t: { path: string; title: string; moods?: string[]; energy?: number }) {
  const viewer = await requireAgency();
  if (!t.path.startsWith("agency/music/") || t.path.includes("..")) throw new Error("Ruta inválida");
  const { error } = await supabaseAdmin().from("music_tracks").insert({ ...cleanTrack(t), client_id: null, created_by: viewer.id });
  if (error) throw error;
  revalidatePath("/agency/musica");
}

/** Canción propia de un cliente (solo la usan sus videos). Regresa el id para elegirla de inmediato. */
export async function addClientTrackAction(clientId: string, t: { path: string; title: string; moods?: string[]; energy?: number }) {
  const viewer = await requireClientAccess(clientId);
  if (!t.path.startsWith(`${clientId}/music/`) || t.path.includes("..")) throw new Error("Ruta inválida");
  const { data, error } = await supabaseAdmin()
    .from("music_tracks")
    .insert({ ...cleanTrack(t), client_id: clientId, created_by: viewer.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteTrackAction(id: string) {
  await requireAgency();
  const db = supabaseAdmin();
  const { data } = await db.from("music_tracks").delete().eq("id", id).select("path").maybeSingle();
  if (data?.path) await db.storage.from("brand").remove([data.path]);
  revalidatePath("/agency/musica");
}
