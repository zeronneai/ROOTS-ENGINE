import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { useFonts } from "../fonts";
import { C, Card, Chip, DISPLAY, ease, IN_OUT, Kicker, MockFlyer, Orb, Phone, Ring, SANS, Whoosh } from "./Promo";

/**
 * Promo para clientes, 16:9, con voz: tipografía cinética sincronizada con lo que dice la voz.
 * Cada frase del guion es una escena; las palabras aparecen cuando se dicen (posición estimada por letras,
 * o tiempos reales si existe public/promo/voz-clientes.json, que genera scripts/sync-promo-voice.ts).
 */

const FPS = 30;

/** El guion, frase por frase (igual al audio). */
export const CLIENT_SCRIPT = [
  "¿Tienes un negocio y nunca sabes qué publicar?",
  "Te presento Roots Engine.",
  "Primero, estudia tu mercado y a tu competencia, y te dice exactamente qué está funcionando.",
  "Cada semana te da tu plan: qué grabar, el gancho, y hasta el guion.",
  "¿Viene Halloween, o un evento importante? Te arma la campaña completa.",
  "Tú grabas con tu celular, y el motor edita solo: corta las pausas, pone subtítulos, emojis, música, y hasta corrige el color.",
  "¿Necesitas un flyer? Lo diseña con tu marca, en segundos.",
  "Todo en un solo lugar, en español y en inglés.",
  "Roots Engine, de Purple Roots. Tú grabas. Nosotros hacemos que se vea increíble.",
];

export type ClientPromoProps = {
  /** inicio y fin (segundos) de cada frase del guion */
  segments: { start: number; end: number }[];
  duration: number;
  voice: string | null;
};

/** Tiempos estimados por número de letras (cuando no hay audio medido). */
export function estimateSegments(total = 42.76, lead = 0.25, gap = 0.42) {
  const chars = CLIENT_SCRIPT.map((s) => s.length);
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
  try {
    const res = await fetch(staticFile("promo/voz-clientes.json"));
    if (res.ok) {
      const j = (await res.json()) as { duration: number; segments: { start: number; end: number }[] };
      if (j.segments?.length === CLIENT_SCRIPT.length) p = { ...props, segments: j.segments, duration: j.duration, voice: "promo/voz-clientes.mp3" };
    }
  } catch {
    // sin audio medido: usamos los tiempos estimados
  }
  return { durationInFrames: Math.ceil((p.duration + 2.4) * FPS), props: p, fps: FPS, width: 1920, height: 1080 };
};

// ───────────────────────────── tipografía cinética ─────────────────────────────

type Seg = { s: number; e: number; text: string }; // frames locales de la escena

/** Frame (local) en que se dice la palabra que empieza en `charIndex`. */
const at = (seg: Seg, charIndex: number) => seg.s + (charIndex / seg.text.length) * (seg.e - seg.s);

/** Frame en que se dice `phrase` dentro de la frase del segmento. */
const when = (seg: Seg, phrase: string) => {
  const i = seg.text.indexOf(phrase);
  return at(seg, Math.max(0, i));
};

/**
 * Una línea de palabras sincronizadas: cada palabra entra (escala, desenfoque y subida) justo cuando se dice.
 * `from` = parte de la frase del segmento donde empieza esta línea.
 */
const KLine: React.FC<{
  seg: Seg;
  text: string;
  size: number;
  color?: string;
  weight?: number;
  font?: string;
  hi?: string[];
  hiColor?: string;
  align?: "center" | "left";
  style?: "rise" | "slam" | "drop";
  tracking?: number;
}> = ({ seg, text, size, color = C.ink, weight = 800, font = SANS, hi = [], hiColor = C.sun, align = "center", style = "rise", tracking = -0.04 }) => {
  const f = useCurrentFrame();
  const base = Math.max(0, seg.text.indexOf(text));
  // posición de cada palabra dentro de la línea
  const words = text.split(" ");
  const starts = words.map((_, i) => words.slice(0, i).join(" ").length + (i ? 1 : 0));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.24}px`, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.02, letterSpacing: `${tracking}em`, color }}>
      {words.map((w, i) => {
        const idx = starts[i];
        const start = at(seg, base + idx) - 3;
        const p = ease(f, start, style === "slam" ? 10 : 16);
        const clean = w.replace(/[.,:¿?!]/g, "");
        const isHi = hi.includes(clean);
        const transform =
          style === "slam"
            ? `scale(${interpolate(p, [0, 1], [2.4, 1])})`
            : style === "drop"
              ? `translateY(${(1 - p) * -size * 0.7}px) rotate(${(1 - p) * -8}deg)`
              : `translateY(${(1 - p) * size * 0.45}px) scale(${0.9 + 0.1 * p})`;
        const hiP = ease(f, start + 6, 14, 0, 100, IN_OUT);
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", opacity: p, filter: `blur(${(1 - p) * 16}px)`, transform }}>
            {isHi ? (
              <span style={{ position: "absolute", left: -size * 0.07, right: -size * 0.07, bottom: size * 0.05, height: size * 0.38, background: hiColor, borderRadius: size * 0.06, clipPath: `inset(0 ${100 - hiP}% 0 0)`, zIndex: -1 }} />
            ) : null}
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
    ? `radial-gradient(900px 600px at 50% 120%, rgba(79,71,137,0.6), transparent 65%), radial-gradient(700px 500px at 85% -10%, rgba(252,231,98,0.12), transparent 60%), ${C.night}`
    : `radial-gradient(1100px 700px at 88% -10%, rgba(252,231,98,0.35), transparent 60%), radial-gradient(900px 600px at -5% 110%, rgba(255,177,122,0.28), transparent 60%), #ffffff`;
  return (
    <AbsoluteFill style={{ background: bg, opacity: inP * (1 - outP), transform: `scale(${1.04 - 0.04 * inP + outP * 0.06})`, filter: `blur(${outP * 14}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

const Center: React.FC<{ children: React.ReactNode; gap?: number; style?: React.CSSProperties }> = ({ children, gap = 18, style }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap, padding: "0 140px", ...style }}>{children}</AbsoluteFill>
);

/** Aparece en un frame dado, con resorte suave. */
const Pop: React.FC<{ from: number; children: React.ReactNode; y?: number; style?: React.CSSProperties }> = ({ from, children, y = 40, style }) => {
  const f = useCurrentFrame();
  const p = ease(f, from, 18);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px) scale(${0.92 + 0.08 * p})`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>{children}</div>;
};

// ───────────────────────────── escenas ─────────────────────────────

type SceneProps = { seg: Seg; len: number };

/** 1. El problema. */
const S1: React.FC<SceneProps> = ({ seg, len }) => (
  <Stage len={len} dark>
    <Orb x={260} y={260} r={60} color={C.purple} />
    <Orb x={1680} y={820} r={44} color={C.peach} delay={10} />
    <Center gap={10}>
      <KLine seg={seg} text="¿Tienes un negocio" size={92} color="rgba(255,255,255,0.75)" weight={600} />
      <KLine seg={seg} text="y nunca sabes" size={92} color="rgba(255,255,255,0.75)" weight={600} />
      <KLine seg={seg} text="qué publicar?" size={190} color={C.white} style="slam" hi={["publicar"]} hiColor={C.purple} />
    </Center>
  </Stage>
);

/** 2. Logo: las letras se juntan. */
const S2: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const t = when(seg, "Roots");
  const p = ease(f, t - 4, 34);
  const glow = ease(f, t + 10, 30);
  return (
    <Stage len={len} dark>
      <Ring x={1500} y={260} size={150} color={C.sun} delay={t} />
      <Orb x={380} y={800} r={56} color={C.purple} delay={t} />
      <Center gap={34}>
        <KLine seg={seg} text="Te presento" size={56} color="rgba(255,255,255,0.7)" weight={600} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, opacity: p, transform: `scale(${0.9 + 0.1 * p})` }}>
          <Img src={staticFile("brand/pr-icon.png")} style={{ height: 150, width: "auto", filter: `drop-shadow(0 0 ${40 * glow}px rgba(252,231,98,0.6))` }} />
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 132, color: C.white, letterSpacing: `${interpolate(p, [0, 1], [0.9, 0.06])}em`, textShadow: `0 0 ${60 * glow}px rgba(252,231,98,0.35)` }}>
            ROOTS ENGINE
          </div>
        </div>
      </Center>
    </Stage>
  );
};

/** 3. Investigación de mercado y competencia. */
const S3: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const tComp = when(seg, "competencia");
  const tWork = when(seg, "qué está");
  const cards = [
    { h: "@competidor_1", v: 0.92, tag: "Humor de equipo" },
    { h: "@competidor_2", v: 0.58, tag: "Antes y después" },
    { h: "@competidor_3", v: 0.31, tag: "Promo con precio" },
  ];
  return (
    <Stage len={len}>
      <AbsoluteFill style={{ padding: "120px 140px", flexDirection: "row", alignItems: "center", gap: 90 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
          <Kicker text="Investigación" at={seg.s - 6} />
          <KLine seg={seg} text="estudia tu mercado" size={104} align="left" hi={["mercado"]} />
          <KLine seg={seg} text="y a tu competencia," size={104} align="left" />
          <div style={{ height: 14 }} />
          <KLine seg={seg} text="qué está funcionando." size={64} align="left" weight={700} color={C.purple} />
        </div>
        <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 22 }}>
          {cards.map((c, i) => {
            const s = tComp + i * 6;
            const fill = ease(f, s + 10, 30) * c.v;
            const win = i === 0 && f > tWork;
            return (
              <Pop key={c.h} from={s} y={60}>
                <Card style={{ padding: 26, display: "flex", flexDirection: "column", gap: 14, outline: win ? `3px solid ${C.sun}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, fontWeight: 700 }}>
                    <span>{c.h}</span>
                    <Chip bg={win ? C.sun : "#f0eef5"}>{win ? "✓ Funciona" : c.tag}</Chip>
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
    </Stage>
  );
};

/** 4. Plan semanal. */
const S4: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const items = ["qué grabar,", "el gancho,", "y hasta el guion."];
  return (
    <Stage len={len}>
      <Center gap={50}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Kicker text="Plan semanal" at={seg.s - 6} />
          <KLine seg={seg} text="Cada semana te da tu plan:" size={78} />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {days.map((d, i) => {
            const p = ease(f, seg.s + 4 + i * 3, 14);
            const on = i % 2 === 0;
            return (
              <div key={i} style={{ width: 96, height: 96, borderRadius: 24, display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: 800, fontSize: 36, background: on ? C.purple : "#f0eef5", color: on ? C.white : C.muted, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
                {d}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 60, alignItems: "baseline" }}>
          {items.map((it) => {
            const t = when(seg, it);
            const c = ease(f, t + 8, 12);
            return (
              <div key={it} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ width: 52, height: 52, borderRadius: 99, background: C.sun, display: "grid", placeItems: "center", fontSize: 30, fontWeight: 900, fontFamily: SANS, color: C.ink, transform: `scale(${c})` }}>✓</span>
                <KLine seg={seg} text={it} size={66} style="slam" />
              </div>
            );
          })}
        </div>
      </Center>
    </Stage>
  );
};

/** 5. Campañas por fecha o evento. */
const S5: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const tH = when(seg, "Halloween");
  const tC = when(seg, "Te arma");
  const pumpkin = ease(f, tH, 16);
  const chips = ["Calentamiento", "Día del evento", "Recap", "Sketch de comedia", "Trend", "Flyer"];
  return (
    <Stage len={len} dark>
      <Center gap={26}>
        <div style={{ fontSize: 150, transform: `scale(${pumpkin}) rotate(${(1 - pumpkin) * -30 + Math.sin(f / 6) * 4}deg)`, opacity: pumpkin }}>🎃</div>
        <KLine seg={seg} text="¿Viene Halloween," size={110} color={C.white} hi={["Halloween"]} hiColor={C.peach} />
        <KLine seg={seg} text="o un evento importante?" size={64} color="rgba(255,255,255,0.75)" weight={600} />
        <div style={{ height: 10 }} />
        <KLine seg={seg} text="la campaña completa." size={96} color={C.sun} style="slam" />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: 1200 }}>
          {chips.map((c, i) => (
            <Pop key={c} from={tC + 10 + i * 3} y={20}>
              <Chip bg="rgba(255,255,255,0.12)" color={C.white}>{c}</Chip>
            </Pop>
          ))}
        </div>
      </Center>
    </Stage>
  );
};

/** 6. Auto-edición: el clip pasa de gris a editado mientras se nombran las funciones. */
const S6: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const feats: { phrase: string; label: string; icon: string }[] = [
    { phrase: "corta las pausas", label: "Corta las pausas", icon: "✂️" },
    { phrase: "subtítulos", label: "Subtítulos", icon: "💬" },
    { phrase: "emojis", label: "Emojis", icon: "😎" },
    { phrase: "música", label: "Música", icon: "🎵" },
    { phrase: "corrige el color", label: "Corrige el color", icon: "🎨" },
  ];
  const times = feats.map((x) => when(seg, x.phrase));
  const idx = times.reduce((a, t, i) => (f >= t - 2 ? i : a), -1);
  const colorP = ease(f, times[4], 20);
  const capP = ease(f, times[1], 10);
  const emojiP = ease(f, times[2], 12);
  const tEdit = when(seg, "el motor");
  return (
    <Stage len={len}>
      <AbsoluteFill style={{ padding: "100px 150px", flexDirection: "row", alignItems: "center", gap: 110 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <Kicker text="Auto-edición" at={seg.s - 6} />
          <KLine seg={seg} text="Tú grabas con tu celular," size={70} align="left" weight={700} color={C.muted} />
          <KLine seg={seg} text="el motor edita solo:" size={100} align="left" hi={["solo"]} />
          {/* lista que va "girando" como tragamonedas */}
          <div style={{ position: "relative", height: 130, overflow: "hidden", marginTop: 16 }}>
            {feats.map((x, i) => {
              const p = ease(f, times[i] - 2, 10);
              const out = i < idx ? ease(f, times[i + 1] - 2, 10) : 0;
              return (
                <div key={x.label} style={{ position: "absolute", left: 0, top: 0, display: "flex", alignItems: "center", gap: 22, fontFamily: SANS, fontWeight: 800, fontSize: 96, letterSpacing: "-0.04em", color: C.purple, opacity: p * (1 - out), transform: `translateY(${(1 - p) * 120 - out * 120}px)` }}>
                  <span>{x.icon}</span>
                  {x.label}
                </div>
              );
            })}
          </div>
        </div>
        <Pop from={tEdit - 4} y={80}>
          <Phone w={380} rotY={-12} rotX={4}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #c9a27e, #6b4a3a 55%, #2e2230)", filter: `saturate(${0.25 + 0.85 * colorP}) brightness(${0.75 + 0.3 * colorP}) contrast(${0.9 + 0.15 * colorP})` }} />
            <div style={{ position: "absolute", left: "50%", top: "38%", transform: "translate(-50%,-50%)", width: 170, height: 170, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #f6d2b8, #b98466 60%, #6b4a3a)", filter: `saturate(${0.3 + 0.8 * colorP})` }} />
            <div style={{ position: "absolute", left: 24, right: 24, bottom: 150, textAlign: "center", fontFamily: SANS, fontWeight: 900, fontSize: 34, color: C.white, textShadow: "0 3px 12px rgba(0,0,0,0.6)", opacity: capP, transform: `scale(${0.8 + 0.2 * capP})` }}>
              ESTO <span style={{ color: C.sun }}>CAMBIA</span> TODO
            </div>
            <div style={{ position: "absolute", right: 34, top: 120, fontSize: 64, opacity: emojiP, transform: `scale(${emojiP}) rotate(${(1 - emojiP) * 40}deg)` }}>🔥</div>
            {/* línea de tiempo con cortes */}
            <div style={{ position: "absolute", left: 22, right: 22, bottom: 60, height: 36, display: "flex", gap: 4 }}>
              {[0.24, 0.18, 0.3, 0.12, 0.16].map((w, i) => {
                const cut = ease(f, times[0] + i * 2, 10);
                return <div key={i} style={{ flex: w, borderRadius: 6, background: i % 2 ? C.peach : C.sun, opacity: 0.4 + 0.6 * cut, transform: `scaleY(${0.5 + 0.5 * cut})` }} />;
              })}
            </div>
          </Phone>
        </Pop>
      </AbsoluteFill>
    </Stage>
  );
};

/** 7. Flyers. */
const S7: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const tL = when(seg, "Lo diseña");
  const tS = when(seg, "en segundos");
  const fly: { k: "karaoke" | "tacos" | "glow"; x: number; r: number }[] = [
    { k: "tacos", x: -330, r: -10 },
    { k: "glow", x: 0, r: 0 },
    { k: "karaoke", x: 330, r: 10 },
  ];
  const tick = ease(f, tS, 24);
  return (
    <Stage len={len}>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 110, gap: 18 }}>
        <Kicker text="Flyers con IA" at={seg.s - 6} />
        <KLine seg={seg} text="¿Necesitas un flyer?" size={92} />
        <KLine seg={seg} text="Lo diseña con tu marca," size={56} weight={600} color={C.muted} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 40 }}>
        <div style={{ position: "relative", width: 1000, height: 460 }}>
          {fly.map((x, i) => {
            const p = ease(f, tL + i * 4, 22);
            return (
              <div key={x.k} style={{ position: "absolute", left: 500 - 150 + x.x * p, top: 40 + (1 - p) * 300, transform: `rotate(${x.r * p}deg)`, opacity: p }}>
                <MockFlyer kind={x.k} w={300} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 150, top: 330, display: "flex", alignItems: "center", gap: 18, opacity: ease(f, tS - 2, 10) }}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="46" fill="none" stroke="#f0eef5" strokeWidth="10" />
          <circle cx="55" cy="55" r="46" fill="none" stroke={C.purple} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${289 * tick} 289`} transform="rotate(-90 55 55)" />
        </svg>
        <KLine seg={seg} text="en segundos." size={64} align="left" hi={["segundos"]} />
      </div>
    </Stage>
  );
};

/** 8. Todo en un lugar, bilingüe. */
const S8: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const tLang = when(seg, "en español");
  const feats = ["Investigación", "Plan semanal", "Campañas", "Auto-edición", "Flyers", "Rebranding"];
  const gather = ease(f, seg.s, 40);
  const toggle = ease(f, when(seg, "inglés"), 14);
  return (
    <Stage len={len} dark>
      {feats.map((x, i) => {
        const a = (i / feats.length) * Math.PI * 2 + f / 90;
        const r = interpolate(gather, [0, 1], [1.8, 1]);
        return (
          <div key={x} style={{ position: "absolute", left: 960 + Math.cos(a) * 780 * r - 150, top: 540 + Math.sin(a) * 390 * r - 30, width: 300, display: "flex", justifyContent: "center", opacity: gather * 0.85 }}>
            <span style={{ borderRadius: 99, padding: "12px 26px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: C.white, fontFamily: SANS, fontWeight: 600, fontSize: 28, whiteSpace: "nowrap" }}>{x}</span>
          </div>
        );
      })}
      <Center gap={30}>
        <KLine seg={seg} text="Todo en un solo lugar," size={110} color={C.white} hi={["solo"]} hiColor={C.purple} />
        <div style={{ display: "flex", alignItems: "center", gap: 24, opacity: ease(f, tLang - 2, 12) }}>
          <div style={{ position: "relative", width: 260, height: 84, borderRadius: 99, background: "rgba(255,255,255,0.12)", display: "flex", fontFamily: SANS, fontWeight: 800, fontSize: 34 }}>
            <div style={{ position: "absolute", top: 7, left: 7 + toggle * 126, width: 120, height: 70, borderRadius: 99, background: C.sun }} />
            <span style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", color: toggle < 0.5 ? C.ink : C.white }}>ES</span>
            <span style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", color: toggle >= 0.5 ? C.ink : C.white }}>EN</span>
          </div>
          <KLine seg={seg} text="en español y en inglés." size={60} color="rgba(255,255,255,0.85)" weight={600} align="left" />
        </div>
      </Center>
    </Stage>
  );
};

/** 9. Cierre. */
const S9: React.FC<SceneProps> = ({ seg, len }) => {
  const f = useCurrentFrame();
  const p = ease(f, seg.s - 2, 30);
  const tCta = when(seg, "increíble") + 6;
  const cta = ease(f, tCta, 18);
  return (
    <Stage len={len + 30}>
      <Orb x={300} y={260} r={70} color={C.purple} />
      <Orb x={1640} y={820} r={52} color={C.peach} delay={8} />
      <Ring x={1600} y={240} size={130} color={C.sun} delay={12} />
      <Center gap={28}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
          <Img src={staticFile("brand/pr-icon-purple.png")} style={{ height: 110, width: "auto" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderLeft: `2px solid ${C.line}`, paddingLeft: 28 }}>
            <Img src={staticFile("brand/pr-wordmark-purple.png")} style={{ height: 38, width: "auto" }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.32em", fontSize: 20, color: C.muted }}>ROOTS ENGINE</span>
          </div>
        </div>
        <div style={{ height: 8 }} />
        <KLine seg={seg} text="Tú grabas." size={84} color={C.muted} weight={700} />
        <KLine seg={seg} text="Nosotros hacemos que se vea increíble." size={92} hi={["increíble"]} style="rise" />
        <div style={{ opacity: cta, transform: `translateY(${(1 - cta) * 24}px)`, display: "flex", alignItems: "center", gap: 22, marginTop: 14 }}>
          <span style={{ borderRadius: 99, background: C.purple, color: C.white, fontFamily: SANS, fontWeight: 700, fontSize: 30, padding: "18px 42px", boxShadow: "0 20px 40px -16px rgba(79,71,137,0.9)" }}>Pide tu demo</span>
          <span style={{ fontFamily: SANS, fontSize: 28, color: C.muted }}>purpleroots.agency</span>
        </div>
      </Center>
    </Stage>
  );
};

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9];

export const ClientPromo: React.FC<ClientPromoProps> = ({ segments, voice }) => {
  useFonts(["Inter", "Josefin Sans", "Anton", "Playfair Display"]);
  const LEAD = 8; // la escena entra un poco antes de que empiece la frase
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {segments.map((sg, i) => {
        const S = SCENES[i];
        const from = Math.max(0, Math.round(sg.start * FPS) - LEAD);
        const next = segments[i + 1] ? Math.round(segments[i + 1].start * FPS) - LEAD + 6 : Math.round((sg.end + 2.4) * FPS);
        const len = next - from;
        const seg: Seg = { s: Math.round(sg.start * FPS) - from, e: Math.round(sg.end * FPS) - from, text: CLIENT_SCRIPT[i] };
        return (
          <Sequence key={i} from={from} durationInFrames={len + (i === segments.length - 1 ? 30 : 0)}>
            <S seg={seg} len={len} />
          </Sequence>
        );
      })}
      {segments.slice(1).map((sg, i) => (
        <Whoosh key={i} at={Math.max(0, Math.round(sg.start * FPS) - 12)} volume={0.12} />
      ))}
      {voice ? <Audio src={staticFile(voice)} /> : null}
    </AbsoluteFill>
  );
};
