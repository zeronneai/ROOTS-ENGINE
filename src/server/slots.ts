/**
 * Calendario fijo de publicación: reglas tipo "martes y jueves 10:00, lo más nuevo de esta carpeta de Dropbox".
 * El worker crea los posts de los próximos 7 días y, a la hora límite, revisa si el editor ya subió el video.
 * Sin "server-only": lo usa el worker.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { folderHasNew } from "../lib/dropbox";
import { usedNames } from "./publishing";

export type Slot = {
  id: string;
  client_id: string;
  name: string;
  weekdays: number[];
  time: string;
  timezone: string;
  accounts: { platform: string; accountId: string; label?: string }[];
  dropbox_url: string;
  caption: string;
  deadline_hours: number;
  active: boolean;
};

/** Partes de la fecha en una zona horaria. */
function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd };
}

/** Fecha y hora local de una zona → instante UTC. */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string) {
  let t = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(t), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    t += Date.UTC(y, m - 1, d, h, min) - asUtc;
  }
  return new Date(t);
}

/** Próximas fechas de la regla (7 días). */
export function nextOccurrences(slot: Pick<Slot, "weekdays" | "time" | "timezone">, days = 7, from = new Date()) {
  const [hh, mm] = slot.time.split(":").map(Number);
  const out: Date[] = [];
  for (let k = 0; k <= days; k++) {
    const p = partsIn(new Date(from.getTime() + k * 864e5), slot.timezone);
    if (!slot.weekdays.includes(p.wd)) continue;
    const at = zonedToUtc(p.y, p.m, p.d, hh, mm, slot.timezone);
    if (at.getTime() > from.getTime() + 5 * 60_000) out.push(at);
  }
  return [...new Map(out.map((d) => [d.getTime(), d])).values()];
}

/** Crea los posts que falten de las reglas activas (de un cliente o de todos). */
export async function generateSlotPosts(db: SupabaseClient, clientId?: string) {
  let q = db.from("posting_slots").select("*").eq("active", true);
  if (clientId) q = q.eq("client_id", clientId);
  const { data: slots } = await q;
  let created = 0;
  for (const slot of (slots ?? []) as Slot[]) {
    const dates = nextOccurrences(slot);
    if (!dates.length) continue;
    const { data: existing } = await db.from("scheduled_posts").select("scheduled_for").eq("slot_id", slot.id).gte("scheduled_for", new Date().toISOString());
    const have = new Set((existing ?? []).map((r) => new Date(r.scheduled_for).getTime()));
    const rows = dates
      .filter((d) => !have.has(d.getTime()))
      .map((d) => ({
        client_id: slot.client_id,
        slot_id: slot.id,
        caption: slot.caption,
        accounts: slot.accounts,
        scheduled_for: d.toISOString(),
        timezone: slot.timezone,
        media_source: "dropbox_folder",
        dropbox_url: slot.dropbox_url,
        status: "waiting_media",
      }));
    if (rows.length) {
      const { error } = await db.from("scheduled_posts").insert(rows);
      if (!error) created += rows.length;
    }
  }
  return created;
}

/** A la hora límite, revisa que ya haya video nuevo en la carpeta; si no, deja el aviso en el post. */
export async function checkDeadlines(db: SupabaseClient, log: (m: string) => void) {
  const { data } = await db
    .from("scheduled_posts")
    .select("id, dropbox_url, scheduled_for, slot_id, posting_slots(name, deadline_hours)")
    .eq("status", "waiting_media")
    .eq("missing_alerted", false)
    .not("slot_id", "is", null)
    .lte("scheduled_for", new Date(Date.now() + 48 * 3600_000).toISOString())
    .limit(10);
  for (const r of data ?? []) {
    const slot = r.posting_slots as unknown as { name: string; deadline_hours: number } | null;
    const deadline = Date.parse(r.scheduled_for) - (slot?.deadline_hours ?? 3) * 3600_000;
    if (Date.now() < deadline) continue;
    const ok = await folderHasNew(r.dropbox_url!, await usedNames(db, r.dropbox_url!, r.id));
    await db
      .from("scheduled_posts")
      .update({ missing_alerted: true, error: ok ? null : `Falta el video: a la hora límite no había nada nuevo en la carpeta (${slot?.name ?? "calendario"}). Si se sube antes de la hora, igual se publica.` })
      .eq("id", r.id);
    if (!ok) log(`⚠ falta video para el post ${r.id} (${slot?.name ?? ""})`);
  }
}
