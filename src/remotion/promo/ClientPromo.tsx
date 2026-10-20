import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import { useFonts } from "../fonts";
import { C, Card, Chip, DISPLAY, ease, IN_OUT, Kicker, MockFlyer, Orb, Phone, Ring, SANS } from "./Promo";

/**
 * Promo para clientes con voz: tipografía cinética sincronizada con lo que dice la voz.
 * Español o inglés, 16:9 o 9:16. Cada frase del guion es una escena; las palabras aparecen cuando se dicen
 * (posición estimada por letras, o tiempos reales medidos con `npm run promo:clientes`).
 */

const FPS = 30;
export type Lang = "es" | "en";

/** El guion, frase por frase (igual al audio). */
export const CLIENT_SCRIPT: Record<Lang, string[]> = {
  es: [
    "¿Tienes un negocio y nunca sabes qué publicar?",
    "Te presento Roots Engine.",
    "Primero, estudia tu mercado y a tu competencia, y te dice exactamente qué está funcionando.",
    "Cada semana te da tu plan: qué grabar, el gancho, y hasta el guion.",
    "¿Viene Halloween, o un evento importante? Te arma la campaña completa.",
    "Tú grabas con tu celular, y el motor edita solo: corta las pausas, pone subtítulos, emojis, música, y hasta corrige el color.",
    "¿Necesitas un flyer? Lo diseña con tu marca, en segundos.",
    "Todo en un solo lugar, en español y en inglés.",
    "Roots Engine, de Purple Roots. Tú grabas. Nosotros hacemos que se vea increíble.",
  ],
  en: [
    "Run a business and never know what to post?",
    "Meet Roots Engine.",
    "First, it studies your market and your competitors, and tells you exactly what's working.",
    "Every week, you get your plan: what to film, the hook, and even the script.",
    "Halloween coming up, or a big event? It builds the whole campaign for you.",
    "You film on your phone, and the engine edits it for you: it cuts the pauses, adds captions, emojis, music, and even fixes the color.",
    "Need a flyer? It designs one with your brand, in seconds.",
    "Everything in one place, in English and in Spanish.",
    "Roots Engine, by Purple Roots. You film. We make it look incredible.",
  ],
};

/** Textos en pantalla de cada escena (cada línea es parte exacta de la frase que se dice). */
const COPY = {
  es: {
    s1: { lines: ["¿Tienes un negocio", "y nunca sabes", "qué publicar?"], hi: "publicar" },
    s2: { intro: "Te presento", key: "Roots" },
    s3: { kicker: "Investigación", lines: ["estudia tu mercado", "y a tu competencia,", "qué está funcionando."], hi: "mercado", comp: "competencia", work: "qué está", tags: ["Humor de equipo", "Antes y después", "Promo con precio"], win: "✓ Funciona", handle: "@competidor_" },
    s4: { kicker: "Plan semanal", title: "Cada semana te da tu plan:", items: ["qué grabar,", "el gancho,", "y hasta el guion."], days: ["L", "M", "M", "J", "V", "S", "D"] },
    s5: { lines: ["¿Viene Halloween,", "o un evento importante?", "la campaña completa."], hi: "Halloween", key: "Halloween", build: "Te arma", chips: ["Calentamiento", "Día del evento", "Recap", "Sketch de comedia", "Trend", "Flyer"] },
    s6: {
      kicker: "Auto-edición",
      lines: ["Tú grabas con tu celular,", "el motor edita solo:"],
      hi: "solo",
      start: "el motor",
      feats: [
        { phrase: "corta las pausas", label: "Corta las pausas", icon: "✂️" },
        { phrase: "subtítulos", label: "Subtítulos", icon: "💬" },
        { phrase: "emojis", label: "Emojis", icon: "😎" },
        { phrase: "música", label: "Música", icon: "🎵" },
        { phrase: "corrige el color", label: "Corrige el color", icon: "🎨" },
      ],
      caption: ["ESTO", "CAMBIA", "TODO"],
    },
    s7: { kicker: "Flyers con IA", lines: ["¿Necesitas un flyer?", "Lo diseña con tu marca,", "en segundos."], hi: "segundos", make: "Lo diseña", fast: "en segundos" },
    s8: { lines: ["Todo en un solo lugar,", "en español y en inglés."], hi: "solo", langAt: "en español", switchAt: "inglés", toggle: ["ES", "EN"], feats: ["Investigación", "Plan semanal", "Campañas", "Auto-edición", "Flyers", "Rebranding"] },
    s9: { lines: ["Tú grabas.", "Nosotros hacemos que se vea increíble."], hi: "increíble", end: "increíble", cta: "Pide tu demo" },
  },
  en: {
    s1: { lines: ["Run a business", "and never know", "what to post?"], hi: "post" },
    s2: { intro: "Meet", key: "Roots" },
    s3: { kicker: "Research", lines: ["it studies your market", "and your competitors,", "exactly what's working."], hi: "market", comp: "competitors", work: "exactly what's", tags: ["Team comedy", "Before and after", "Price promo"], win: "✓ Working", handle: "@competitor_" },
    s4: { kicker: "Weekly plan", title: "Every week, you get your plan:", items: ["what to film,", "the hook,", "and even the script."], days: ["M", "T", "W", "T", "F", "S", "S"] },
    s5: { lines: ["Halloween coming up,", "or a big event?", "the whole campaign for you."], hi: "Halloween", key: "Halloween", build: "It builds", chips: ["Warm-up", "Event day", "Recap", "Comedy sketch", "Trend", "Flyer"] },
    s6: {
      kicker: "Auto-edit",
      lines: ["You film on your phone,", "the engine edits it for you:"],
      hi: "edits",
      start: "the engine",
      feats: [
        { phrase: "cuts the pauses", label: "Cuts the pauses", icon: "✂️" },
        { phrase: "captions", label: "Captions", icon: "💬" },
        { phrase: "emojis", label: "Emojis", icon: "😎" },
        { phrase: "music", label: "Music", icon: "🎵" },
        { phrase: "fixes the color", label: "Fixes the color", icon: "🎨" },
      ],
      caption: ["THIS", "CHANGES", "EVERYTHING"],
    },
    s7: { kicker: "AI flyers", lines: ["Need a flyer?", "It designs one with your brand,", "in seconds."], hi: "seconds", make: "It designs", fast: "in seconds" },
    s8: { lines: ["Everything in one place,", "in English and in Spanish."], hi: "one", langAt: "in English", switchAt: "Spanish", toggle: ["EN", "ES"], feats: ["Research", "Weekly plan", "Campaigns", "Auto-edit", "Flyers", "Rebranding"] },
    s9: { lines: ["You film.", "We make it look incredible."], hi: "incredible", end: "incredible", cta: "Book a demo" },
  },
} as const;

export type ClientPromoProps = {
  lang: Lang;
  /** inicio y fin (segundos) de cada frase del guion */
  segments: { start: number; end: number }[];
  duration: number;
  voice: string | null;
};

/** Archivos de voz y tiempos de cada idioma (en public/). */
export const VOICE_FILES: Record<Lang, { mp3: string; json: string; seconds: number }> = {
  es: { mp3: "promo/voz-clientes.mp3", json: "promo/voz-clientes.json", seconds: 42.76 },
  en: { mp3: "promo/voice-clients-en.mp3", json: "promo/voice-clients-en.json", seconds: 45.4 },
};

/** Tiempos estimados por número de letras (cuando no hay audio medido). */
export function estimateSegments(lang: Lang, total = VOICE_FILES[lang].seconds, lead = 0.25, gap = 0.42) {
  const chars = CLIENT_SCRIPT[lang].map((s) => s.length);
  const speech = total - lead - gap * (chars.length - 1);
  const per = speech / chars.reduce((a, b) => a + b, 0);
  let t = lead;
  return chars.map((c) => {
    const seg = { start: +t.toFixed(3), end: +(t + c * per).toFixed(3) };
    t += c * per + gap;
    return seg;
  });
}

export const calculateClientPromoMetadata: CalculateMetadataFunction<ClientPromoProps> = async ({ props }) => {
  let p = props;
  const files = VOICE_FILES[props.lang];
  try {
    const res = await fetch(staticFile(files.json));
    if (res.ok) {
      const j = (await res.json()) as { duration: number; segments: { start: number; end: number }[] };
      if (j.segments?.length === CLIENT_SCRIPT[props.lang].length) p = { ...props, segments: j.segments, duration: j.duration, voice: files.mp3 };
    }
  } catch {
    // sin audio medido: usamos los tiempos estimados
  }
  return { durationInFrames: Math.ceil((p.duration + 2.4) * FPS), props: p };
};

// ───────────────────────────── utilidades ─────────────────────────────

type Seg = { s: number; e: number; text: string }; // frames locales de la escena

/** Frame (local) en que se dice el carácter `charIndex` de la frase. */
const at = (seg: Seg, charIndex: number) => seg.s + (charIndex / seg.text.length) * (seg.e - seg.s);

/** Frame en que se dice `phrase` dentro de la frase del segmento. */
const when = (seg: Seg, phrase: string) => at(seg, Math.max(0, seg.text.indexOf(phrase)));

/** ¿Video vertical? */
const useV = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** Efecto de sonido en un frame de la escena. */
const Sfx: React.FC<{ at: number; kind: "whoosh" | "pop" | "click" | "ding" | "boom"; volume?: number }> = ({ at: f, kind, volume = 0.22 }) => (
  <Sequence from={Math.max(0, Math.round(f))} durationInFrames={45} layout="none">
    <Audio src={staticFile(`sfx/${kind}.mp3`)} volume={volume} />
  </Sequence>
);

/**
 * Una línea de palabras sincronizadas: cada palabra entra (escala, desenfoque y subida) justo cuando se dice.
 */
const KLine: React.FC<{
  seg: Seg;
  text: string;
  size: number;
  color?: string;
  weight?: number;
  font?: string;
  hi?: string;
  hiColor?: string;
  align?: "center" | "left";
  style?: "rise" | "slam";
  tracking?: number;
}> = ({ seg, text, size, color = C.ink, weight = 800, font = SANS, hi, hiColor = C.sun, align = "center", style = "rise", tracking = -0.04 }) => {
  const f = useCurrentFrame();
  const base = Math.max(0, seg.text.indexOf(text));
  const words = text.split(" ");
  const starts = words.map((_, i) => words.slice(0, i).join(" ").length + (i ? 1 : 0));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", textAlign: align, gap: `0 ${size * 0.24}px`, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.04, letterSpacing: `${tracking}em`, color }}>
      {words.map((w, i) => {
        const start = at(seg, base + starts[i]) - 3;
        const p = ease(f, start, style === "slam" ? 10 : 16);
        const isHi = !!hi && w.replace(/[.,:¿?!]/g, "") === hi;
        const transform = style === "slam" ? `scale(${interpolate(p, [0, 1], [2.4, 1])})` : `translateY(${(1 - p) * size * 0.45}px) scale(${0.9 + 0.1 * p})`;
        const hiP = ease(f, start + 6, 14, 0, 100, IN_OUT);
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", opacity: p, filter: `blur(${(1 - p) * 16}px)`, transform }}>
            {isHi ? <span style={{ position: "absolute", left: -size * 0.07, right: -size * 0.07, bottom: size * 0.05, height: size * 0.38, background: hiColor, borderRadius: size * 0.06, clipPath: `inset(0 ${100 - hiP}% 0 0)`, zIndex: -1 }} /> : null}
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Fondo de escena (claro u oscuro) con entrada y salida suaves. */
const Stage: React.FC<{ len: number; dark?: boolean; children: React.ReactNode }> = ({ len, dark, children }) => {
  const f = useCurrentFrame();
  const inP = ease(f, 0, 12);
  const outP = ease(f, len - 10, 10, 0, 1, IN_OUT);
  const bg = dark
    ? `radial-gradient(900px 700px at 50% 115%, rgba(79,71,137,0.6), transparent 65%), radial-gradient(700px 500px at 85% -10%, rgba(252,231,98,0.12), transparent 60%), ${C.night}`
    : `radial-gradient(1100px 800px at 88% -10%, rgba(252,231,98,0.35), transparent 60%), radial-gradient(900px 700px at -5% 110%, rgba(255,177,122,0.28), transparent 60%), #ffffff`;
  return (
    <AbsoluteFill style={{ background: bg, opacity: inP * (1 - outP), transform: `scale(${1.04 - 0.04 * inP + outP * 0.06})`, filter: `blur(${outP * 14}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

const Center: React.FC<{ children: React.ReactNode; gap?: number; style?: React.CSSProperties }> = ({ children, gap = 18, style }) => {
  const v = useV();
  return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap, padding: v ? "0 70px" : "0 140px", ...style }}>{children}</AbsoluteFill>;
};

/** Aparece en un frame dado. */
const Pop: React.FC<{ from: number; children: React.ReactNode; y?: number; style?: React.CSSProperties }> = ({ from, children, y = 40, style }) => {
  const f = useCurrentFrame();
  const p = ease(f, from, 18);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px) scale(${0.92 + 0.08 * p})`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>{children}</div>;
};

// ───────────────────────────── escenas ─────────────────────────────

type SceneProps = { seg: Seg; len: number; lang: Lang };

/** 1. El problema. */
const S1: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const v = useV();
  const c = COPY[lang].s1;
  return (
    <Stage len={len} dark>
      <Orb x={v ? 180 : 260} y={v ? 380 : 260} r={60} color={C.purple} />
      <Orb x={v ? 900 : 1680} y={v ? 1500 : 820} r={44} color={C.peach} delay={10} />
      <Center gap={10}>
        <KLine seg={seg} text={c.lines[0]} size={v ? 84 : 92} color="rgba(255,255,255,0.75)" weight={600} />
        <KLine seg={seg} text={c.lines[1]} size={v ? 84 : 92} color="rgba(255,255,255,0.75)" weight={600} />
        <div style={{ height: v ? 20 : 0 }} />
        <KLine seg={seg} text={c.lines[2]} size={v ? 150 : 190} color={C.white} style="slam" hi={c.hi} hiColor={C.purple} />
      </Center>
      <Sfx at={when(seg, c.lines[2]) - 2} kind="boom" volume={0.3} />
    </Stage>
  );
};

/** 2. Logo: las letras se juntan. */
const S2: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s2;
  const t = when(seg, c.key);
  const p = ease(f, t - 4, 34);
  const glow = ease(f, t + 10, 30);
  return (
    <Stage len={len} dark>
      <Ring x={v ? 860 : 1500} y={v ? 420 : 260} size={150} color={C.sun} delay={t} />
      <Orb x={v ? 200 : 380} y={v ? 1480 : 800} r={56} color={C.purple} delay={t} />
      <Center gap={34}>
        <KLine seg={seg} text={c.intro} size={56} color="rgba(255,255,255,0.7)" weight={600} />
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", alignItems: "center", gap: v ? 30 : 40, opacity: p, transform: `scale(${0.9 + 0.1 * p})` }}>
          <Img src={staticFile("brand/pr-icon.png")} style={{ height: v ? 170 : 150, width: "auto", filter: `drop-shadow(0 0 ${40 * glow}px rgba(252,231,98,0.6))` }} />
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: v ? 104 : 132, lineHeight: 1, textAlign: "center", color: C.white, letterSpacing: `${interpolate(p, [0, 1], [0.9, 0.06])}em`, textShadow: `0 0 ${60 * glow}px rgba(252,231,98,0.35)` }}>
            {v ? (
              <>
                ROOTS
                <br />
                ENGINE
              </>
            ) : (
              "ROOTS ENGINE"
            )}
          </div>
        </div>
      </Center>
      <Sfx at={t - 6} kind="whoosh" volume={0.3} />
      <Sfx at={t + 14} kind="ding" volume={0.2} />
    </Stage>
  );
};

/** 3. Investigación de mercado y competencia. */
const S3: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s3;
  const tComp = when(seg, c.comp);
  const tWork = when(seg, c.work);
  const values = [0.92, 0.58, 0.31];
  return (
    <Stage len={len}>
      <AbsoluteFill style={{ padding: v ? "180px 70px" : "120px 140px", flexDirection: v ? "column" : "row", alignItems: v ? "stretch" : "center", justifyContent: "center", gap: v ? 80 : 90 }}>
        <div style={{ flex: v ? undefined : 1, display: "flex", flexDirection: "column", gap: 22 }}>
          <Kicker text={c.kicker} at={seg.s - 6} />
          <KLine seg={seg} text={c.lines[0]} size={v ? 96 : 104} align="left" hi={c.hi} />
          <KLine seg={seg} text={c.lines[1]} size={v ? 96 : 104} align="left" />
          <div style={{ height: 14 }} />
          <KLine seg={seg} text={c.lines[2]} size={64} align="left" weight={700} color={C.purple} />
        </div>
        <div style={{ width: v ? undefined : 640, display: "flex", flexDirection: "column", gap: 22 }}>
          {values.map((val, i) => {
            const s = tComp + i * 6;
            const fill = ease(f, s + 10, 30) * val;
            const win = i === 0 && f > tWork;
            return (
              <Pop key={i} from={s} y={60}>
                <Card style={{ padding: 26, display: "flex", flexDirection: "column", gap: 14, outline: win ? `3px solid ${C.sun}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, fontWeight: 700 }}>
                    <span>{c.handle}{i + 1}</span>
                    <Chip bg={win ? C.sun : "#f0eef5"}>{win ? c.win : c.tags[i]}</Chip>
                  </div>
                  <div style={{ height: 14, borderRadius: 99, background: "#f0eef5", overflow: "hidden" }}>
                    <div style={{ width: `${fill * 100}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${C.purple}, ${C.peach})` }} />
                  </div>
                </Card>
              </Pop>
            );
          })}
        </div>
      </AbsoluteFill>
      {values.map((_, i) => <Sfx key={i} at={tComp + i * 6} kind="pop" volume={0.16} />)}
      <Sfx at={tWork + 2} kind="ding" volume={0.22} />
    </Stage>
  );
};

/** 4. Plan semanal. */
const S4: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s4;
  return (
    <Stage len={len}>
      <Center gap={v ? 70 : 50}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Kicker text={c.kicker} at={seg.s - 6} />
          <KLine seg={seg} text={c.title} size={v ? 76 : 78} />
        </div>
        <div style={{ display: "flex", gap: v ? 12 : 16 }}>
          {c.days.map((d, i) => {
            const p = ease(f, seg.s + 4 + i * 3, 14);
            const on = i % 2 === 0;
            return (
              <div key={i} style={{ width: v ? 116 : 96, height: v ? 116 : 96, borderRadius: 24, display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: 800, fontSize: 36, background: on ? C.purple : "#f0eef5", color: on ? C.white : C.muted, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
                {d}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", gap: v ? 34 : 60, alignItems: v ? "flex-start" : "baseline" }}>
          {c.items.map((it) => {
            const t = when(seg, it);
            const k = ease(f, t + 8, 12);
            return (
              <div key={it} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ width: 56, height: 56, borderRadius: 99, background: C.sun, display: "grid", placeItems: "center", fontSize: 32, fontWeight: 900, fontFamily: SANS, color: C.ink, transform: `scale(${k})` }}>✓</span>
                <KLine seg={seg} text={it} size={v ? 80 : 66} style="slam" />
              </div>
            );
          })}
        </div>
      </Center>
      {c.items.map((it) => <Sfx key={it} at={when(seg, it) + 8} kind="click" volume={0.3} />)}
    </Stage>
  );
};

/** 5. Campañas por fecha o evento. */
const S5: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s5;
  const tH = when(seg, c.key);
  const tC = when(seg, c.build);
  const pumpkin = ease(f, tH, 16);
  return (
    <Stage len={len} dark>
      <Center gap={26}>
        <div style={{ fontSize: v ? 190 : 150, transform: `scale(${pumpkin}) rotate(${(1 - pumpkin) * -30 + Math.sin(f / 6) * 4}deg)`, opacity: pumpkin }}>🎃</div>
        <KLine seg={seg} text={c.lines[0]} size={v ? 100 : 110} color={C.white} hi={c.hi} hiColor={C.peach} />
        <KLine seg={seg} text={c.lines[1]} size={64} color="rgba(255,255,255,0.75)" weight={600} />
        <div style={{ height: v ? 30 : 10 }} />
        <KLine seg={seg} text={c.lines[2]} size={v ? 100 : 96} color={C.sun} style="slam" />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: v ? 900 : 1200, marginTop: v ? 20 : 0 }}>
          {c.chips.map((x, i) => (
            <Pop key={x} from={tC + 10 + i * 3} y={20}>
              <span style={{ borderRadius: 99, padding: "10px 22px", background: "rgba(255,255,255,0.12)", color: C.white, fontFamily: SANS, fontWeight: 600, fontSize: 28 }}>{x}</span>
            </Pop>
          ))}
        </div>
      </Center>
      <Sfx at={tH} kind="pop" volume={0.28} />
      <Sfx at={when(seg, c.lines[2]) - 2} kind="boom" volume={0.22} />
      {c.chips.map((x, i) => (i % 2 === 0 ? <Sfx key={x} at={tC + 10 + i * 3} kind="pop" volume={0.12} /> : null))}
    </Stage>
  );
};

/** 6. Auto-edición: el clip pasa de gris a editado mientras se nombran las funciones. */
const S6: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s6;
  const times = c.feats.map((x) => when(seg, x.phrase));
  const idx = times.reduce((a, t, i) => (f >= t - 2 ? i : a), -1);
  const colorP = ease(f, times[4], 20);
  const capP = ease(f, times[1], 10);
  const emojiP = ease(f, times[2], 12);
  const tEdit = when(seg, c.start);
  const featSize = v ? 78 : 96;
  return (
    <Stage len={len}>
      <AbsoluteFill style={{ padding: v ? "150px 70px" : "100px 150px", flexDirection: v ? "column" : "row", alignItems: "center", justifyContent: "center", gap: v ? 50 : 110 }}>
        <div style={{ flex: v ? undefined : 1, width: v ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 18 }}>
          <Kicker text={c.kicker} at={seg.s - 6} />
          <KLine seg={seg} text={c.lines[0]} size={v ? 60 : 70} align="left" weight={700} color={C.muted} />
          <KLine seg={seg} text={c.lines[1]} size={v ? 84 : 100} align="left" hi={c.hi} />
          {/* lista que va girando como tragamonedas */}
          <div style={{ position: "relative", height: featSize * 1.35, overflow: "hidden", marginTop: 12 }}>
            {c.feats.map((x, i) => {
              const p = ease(f, times[i] - 2, 10);
              const out = i < idx ? ease(f, times[i + 1] - 2, 10) : 0;
              return (
                <div key={x.label} style={{ position: "absolute", left: 0, top: 0, display: "flex", alignItems: "center", gap: 22, whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: featSize, letterSpacing: "-0.04em", color: C.purple, opacity: p * (1 - out), transform: `translateY(${(1 - p) * 120 - out * 120}px)` }}>
                  <span>{x.icon}</span>
                  {x.label}
                </div>
              );
            })}
          </div>
        </div>
        <Pop from={tEdit - 4} y={80}>
          <Phone w={v ? 360 : 380} rotY={v ? -6 : -12} rotX={4}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #c9a27e, #6b4a3a 55%, #2e2230)", filter: `saturate(${0.25 + 0.85 * colorP}) brightness(${0.75 + 0.3 * colorP}) contrast(${0.9 + 0.15 * colorP})` }} />
            <div style={{ position: "absolute", left: "50%", top: "38%", transform: "translate(-50%,-50%)", width: 170, height: 170, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #f6d2b8, #b98466 60%, #6b4a3a)", filter: `saturate(${0.3 + 0.8 * colorP})` }} />
            <div style={{ position: "absolute", left: 20, right: 20, bottom: 150, textAlign: "center", fontFamily: SANS, fontWeight: 900, fontSize: 32, color: C.white, textShadow: "0 3px 12px rgba(0,0,0,0.6)", opacity: capP, transform: `scale(${0.8 + 0.2 * capP})` }}>
              {c.caption[0]} <span style={{ color: C.sun }}>{c.caption[1]}</span> {c.caption[2]}
            </div>
            <div style={{ position: "absolute", right: 34, top: 120, fontSize: 64, opacity: emojiP, transform: `scale(${emojiP}) rotate(${(1 - emojiP) * 40}deg)` }}>🔥</div>
            <div style={{ position: "absolute", left: 22, right: 22, bottom: 60, height: 36, display: "flex", gap: 4 }}>
              {[0.24, 0.18, 0.3, 0.12, 0.16].map((w, i) => {
                const cut = ease(f, times[0] + i * 2, 10);
                return <div key={i} style={{ flex: w, borderRadius: 6, background: i % 2 ? C.peach : C.sun, opacity: 0.4 + 0.6 * cut, transform: `scaleY(${0.5 + 0.5 * cut})` }} />;
              })}
            </div>
          </Phone>
        </Pop>
      </AbsoluteFill>
      <Sfx at={tEdit - 4} kind="whoosh" volume={0.18} />
      {times.map((t, i) => <Sfx key={i} at={t - 2} kind={i === 4 ? "ding" : "click"} volume={i === 4 ? 0.22 : 0.28} />)}
    </Stage>
  );
};

/** 7. Flyers. */
const S7: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s7;
  const tL = when(seg, c.make);
  const tS = when(seg, c.fast);
  const fly: { k: "karaoke" | "tacos" | "glow"; x: number; r: number }[] = [
    { k: "tacos", x: v ? -290 : -330, r: -10 },
    { k: "glow", x: 0, r: 0 },
    { k: "karaoke", x: v ? 290 : 330, r: 10 },
  ];
  const tick = ease(f, tS, 24);
  const W = v ? 280 : 300;
  return (
    <Stage len={len}>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: v ? 220 : 100, gap: 18, padding: v ? "220px 70px 0" : "100px 140px 0" }}>
        <Kicker text={c.kicker} at={seg.s - 6} />
        <KLine seg={seg} text={c.lines[0]} size={v ? 100 : 92} />
        <KLine seg={seg} text={c.lines[1]} size={v ? 58 : 56} weight={600} color={C.muted} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 10, opacity: ease(f, tS - 2, 10) }}>
          <svg width="90" height="90" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="46" fill="none" stroke="#f0eef5" strokeWidth="10" />
            <circle cx="55" cy="55" r="46" fill="none" stroke={C.purple} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${289 * tick} 289`} transform="rotate(-90 55 55)" />
          </svg>
          <KLine seg={seg} text={c.lines[2]} size={64} align="left" hi={c.hi} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: v ? 260 : 30 }}>
        <div style={{ position: "relative", width: 1000, height: W * 1.25 + 80 }}>
          {fly.map((x, i) => {
            const p = ease(f, tL + i * 4, 22);
            return (
              <div key={x.k} style={{ position: "absolute", left: 500 - W / 2 + x.x * p, top: 40 + (1 - p) * 300, transform: `rotate(${x.r * p}deg)`, opacity: p }}>
                <MockFlyer kind={x.k} w={W} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {fly.map((x, i) => <Sfx key={x.k} at={tL + i * 4} kind="whoosh" volume={0.14} />)}
      <Sfx at={tS + 22} kind="ding" volume={0.24} />
    </Stage>
  );
};

/** 8. Todo en un lugar, bilingüe. */
const S8: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const { width, height } = useVideoConfig();
  const c = COPY[lang].s8;
  const tLang = when(seg, c.langAt);
  const tSwitch = when(seg, c.switchAt);
  const gather = ease(f, seg.s, 40);
  const toggle = ease(f, tSwitch, 14);
  const rx = v ? 380 : 780;
  const ry = v ? 720 : 390;
  return (
    <Stage len={len} dark>
      {c.feats.map((x, i) => {
        const a = (i / c.feats.length) * Math.PI * 2 + f / 90;
        const r = interpolate(gather, [0, 1], [1.8, 1]);
        return (
          <div key={x} style={{ position: "absolute", left: width / 2 + Math.cos(a) * rx * r - 150, top: height / 2 + Math.sin(a) * ry * r - 30, width: 300, display: "flex", justifyContent: "center", opacity: gather * 0.85 }}>
            <span style={{ borderRadius: 99, padding: "12px 26px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: C.white, fontFamily: SANS, fontWeight: 600, fontSize: 28, whiteSpace: "nowrap" }}>{x}</span>
          </div>
        );
      })}
      <Center gap={30}>
        <KLine seg={seg} text={c.lines[0]} size={v ? 100 : 110} color={C.white} hi={c.hi} hiColor={C.purple} />
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", alignItems: "center", gap: 24, opacity: ease(f, tLang - 2, 12) }}>
          <div style={{ position: "relative", width: 260, height: 84, borderRadius: 99, background: "rgba(255,255,255,0.12)", display: "flex", fontFamily: SANS, fontWeight: 800, fontSize: 34 }}>
            <div style={{ position: "absolute", top: 7, left: 7 + toggle * 126, width: 120, height: 70, borderRadius: 99, background: C.sun }} />
            <span style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", color: toggle < 0.5 ? C.ink : C.white }}>{c.toggle[0]}</span>
            <span style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", color: toggle >= 0.5 ? C.ink : C.white }}>{c.toggle[1]}</span>
          </div>
          <KLine seg={seg} text={c.lines[1]} size={60} color="rgba(255,255,255,0.85)" weight={600} align={v ? "center" : "left"} />
        </div>
      </Center>
      <Sfx at={seg.s} kind="whoosh" volume={0.2} />
      <Sfx at={tSwitch} kind="click" volume={0.32} />
    </Stage>
  );
};

/** 9. Cierre. */
const S9: React.FC<SceneProps> = ({ seg, len, lang }) => {
  const f = useCurrentFrame();
  const v = useV();
  const c = COPY[lang].s9;
  const p = ease(f, seg.s - 2, 30);
  const tCta = when(seg, c.end) + 6;
  const cta = ease(f, tCta, 18);
  return (
    <Stage len={len + 30}>
      <Orb x={v ? 180 : 300} y={v ? 330 : 260} r={70} color={C.purple} />
      <Orb x={v ? 900 : 1640} y={v ? 1600 : 820} r={52} color={C.peach} delay={8} />
      <Ring x={v ? 880 : 1600} y={v ? 300 : 240} size={130} color={C.sun} delay={12} />
      <Center gap={28}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
          <Img src={staticFile("brand/pr-icon-purple.png")} style={{ height: 110, width: "auto" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderLeft: `2px solid ${C.line}`, paddingLeft: 28 }}>
            <Img src={staticFile("brand/pr-wordmark-purple.png")} style={{ height: 38, width: "auto" }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.32em", fontSize: 20, color: C.muted }}>ROOTS ENGINE</span>
          </div>
        </div>
        <div style={{ height: v ? 30 : 8 }} />
        <KLine seg={seg} text={c.lines[0]} size={v ? 90 : 84} color={C.muted} weight={700} />
        <KLine seg={seg} text={c.lines[1]} size={v ? 96 : 92} hi={c.hi} />
        <div style={{ opacity: cta, transform: `translateY(${(1 - cta) * 24}px)`, display: "flex", flexDirection: v ? "column" : "row", alignItems: "center", gap: 22, marginTop: v ? 40 : 14 }}>
          <span style={{ borderRadius: 99, background: C.purple, color: C.white, fontFamily: SANS, fontWeight: 700, fontSize: 32, padding: "20px 46px", boxShadow: "0 20px 40px -16px rgba(79,71,137,0.9)" }}>{c.cta}</span>
          <span style={{ fontFamily: SANS, fontSize: 28, color: C.muted }}>purpleroots.agency</span>
        </div>
      </Center>
      <Sfx at={seg.s - 2} kind="whoosh" volume={0.22} />
      <Sfx at={tCta} kind="ding" volume={0.3} />
    </Stage>
  );
};

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9];

export const ClientPromo: React.FC<ClientPromoProps> = ({ lang, segments, voice }) => {
  useFonts(["Inter", "Josefin Sans", "Anton", "Playfair Display"]);
  const LEAD = 8; // la escena entra un poco antes de que empiece la frase
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {segments.map((sg, i) => {
        const S = SCENES[i];
        const from = Math.max(0, Math.round(sg.start * FPS) - LEAD);
        const next = segments[i + 1] ? Math.round(segments[i + 1].start * FPS) - LEAD + 6 : Math.round((sg.end + 2.4) * FPS);
        const len = next - from;
        const seg: Seg = { s: Math.round(sg.start * FPS) - from, e: Math.round(sg.end * FPS) - from, text: CLIENT_SCRIPT[lang][i] };
        return (
          <Sequence key={i} from={from} durationInFrames={len + (i === segments.length - 1 ? 30 : 0)}>
            <S seg={seg} len={len} lang={lang} />
          </Sequence>
        );
      })}
      {voice ? <Audio src={staticFile(voice)} /> : null}
    </AbsoluteFill>
  );
};
