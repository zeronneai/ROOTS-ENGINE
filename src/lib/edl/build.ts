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
};

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

  const perMin = EMOJIS_PER_MINUTE[style.emojis.density];
  if (perMin > 0) {
    const gap = 60 / perMin;
    let last = -Infinity;
    let p = 0;
    words.forEach((w, i) => {
      if (removed.has(i) || w.start - last < gap) return;
      const n = norm(w.text);
      const dict = KEYWORD_EMOJI[n];
      if (dict || (emphasis.includes(i) && style.emojis.palette.length)) {
        emojis.push({ word: i, emoji: dict ?? style.emojis.palette[p++ % style.emojis.palette.length] });
        last = w.start;
      }
    });
  }

  return { removeWords, emphasis, zooms, emojis, hookTitle: hookTitle ?? null };
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

  const segments = computeSegments(words, removed, sourceDuration, style);

  const kept = words
    .map((w, i) => ({ ...w, emphasis: emph.has(i) || undefined, _i: i }))
    .filter((w) => !removed.has(w._i));

  const nextCutAfter = (t: number) => segments.find((s) => s.end > t)?.end ?? sourceDuration;

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

  const emojiY = style.captions.position === "upper" ? 0.62 : 0.31;
  const emojis: Edl["emojis"] = (style.emojis.density === "none" ? [] : direction.emojis)
    .filter((e) => words[e.word] && !removed.has(e.word))
    .map((e, k) => ({
      at: words[e.word].start,
      duration: 1.4,
      emoji: e.emoji,
      x: k % 2 === 0 ? 0.76 : 0.24,
      y: emojiY + (k % 3) * 0.03,
    }));

  const sfx: Edl["sfx"] = [];
  if (style.sfx.enabled) {
    if (style.sfx.onZoom !== "none" && style.zoom.style !== "smooth")
      zooms.forEach((z) => sfx.push({ at: z.at, kind: style.sfx.onZoom as SfxKind }));
    if (style.sfx.onEmoji !== "none")
      emojis.forEach((e) => sfx.push({ at: e.at, kind: style.sfx.onEmoji as SfxKind }));
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
  };
}

function computeSegments(words: Word[], removed: Set<number>, duration: number, style: EditStyle) {
  const gapMax = style.pacing.cutSilencesOverMs / 1000;
  const pad = style.pacing.keepPaddingMs / 1000;
  if (!words.length) return [{ start: 0, end: duration }];

  const segs: { start: number; end: number }[] = [];
  let cur: { start: number; end: number } | null = null;
  let forceCut = false;

  words.forEach((w, i) => {
    if (removed.has(i)) {
      forceCut = true;
      return;
    }
    if (!cur) {
      cur = { start: w.start, end: w.end };
    } else if (forceCut || w.start - cur.end > gapMax) {
      segs.push(cur);
      cur = { start: w.start, end: w.end };
    } else {
      cur.end = w.end;
    }
    forceCut = false;
  });
  if (cur) segs.push(cur);

  // padding sin encimar segmentos
  const padded = segs.map((s) => ({ start: Math.max(0, s.start - pad), end: Math.min(duration, s.end + pad) }));
  for (let i = 1; i < padded.length; i++) {
    if (padded[i].start < padded[i - 1].end) {
      const mid = (segs[i - 1].end + segs[i].start) / 2;
      padded[i - 1].end = mid;
      padded[i].start = mid;
    }
  }
  return padded
    .filter((s) => s.end - s.start > 0.08)
    .map((s) => ({ start: +s.start.toFixed(3), end: +s.end.toFixed(3) }));
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
