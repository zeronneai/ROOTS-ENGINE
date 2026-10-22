/**
 * Copy con IA: junta lo que sabemos del cliente y llama a writeCaption.
 * Sin "server-only": el worker también lo usa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeCaption, writeCaptions, writeHooks, type CaptionInput } from "../lib/ai/caption";
import type { BrandBrain } from "../lib/types";

export async function captionContext(db: SupabaseClient, clientId: string) {
  const [{ data: client }, { data: profile }, { data: own }, { data: posted }] = await Promise.all([
    db.from("clients").select("name, niche, city, language, caption_rules, caption_footer").eq("id", clientId).single(),
    db.from("brand_profiles").select("data, active_mood_id").eq("client_id", clientId).maybeSingle(),
    db
      .from("competitor_posts")
      .select("caption, posted_at, competitors!inner(is_own_account)")
      .eq("client_id", clientId)
      .eq("competitors.is_own_account", true)
      .not("caption", "is", null)
      .order("posted_at", { ascending: false })
      .limit(10),
    db
      .from("scheduled_posts")
      .select("caption")
      .eq("client_id", clientId)
      .in("status", ["published", "partial", "scheduled"])
      .neq("caption", "")
      .order("scheduled_for", { ascending: false })
      .limit(5),
  ]);
  if (!client) throw new Error("Cliente no encontrado");
  let mood: CaptionInput["mood"] = null;
  if (profile?.active_mood_id) {
    const { data } = await db.from("moods").select("name, description, tone_notes").eq("id", profile.active_mood_id).maybeSingle();
    mood = data ?? null;
  }
  const examples = [...(posted ?? []).map((p) => p.caption as string), ...(own ?? []).map((p) => p.caption as string)]
    .map((c) => c.trim())
    .filter((c, i, all) => c.length > 10 && all.indexOf(c) === i);
  return {
    client: { name: client.name, niche: client.niche, city: client.city, language: client.language },
    brand: (profile?.data ?? {}) as Partial<BrandBrain>,
    mood,
    rules: client.caption_rules as string | null,
    footer: client.caption_footer as string | null,
    examples,
  };
}

export async function generateCaption(
  db: SupabaseClient,
  clientId: string,
  opts: { frames: CaptionInput["frames"]; transcript?: string | null; hint?: string | null; platforms?: string[] },
) {
  const ctx = await captionContext(db, clientId);
  return writeCaption({ ...ctx, frames: opts.frames, transcript: opts.transcript ?? null, hint: opts.hint, platforms: opts.platforms });
}

/** 3 copys (largo, corto, sin pedir comentarios). `avoid` = los que ya se propusieron, para que salgan otros. */
export async function generateCaptions(
  db: SupabaseClient,
  clientId: string,
  opts: { frames: CaptionInput["frames"]; transcript?: string | null; hint?: string | null; platforms?: string[]; avoid?: string[] },
) {
  const ctx = await captionContext(db, clientId);
  return writeCaptions({ ...ctx, frames: opts.frames, transcript: opts.transcript ?? null, hint: opts.hint, platforms: opts.platforms, avoid: opts.avoid });
}

/** El cierre fijo del cliente (para garantizarlo en cualquier post). */
export async function clientFooter(db: SupabaseClient, clientId: string) {
  const { data } = await db.from("clients").select("caption_footer").eq("id", clientId).maybeSingle();
  return (data?.caption_footer as string | null) ?? null;
}

export async function generateHooks(db: SupabaseClient, clientId: string, opts: { frames: CaptionInput["frames"]; transcript?: string | null; hint?: string | null; language?: "es" | "en" | null }) {
  const ctx = await captionContext(db, clientId);
  const { data } = await db.from("brand_profiles").select("data").eq("client_id", clientId).maybeSingle();
  const accent = ((data?.data ?? {}) as Partial<BrandBrain>).visual?.accentColor ?? null;
  const hooks = await writeHooks({ client: ctx.client, brand: ctx.brand, mood: ctx.mood, rules: ctx.rules, examples: ctx.examples, frames: opts.frames, transcript: opts.transcript ?? null, hint: opts.hint, language: opts.language });
  return { hooks, brandColor: accent };
}
