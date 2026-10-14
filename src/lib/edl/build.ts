import type { EditStyle } from "../styles/types";
import type { Edl, SfxKind, Word } from "./types";

/**
 * "Dirección" = decisiones creativas por índice de palabra.
 * La genera Claude (src/lib/ai/direct-edit.ts) o la heurística de abajo.
 * buildEdl() la convierte a tiempos reales.
 */
export type Direction = {
  removeWords: number[]; // muletillas, tomas repetidas, arranques en falso
  emphasis: number[]; // palabras clave resaltadas
  zooms: { word: number; strength?: "soft" | "hard" }[];
  emojis: { word: number; emoji: string }[];
  hookTitle: string | null;
  /** textos animados: palabra donde aparece y el texto corto que se muestra */
  callouts?: { word: number; text: string }[];
  /** llamado a la acción del cierre */
  cta?: string | null;
  /** imágenes del cliente: en qué palabra aparece cada una */
  images?: { path: string; word: number }[];
  /** canción de fondo elegida */
  music?: { path: string; title: string } | null;
  /** video híbrido: clips sin voz (tiempo del original) que entran como tomas con música */
  broll?: { start: number; end: number }[];
  /** duración de cada toma sin voz (sale del ritmo de la canción) */
  brollShot?: number;
};

/**
 * Video híbrido: decide qué clips son tomas sin voz.
 * mode 'talk' / 'broll' lo decide quien subió; 'auto' = si casi no hay palabras en el clip, es toma.
 */
export function detectBroll(words: Word[], clips: { start: number; end: number }[] | undefined, modes: string[] = []) {
  if (!clips || clips.length < 2) return [];
  return clips.filter((c, i) => {
    const mode = modes[i] ?? "auto";
    if (mode === "talk") return false;
    if (mode === "broll") return true;
    const inside = words.filter((w) => w.start >= c.start - 0.05 && w.end <= c.end + 0.05);
    const spoken = inside.reduce((a, w) => a + (w.end - w.start), 0);
    return inside.length < 3 || spoken < (c.end - c.start) * 0.15;
  });
}

const FILLERS = new Set([
  "eh", "ehh", "ehhh", "em", "emm", "mm", "mmm", "um", "umm", "uh", "uhh", "ah", "ahh", "erm", "hmm",
]);

const EMPHASIS_WORDS = new Set([
  // es
  "gratis", "nunca", "siempre", "secreto", "error", "errores", "mejor", "peor", "hoy", "ahora", "nadie",
  "todos", "dinero", "precio", "rápido", "fácil", "increíble", "importante", "cuidado", "nuevo", "único",
  "garantizado", "resultados", "clientes", "ventas",
  // en
  "free", "never", "always", "secret", "mistake", "mistakes", "best", "worst", "today", "now", "nobody",
  "everyone", "money", "price", "fast", "easy", "insane", "important", "new", "guaranteed", "results",
  "clients", "sales",
]);

const KEYWORD_EMOJI: Record<string, string> = {
  dinero: "💰", money: "💰", precio: "💲", price: "💲", gratis: "🎁", free: "🎁",
  fuego: "🔥", fire: "🔥", error: "❌", errores: "❌", mistake: "❌", mistakes: "❌",
  secreto: "🤫", secret: "🤫", idea: "💡", tiempo: "⏰", time: "⏰", rápido: "⚡", fast: "⚡",
  amor: "❤️", love: "❤️", corte: "✂️", cut: "✂️", comida: "🍽️", food: "🍽️", hambre: "🤤",
  gym: "💪", fuerte: "💪", strong: "💪", sonrisa: "😁", smile: "😁", dientes: "🦷", teeth: "🦷",
  casa: "🏠", house: "🏠", home: "🏠", carro: "🚗", car: "🚗", auto: "🚗", ley: "⚖️", law: "⚖️",
  abogado: "⚖️", lawyer: "⚖️", cerveza: "🍺", beer: "🍺", fiesta: "🎉", party: "🎉", piel: "✨", skin: "✨",
  clientes: "🤝", clients: "🤝", ventas: "📈", sales: "📈", crecer: "📈", grow: "📈", top: "🏆", mejor: "🏆",
  best: "🏆", ojo: "👀", mira: "👀", look: "👀", nadie: "🤐", nobody: "🤐", aquí: "👇", here: "👇",
};

const EMOJIS_PER_MINUTE = { none: 0, low: 4, medium: 8, high: 14 } as const;
const EMOJIS_MIN = { none: 0, low: 2, medium: 3, high: 4 } as const;
const CALLOUT_EVERY = { none: Infinity, low: 12, medium: 7, high: 4.5 } as const;
const CALLOUT_MIN = { none: 0, low: 1, medium: 2, high: 3 } as const;
/** el título del hook ocupa los primeros segundos: ahí no van textos animados */
export const HOOK_SECONDS = 2.6;

/** Cuántos zooms, emojis y textos animados le tocan a un video según su estilo y duración. */
export function targetCounts(style: EditStyle, duration: number) {
  const d = style.emojis.density;
  const m = style.motion?.level ?? "none";
  return {
    zooms: style.zoom.enabled ? Math.max(2, Math.round(duration / style.zoom.everySeconds)) : 0,
    emojis: d === "none" ? 0 : Math.max(EMOJIS_MIN[d], Math.round((duration / 60) * EMOJIS_PER_MINUTE[d])),
    callouts: m === "none" ? 0 : Math.max(CALLOUT_MIN[m], Math.round(duration / CALLOUT_EVERY[m])),
  };
}

export const norm = (w: string) =>
  w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

// ───────────────────────────── Heurística ─────────────────────────────

/** Dirección sin IA. Sirve de respaldo y para previsualizar al instante. */
export function heuristicDirection(words: Word[], style: EditStyle, hookTitle?: string | null): Direction {
  const removeWords: number[] = [];
  const emphasis: number[] = [];
  const zooms: Direction["zooms"] = [];
  const emojis: Direction["emojis"] = [];

  words.forEach((w, i) => {
    const n = norm(w.text);
    if (style.pacing.removeFillers && FILLERS.has(n)) removeWords.push(i);
  });

  const removed = new Set(removeWords);
  let lastEmphasisAt = -Infinity;
  words.forEach((w, i) => {
    if (removed.has(i)) return;
    const n = norm(w.text);
    const isKey = EMPHASIS_WORDS.has(n) || /\d|\$|%/.test(w.text) || n.length >= 9;
    if (isKey && w.start - lastEmphasisAt > 1.1) {
      emphasis.push(i);
      lastEmphasisAt = w.start;
    }
  });

  if (style.zoom.enabled) {
    let lastZoom = -Infinity;
    const emph = new Set(emphasis);
    words.forEach((w, i) => {
      if (removed.has(i)) return;
      const due = w.start - lastZoom >= style.zoom.everySeconds;
      const wanted = style.zoom.onEmphasis ? emph.has(i) || w.start - lastZoom >= style.zoom.everySeconds * 1.8 : true;
      if (due && wanted) {
        zooms.push({ word: i });
        lastZoom = w.start;
      }
    });
  }

  const duration = words.length ? words[words.length - 1].end : 0;
  const target = targetCounts(style, duration);
  emojis.push(...pickEmojis(words, removed, new Set(emphasis), style, target.emojis));
  const callouts = pickCallouts(words, removed, emphasis, target.callouts);

  return { removeWords, emphasis, zooms, emojis, hookTitle: hookTitle ?? null, callouts, cta: null };
}

/** Emojis por heurística: primero palabras con emoji obvio, luego palabras clave, bien repartidos. */
export function pickEmojis(
  words: Word[],
  removed: Set<number>,
  emphasis: Set<number>,
  style: EditStyle,
  count: number,
  taken: number[] = [],
): Direction["emojis"] {
  if (count <= 0 || !words.length) return [];
  const duration = words[words.length - 1].end;
  const gap = Math.max(1.2, Math.min(60 / (EMOJIS_PER_MINUTE[style.emojis.density] || 8), duration / (count + 0.5)));
  const palette = style.emojis.palette.length ? style.emojis.palette : ["🔥", "💡", "✅", "👀", "🤯"];
  const scored = words
    .map((w, i) => {
      const n = norm(w.text);
      const score = KEYWORD_EMOJI[n] ? 3 : emphasis.has(i) ? 2 : n.length >= 6 ? 1 : 0;
      return { i, t: w.start, score, emoji: KEYWORD_EMOJI[n] };
    })
    .filter((c) => !removed.has(c.i) && c.score > 0 && c.t > 0.4)
    .sort((a, b) => b.score - a.score || a.t - b.t);
  const used = taken.map((i) => words[i]?.start ?? -99);
  const out: Direction["emojis"] = [];
  let p = 0;
  for (const c of scored) {
    if (out.length >= count) break;
    if (used.some((u) => Math.abs(u - c.t) < gap)) continue;
    out.push({ word: c.i, emoji: c.emoji ?? palette[p++ % palette.length] });
    used.push(c.t);
  }
  return out.sort((a, b) => a.word - b.word);
}

/** Textos animados por heurística: números y palabras clave, en mayúsculas. */
export function pickCallouts(words: Word[], removed: Set<number>, emphasis: number[], count: number): NonNullable<Direction["callouts"]> {
  if (count <= 0) return [];
  const start = words.find((_, i) => !removed.has(i))?.start ?? 0;
  const cands = [...emphasis, ...words.map((_, i) => i)]
    .filter((i, k, arr) => arr.indexOf(i) === k && !removed.has(i) && words[i].start - start >= HOOK_SECONDS)
    .map((i) => ({ i, score: /\d/.test(words[i].text) ? 3 : emphasis.includes(i) ? 2 : norm(words[i].text).length >= 7 ? 1 : 0 }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const out: NonNullable<Direction["callouts"]> = [];
  for (const c of cands) {
    if (out.length >= count) break;
    if (out.some((o) => Math.abs(words[o.word].start - words[c.i].start) < 2.5)) continue;
    out.push({ word: c.i, text: words[c.i].text.replace(/[.,;:!?¡¿"]/g, "").toUpperCase() });
  }
  return out.sort((a, b) => a.word - b.word);
}

// ───────────────────────────── EDL builder ────────────────────────────

export function buildEdl(opts: {
  words: Word[];
  sourceDuration: number;
  style: EditStyle;
  direction: Direction;
  fps?: number;
  width?: number;
  height?: number;
}): Edl {
  const { words, sourceDuration, style, direction } = opts;
  const fps = opts.fps ?? 30;
  const removed = new Set(direction.removeWords);
  const emph = new Set(direction.emphasis);
  const broll = direction.broll ?? [];
  // en las tomas sin voz no hay subtítulos: cualquier ruido que Whisper haya "escuchado" ahí se ignora
  words.forEach((w, i) => {
    if (broll.some((b) => w.start >= b.start - 0.05 && w.end <= b.end + 0.05)) removed.add(i);
  });

  const segments: Edl["segments"] = words.some((_, i) => !removed.has(i)) || !broll.length ? computeSegments(words, removed, sourceDuration, style) : [];
  // tomas sin voz: partes repartidas de cada clip, del largo de unos golpes de la canción
  const shot = Math.max(1.2, Math.min(3.2, direction.brollShot ?? 2.2));
  for (const b of broll) {
    const from = b.start + 0.25;
    const usable = b.end - 0.25 - from;
    if (usable < 0.6) continue;
    const count = usable < shot ? 1 : Math.min(3, Math.floor(usable / shot));
    const len = Math.min(shot, usable);
    for (let k = 0; k < count; k++) {
      const start = count === 1 ? from + (usable - len) / 2 : from + ((usable - len) * k) / (count - 1);
      segments.push({ start: +start.toFixed(3), end: +(start + len).toFixed(3), broll: true });
    }
  }
  segments.sort((a, b) => a.start - b.start);
  if (!segments.length) segments.push({ start: 0, end: sourceDuration });

  const kept = words
    .map((w, i) => ({ ...w, emphasis: emph.has(i) || undefined, _i: i }))
    .filter((w) => !removed.has(w._i));

  const nextCutAfter = (t: number) => segments.find((s) => s.end > t)?.end ?? sourceDuration;

  const brollZooms: Edl["zooms"] = segments
    .filter((s) => s.broll)
    .map((s, k) => ({ at: s.start, duration: +(s.end - s.start).toFixed(3), scale: k % 2 ? 1.06 : 1.12, kind: "smooth" as const }));
  const zooms: Edl["zooms"] = (style.zoom.enabled ? direction.zooms : [])
    .filter((z) => words[z.word] && !removed.has(z.word))
    .map((z) => {
      const at = words[z.word].start;
      const dur =
        style.zoom.style === "smooth"
          ? Math.min(2.6, Math.max(1.2, style.zoom.everySeconds * 0.6))
          : Math.min(2.2, Math.max(0.6, nextCutAfter(at) - at));
      const scale = z.strength === "soft" ? 1 + (style.zoom.intensity - 1) * 0.6 : style.zoom.intensity;
      return { at, duration: +dur.toFixed(3), scale: +scale.toFixed(3), kind: style.zoom.style };
    });
  zooms.push(...brollZooms);

  const firstStart = segments[0]?.start ?? 0;
  const calloutDur = 1.7;
  const callouts: NonNullable<Edl["callouts"]> = (style.motion?.level === "none" ? [] : direction.callouts ?? [])
    .filter((c) => words[c.word] && !removed.has(c.word) && c.text.trim())
    .map((c) => ({ at: words[c.word].start, text: c.text.trim().slice(0, 32) }))
    .filter((c) => c.at - firstStart >= HOOK_SECONDS - 0.4)
    .sort((a, b) => a.at - b.at)
    .filter((c, i, arr) => i === 0 || c.at - arr[i - 1].at >= 2.2)
    .map((c) => ({
      at: c.at,
      duration: calloutDur,
      text: c.text,
      kind: /\d/.test(c.text) ? ("number" as const) : ("keyword" as const),
    }));
  const imageDur = 2.8;
  const images: NonNullable<Edl["images"]> = (direction.images ?? [])
    .filter((im) => words[im.word] && typeof im.path === "string")
    .map((im) => ({ at: words[im.word].start, duration: imageDur, path: im.path }))
    .sort((a, b) => a.at - b.at)
    .filter((im, i, arr) => i === 0 || im.at - arr[i - 1].at >= imageDur);
  const underImage = (t: number, before = 0.3) => images.some((im) => t >= im.at - before && t <= im.at + im.duration);
  // la imagen ocupa la parte de arriba: ahí no van textos animados
  for (let i = callouts.length - 1; i >= 0; i--) if (underImage(callouts[i].at, callouts[i].duration)) callouts.splice(i, 1);
  const underCallout = (t: number) => callouts.some((c) => t >= c.at - 0.3 && t <= c.at + c.duration);

  const emojiY = style.captions.position === "upper" ? 0.62 : 0.31;
  const emojis: Edl["emojis"] = (style.emojis.density === "none" ? [] : direction.emojis)
    .filter((e) => words[e.word] && !removed.has(e.word) && !underImage(words[e.word].start))
    .map((e, k) => {
      const at = words[e.word].start;
      // si hay un texto animado arriba en ese momento, el emoji baja un poco para no encimarse
      const shift = underCallout(at) && style.captions.position !== "upper" ? 0.1 : 0;
      return { at, duration: 1.4, emoji: e.emoji, x: k % 2 === 0 ? 0.76 : 0.24, y: emojiY + shift + (k % 3) * 0.03 };
    });

  const sfx: Edl["sfx"] = [];
  if (style.sfx.enabled) {
    if (style.sfx.onZoom !== "none" && style.zoom.style !== "smooth")
      zooms.forEach((z) => sfx.push({ at: z.at, kind: style.sfx.onZoom as SfxKind }));
    if (style.sfx.onEmoji !== "none")
      emojis.forEach((e) => sfx.push({ at: e.at, kind: style.sfx.onEmoji as SfxKind }));
    images.forEach((im) => sfx.push({ at: im.at, kind: "whoosh" }));
    if (style.sfx.onCut !== "none")
      segments.slice(1).forEach((s) => sfx.push({ at: s.start, kind: style.sfx.onCut as SfxKind }));
  }
  sfx.sort((a, b) => a.at - b.at);
  // no amontonar sonidos
  const sfxClean = sfx.filter((s, i) => i === 0 || s.at - sfx[i - 1].at > 0.35);

  const hook =
    style.overlays.hookTitle && direction.hookTitle ? { text: direction.hookTitle, duration: 2.6 } : null;

  return {
    version: 1,
    fps,
    width: opts.width ?? 1080,
    height: opts.height ?? 1920,
    sourceDuration,
    segments,
    words: kept.map(({ _i, ...w }) => (void _i, w)),
    zooms,
    emojis,
    sfx: sfxClean,
    hookTitle: hook,
    callouts,
    images,
    music: style.music?.enabled && direction.music ? { ...direction.music, volume: style.music.volume, duck: style.music.duck } : null,
    cta: style.motion?.endCard ? (direction.cta ?? null) : null,
  };
}

function computeSegments(words: Word[], removed: Set<number>, duration: number, style: EditStyle) {
  const gapMax = style.pacing.cutSilencesOverMs / 1000;
  const pad = style.pacing.keepPaddingMs / 1000;
  if (!words.length || !(duration > 0)) return [{ start: 0, end: Math.max(duration, 0.1) }];

  type Seg = { start: number; end: number; hardStart?: number; hardEnd?: number };
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  let forceCut = false;
  let removedStart: number | null = null;
  let removedEnd: number | null = null;

  words.forEach((w, i) => {
    if (removed.has(i)) {
      if (!forceCut) removedStart = w.start;
      removedEnd = w.end;
      forceCut = true;
      return;
    }
    if (!cur) {
      cur = { start: w.start, end: w.end, hardStart: forceCut ? removedEnd ?? undefined : undefined };
    } else if (forceCut || w.start - cur.end > gapMax) {
      // en un corte forzado (muletilla / toma mala) el padding no puede comerse lo borrado
      if (forceCut && removedStart !== null) cur.hardEnd = removedStart;
      segs.push(cur);
      cur = { start: w.start, end: w.end, hardStart: forceCut ? removedEnd ?? undefined : undefined };
    } else {
      cur.end = w.end;
    }
    forceCut = false;
    removedStart = null;
  });
  if (cur) segs.push(cur);

  // padding sin encimar segmentos
  const padded = segs.map((s) => ({
    start: Math.max(0, s.hardStart ?? -Infinity, s.start - pad),
    end: Math.min(duration, s.hardEnd ?? Infinity, s.end + pad),
  }));
  for (let i = 1; i < padded.length; i++) {
    if (padded[i].start < padded[i - 1].end) {
      const mid = (segs[i - 1].end + segs[i].start) / 2;
      padded[i - 1].end = mid;
      padded[i].start = mid;
    }
  }
  const out = padded
    .filter((s) => s.end - s.start > 0.08)
    .map((s) => ({ start: +s.start.toFixed(3), end: +s.end.toFixed(3) }));
  // nunca regresar un video vacío
  return out.length ? out : [{ start: 0, end: duration }];
}

// ───────────────────────────── Timeline map ───────────────────────────

/** Convierte segundo del original → segundo del video final (null si se cortó). */
export function makeTimeMap(segments: Edl["segments"]) {
  const offsets: number[] = [];
  let acc = 0;
  for (const s of segments) {
    offsets.push(acc);
    acc += s.end - s.start;
  }
  const total = acc;
  const toOut = (t: number): number | null => {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (t >= s.start && t <= s.end) return offsets[i] + (t - s.start);
    }
    return null;
  };
  /** como toOut pero si cae en un corte lo pega al inicio del siguiente segmento */
  const toOutSnap = (t: number): number | null => {
    const direct = toOut(t);
    if (direct !== null) return direct;
    const i = segments.findIndex((s) => s.start > t);
    return i === -1 ? null : offsets[i];
  };
  return { total, offsets, toOut, toOutSnap };
}
