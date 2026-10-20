import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useFonts } from "../fonts";

/**
 * Promo de ROOTS ENGINE, 16:9, 30 s, estilo keynote: tipografía grande, aparición con desenfoque,
 * dispositivos y tarjetas en 3D, esferas de color de la marca.
 */

export const PROMO = { fps: 30, width: 1920, height: 1080, durationInFrames: 900 };

export const C = {
  ink: "#211c35",
  night: "#0c0a14",
  purple: "#4f4789",
  purpleDeep: "#3b3569",
  sun: "#fce762",
  peach: "#ffb17a",
  cream: "#fffded",
  line: "#e8e5ef",
  muted: "#6e6a80",
  white: "#ffffff",
};
export const SANS = `"Inter", ui-sans-serif, system-ui, sans-serif`;
export const DISPLAY = `"Josefin Sans", ui-sans-serif, system-ui, sans-serif`;
export const OUT = Easing.bezier(0.16, 1, 0.3, 1); // salida tipo "expo", suave y premium
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const ease = (f: number, start: number, dur: number, from = 0, to = 1, e = OUT) =>
  interpolate(f, [start, start + dur], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

// ───────────────────────────── piezas ─────────────────────────────

/** Palabras que entran una por una, de borroso a nítido. */
export const Words: React.FC<{
  text: string;
  at: number;
  size: number;
  color?: string;
  weight?: number;
  stagger?: number;
  font?: string;
  tracking?: number;
  mark?: string[];
  align?: "left" | "center";
}> = ({ text, at, size, color = C.ink, weight = 800, stagger = 4, font = SANS, tracking = -0.035, mark = [], align = "center" }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: `0 ${size * 0.26}px`,
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: `${tracking}em`,
        color,
      }}
    >
      {text.split(" ").map((w, i) => {
        const s = at + i * stagger;
        const p = ease(f, s, 22);
        const marked = mark.includes(w.replace(/[.,]/g, ""));
        const sweep = ease(f, s + 10, 18, 0, 100, IN_OUT);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              filter: `blur(${(1 - p) * 14}px)`,
              transform: `translateY(${(1 - p) * size * 0.35}px)`,
              position: "relative",
            }}
          >
            {marked ? (
              <span
                style={{
                  position: "absolute",
                  left: -size * 0.06,
                  right: -size * 0.06,
                  bottom: size * 0.04,
                  height: size * 0.36,
                  background: C.sun,
                  zIndex: -1,
                  clipPath: `inset(0 ${100 - sweep}% 0 0)`,
                  borderRadius: size * 0.05,
                }}
              />
            ) : null}
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{ text: string; at: number; color?: string; dot?: string }> = ({ text, at, color = C.purple, dot = C.peach }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, 20);
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color,
        opacity: p,
        transform: `translateY(${(1 - p) * 14}px)`,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 99, background: dot }} />
      {text}
    </div>
  );
};

/** Esfera brillante "3D" que flota (luz arriba a la izquierda). */
export const Orb: React.FC<{ x: number; y: number; r: number; color: string; drift?: number; delay?: number; blur?: number }> = ({
  x,
  y,
  r,
  color,
  drift = 1,
  delay = 0,
  blur = 0,
}) => {
  const f = useCurrentFrame();
  const p = ease(f, delay, 40);
  const dy = Math.sin((f + delay * 3) / 40) * 18 * drift;
  const dx = Math.cos((f + delay * 5) / 55) * 12 * drift;
  return (
    <div
      style={{
        position: "absolute",
        left: x - r + dx,
        top: y - r + dy,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, ${color} 26%, ${color} 55%, rgba(0,0,0,0.35) 100%)`,
        boxShadow: `0 ${r * 0.5}px ${r * 0.9}px -${r * 0.3}px rgba(33,28,53,0.35)`,
        opacity: p,
        transform: `scale(${0.6 + 0.4 * p})`,
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    />
  );
};

/** Anillo 3D (toro) hecho con bordes en perspectiva. */
export const Ring: React.FC<{ x: number; y: number; size: number; color: string; delay?: number }> = ({ x, y, size, color, delay = 0 }) => {
  const f = useCurrentFrame();
  const p = ease(f, delay, 40);
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, perspective: 900, opacity: p }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `${size * 0.11}px solid ${color}`,
          boxShadow: `inset 0 ${size * 0.03}px ${size * 0.06}px rgba(255,255,255,0.7), inset 0 -${size * 0.04}px ${size * 0.08}px rgba(0,0,0,0.25), 0 ${size * 0.15}px ${size * 0.3}px -${size * 0.1}px rgba(33,28,53,0.35)`,
          transform: `rotateX(${62 + Math.sin(f / 50) * 6}deg) rotateZ(${f * 0.6}deg)`,
        }}
      />
    </div>
  );
};

/** Fondo claro con luz suave de los colores de la marca. */
export const Light: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1100px 700px at 88% -10%, rgba(252,231,98,0.35), transparent 60%),
                   radial-gradient(900px 600px at -5% 110%, rgba(255,177,122,0.28), transparent 60%),
                   radial-gradient(800px 600px at 50% 50%, rgba(79,71,137,0.06), transparent 70%), #ffffff`,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Dark: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(900px 600px at 50% 120%, rgba(79,71,137,0.55), transparent 65%),
                   radial-gradient(700px 500px at 85% -10%, rgba(252,231,98,0.10), transparent 60%), ${C.night}`,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Entrada y salida de cada escena: aparece nítida y se va con zoom y desenfoque. */
const Scene: React.FC<{ dur: number; children: React.ReactNode; dark?: boolean }> = ({ dur, children, dark }) => {
  const f = useCurrentFrame();
  const inP = ease(f, 0, 14);
  const outP = ease(f, dur - 12, 12, 0, 1, IN_OUT);
  const Bg = dark ? Dark : Light;
  return (
    <AbsoluteFill style={{ opacity: inP * (1 - outP), transform: `scale(${1 + outP * 0.06})`, filter: `blur(${outP * 12}px)` }}>
      <Bg>{children}</Bg>
    </AbsoluteFill>
  );
};

/** Celular en 3D. */
export const Phone: React.FC<{ children: React.ReactNode; w?: number; rotY?: number; rotX?: number; style?: React.CSSProperties }> = ({
  children,
  w = 400,
  rotY = 0,
  rotX = 0,
  style,
}) => {
  const h = w * 2.05;
  return (
    <div style={{ perspective: 2200, ...style }}>
      <div
        style={{
          width: w,
          height: h,
          borderRadius: w * 0.16,
          background: "#111015",
          padding: w * 0.035,
          boxShadow: `0 ${w * 0.15}px ${w * 0.3}px -${w * 0.06}px rgba(33,28,53,0.45), inset 0 0 0 2px #2b2836, inset 0 0 0 ${w * 0.012}px #4a4658`,
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: w * 0.13, overflow: "hidden", background: C.white, position: "relative" }}>
          {children}
          <div
            style={{
              position: "absolute",
              top: w * 0.03,
              left: "50%",
              transform: "translateX(-50%)",
              width: w * 0.28,
              height: w * 0.075,
              borderRadius: 99,
              background: "#0a090d",
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Ventana de navegador en 3D. */
const Browser: React.FC<{ children: React.ReactNode; w: number; h: number; rotY?: number; rotX?: number }> = ({ children, w, h, rotY = 0, rotX = 0 }) => (
  <div style={{ perspective: 2600 }}>
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 22,
        background: C.white,
        border: `1px solid ${C.line}`,
        overflow: "hidden",
        boxShadow: "0 60px 120px -40px rgba(33,28,53,0.45), 0 0 0 1px rgba(33,28,53,0.04)",
        transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
      }}
    >
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderBottom: `1px solid ${C.line}`, background: "#faf9fc" }}>
        {["#ff6058", "#ffbd2e", "#28c940"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
        ))}
        <div style={{ marginLeft: 24, flex: 1, height: 26, borderRadius: 8, background: "#f0eef5", fontFamily: SANS, fontSize: 14, color: C.muted, display: "flex", alignItems: "center", paddingLeft: 14 }}>
          roots-engine.vercel.app
        </div>
      </div>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${C.purple} 0 40%, ${C.peach} 40% 70%, ${C.sun} 70% 100%)` }} />
      <div style={{ position: "relative", height: h - 52, overflow: "hidden" }}>{children}</div>
    </div>
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.white,
      borderRadius: 26,
      border: `1px solid ${C.line}`,
      boxShadow: "0 30px 70px -30px rgba(33,28,53,0.35), 0 2px 6px rgba(33,28,53,0.05)",
      padding: 28,
      fontFamily: SANS,
      color: C.ink,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Chip: React.FC<{ children: React.ReactNode; bg?: string; color?: string }> = ({ children, bg = "rgba(252,231,98,0.45)", color = C.ink }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 99, padding: "6px 14px", background: bg, color, fontSize: 17, fontWeight: 600, fontFamily: SANS }}>
    {children}
  </span>
);

export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>{children}</div>
);

export const Whoosh: React.FC<{ at: number; volume?: number }> = ({ at, volume = 0.18 }) => (
  <Sequence from={at} durationInFrames={30}>
    <Audio src={staticFile("sfx/whoosh.mp3")} volume={volume} />
  </Sequence>
);

// ───────────────────────────── escenas ─────────────────────────────

const S1Hook: React.FC = () => (
  <Scene dur={84} dark>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 10 }}>
      <Words text="Deja de adivinar" at={6} size={150} color={C.white} />
      <div style={{ color: C.ink }}>
        <Words text="qué publicar." at={30} size={150} color={C.white} mark={[]} />
      </div>
      <SunUnderline at={50} />
    </AbsoluteFill>
  </Scene>
);

const SunUnderline: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, 26, 0, 1, IN_OUT);
  return <div style={{ width: 760 * p, height: 14, borderRadius: 99, background: `linear-gradient(90deg, ${C.sun}, ${C.peach})`, marginTop: 18 }} />;
};

const S2Logo: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, 4, 40);
  const spin = interpolate(p, [0, 1], [-100, 0]);
  return (
    <Scene dur={76} dark>
      <Orb x={1500} y={260} r={90} color={C.purple} delay={10} />
      <Orb x={380} y={820} r={60} color={C.peach} delay={18} />
      <Orb x={1660} y={860} r={34} color={C.sun} delay={26} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 36 }}>
        <div style={{ perspective: 1200 }}>
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 48,
              background: `linear-gradient(145deg, #ffffff, ${C.cream})`,
              display: "grid",
              placeItems: "center",
              transform: `rotateY(${spin}deg) scale(${0.7 + 0.3 * p})`,
              opacity: p,
              boxShadow: `0 40px 90px -20px rgba(79,71,137,0.8), inset 0 -8px 20px rgba(79,71,137,0.15)`,
            }}
          >
            <Img src={staticFile("brand/pr-icon-purple.png")} style={{ width: 120, height: "auto" }} />
          </div>
        </div>
        <div style={{ opacity: ease(f, 22, 24), filter: `blur(${(1 - ease(f, 22, 24)) * 10}px)` }}>
          <Img src={staticFile("brand/pr-wordmark.png")} style={{ height: 46, width: "auto" }} />
        </div>
        <Kicker text="Roots Engine" at={26} color={C.sun} />
        <Words text="Tu motor de contenido con IA." at={32} size={58} color="rgba(255,255,255,0.82)" weight={600} stagger={3} tracking={-0.02} />
      </AbsoluteFill>
    </Scene>
  );
};

const Typed: React.FC<{ text: string; at: number; speed?: number }> = ({ text, at, speed = 1.4 }) => {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((f - at) * speed)));
  const caret = f >= at && n < text.length && Math.floor(f / 8) % 2 === 0;
  return (
    <span>
      {text.slice(0, n)}
      <span style={{ opacity: caret ? 1 : 0, color: C.purple }}>|</span>
    </span>
  );
};

const S3Signup: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, 6, 40);
  const fields: [string, string, number][] = [
    ["Nombre del negocio", "Glow Studio", 22],
    ["Giro", "Med spa", 36],
    ["Ciudad", "El Paso, TX", 46],
    ["Instagram", "@glowstudio.ep", 57],
  ];
  const press = ease(f, 76, 5) - ease(f, 81, 7);
  const done = ease(f, 83, 12);
  return (
    <Scene dur={104}>
      <Orb x={1720} y={170} r={70} color={C.sun} delay={6} />
      <Ring x={1630} y={900} size={170} color={C.purple} delay={14} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 150 }}>
        <div style={{ width: 820, display: "flex", flexDirection: "column", gap: 26 }}>
          <Kicker text="Cliente nuevo" at={4} />
          <Words text="Empieza con un solo link." at={10} size={96} align="left" stagger={3} />
          <div style={{ opacity: ease(f, 34, 20), fontFamily: SANS, fontSize: 32, color: C.muted, lineHeight: 1.35, maxWidth: 620 }}>
            Tu negocio, tu giro y tus redes. En menos de un minuto ya tienes tu portal.
          </div>
        </div>
        <Phone w={420} rotY={interpolate(p, [0, 1], [-38, -14])} rotX={interpolate(p, [0, 1], [14, 4])} style={{ opacity: p, transform: `translateY(${(1 - p) * 80}px)` }}>
          <div style={{ padding: "70px 28px 0", fontFamily: SANS, color: C.ink }}>
            <div style={{ height: 5, borderRadius: 9, background: `linear-gradient(90deg, ${C.purple} 0 40%, ${C.peach} 40% 70%, ${C.sun} 70%)`, marginBottom: 22 }} />
            <div style={{ fontSize: 13, letterSpacing: "0.2em", color: C.purple, fontWeight: 600, fontFamily: DISPLAY }}>ROOTS ENGINE</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", margin: "8px 0 20px" }}>Crea tu cuenta</div>
            {fields.map(([l, v, at]) => (
              <div key={l} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 600, marginBottom: 6 }}>{l}</div>
                <div style={{ height: 44, borderRadius: 12, border: `1.5px solid ${f > at && f < at + 22 ? C.purple : C.line}`, padding: "0 14px", display: "flex", alignItems: "center", fontSize: 17 }}>
                  <Typed text={v} at={at} />
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 22,
                height: 54,
                borderRadius: 99,
                background: done > 0.5 ? "#15803d" : C.purple,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 18,
                transform: `scale(${1 - press * 0.06})`,
                boxShadow: "0 14px 30px -12px rgba(79,71,137,0.8)",
              }}
            >
              {done > 0.5 ? "✓ Tu portal está listo" : "Crear mi cuenta"}
            </div>
          </div>
        </Phone>
      </AbsoluteFill>
    </Scene>
  );
};

/** Tarjeta que llega desde el fondo en 3D. */
const Fly: React.FC<{ at: number; x: number; y: number; rot?: number; z?: number; children: React.ReactNode }> = ({ at, x, y, rot = 0, z = 0, children }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, 34);
  const float = Math.sin((f + at * 2) / 34) * 8;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + float,
        opacity: p,
        transform: `perspective(1800px) translateZ(${interpolate(p, [0, 1], [-900, z])}px) rotateY(${rot * (1.6 - 0.6 * p)}deg) rotateX(${(1 - p) * 20}deg)`,
        filter: `blur(${(1 - p) * 10}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const Count: React.FC<{ to: number; at: number; dur?: number; decimals?: number; suffix?: string }> = ({ to, at, dur = 36, decimals = 0, suffix = "" }) => {
  const f = useCurrentFrame();
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {(to * ease(f, at, dur)).toFixed(decimals)}
      {suffix}
    </span>
  );
};

const S4Market: React.FC = () => (
  <Scene dur={104}>
    <Orb x={210} y={190} r={46} color={C.peach} delay={20} />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 92, gap: 18 }}>
      <Kicker text="Investigación automática" at={2} />
      <Words text="La IA estudia tu mercado." at={8} size={92} stagger={3} />
    </AbsoluteFill>
    <Fly at={26} x={170} y={410} rot={18}>
      <Card style={{ width: 500 }}>
        <Label>Competencia encontrada</Label>
        {[
          ["@luxe.skin.ep", "48K", C.purple],
          ["@borderglowclinic", "31K", C.peach],
          ["@bellezajuarez", "22K", C.sun],
        ].map(([h, v, c], i) => (
          <div key={h} style={{ display: "flex", alignItems: "center", gap: 14, marginTop: i ? 14 : 20 }}>
            <span style={{ width: 44, height: 44, borderRadius: 99, background: `radial-gradient(circle at 30% 30%, #fff, ${c})` }} />
            <span style={{ flex: 1, fontSize: 21, fontWeight: 600 }}>{h}</span>
            <span style={{ fontSize: 18, color: C.muted }}>{v} vistas</span>
          </div>
        ))}
      </Card>
    </Fly>
    <Fly at={38} x={720} y={460} z={60}>
      <Card style={{ width: 480, textAlign: "center", padding: 36 }}>
        <Label>Video que más pegó</Label>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.05em", color: C.purple, lineHeight: 1.05, marginTop: 10 }}>
          <Count to={12.4} at={44} decimals={1} suffix="x" />
        </div>
        <div style={{ fontSize: 20, color: C.muted }}>sobre su promedio</div>
        <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Chip>Hook en 1 s</Chip>
          <Chip bg="rgba(255,177,122,0.35)">Antes y después</Chip>
        </div>
      </Card>
    </Fly>
    <Fly at={50} x={1250} y={420} rot={-18}>
      <Card style={{ width: 500 }}>
        <Label>Google Maps</Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <Count to={4.8} at={52} decimals={1} />
          </span>
          <span style={{ fontSize: 34, color: "#f5b301" }}>★★★★★</span>
        </div>
        <div style={{ fontSize: 20, color: C.muted, marginTop: 4 }}>
          <Count to={214} at={52} /> reseñas · 3er lugar en tu zona
        </div>
        <div style={{ marginTop: 18, height: 10, borderRadius: 99, background: "#f0eef5", overflow: "hidden" }}>
          <ProgressFill at={54} to={0.72} />
        </div>
      </Card>
    </Fly>
  </Scene>
);

const ProgressFill: React.FC<{ at: number; to: number; color?: string }> = ({ at, to, color }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        width: `${ease(f, at, 40) * to * 100}%`,
        height: "100%",
        borderRadius: 99,
        background: color ?? `linear-gradient(90deg, ${C.purple}, ${C.peach})`,
      }}
    />
  );
};

const ScoreRing: React.FC<{ at: number; value: number; size: number }> = ({ at, value, size }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, 50);
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f0eef5" strokeWidth={22} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#g)"
          strokeWidth={22}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - (value / 100) * p)}
        />
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0" stopColor={C.purple} />
            <stop offset="1" stopColor={C.peach} />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: 800, fontSize: size * 0.28, letterSpacing: "-0.04em", color: C.ink }}>
        {Math.round(value * p)}
      </div>
    </div>
  );
};

const S5Report: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, 10, 44);
  const scroll = ease(f, 48, 36, 0, -150, IN_OUT);
  const sections: [string, string][] = [
    ["Oferta irresistible", "Paquete Glow 90: 3 sesiones + seguimiento. Si no ves cambio, la cuarta va por nuestra cuenta."],
    ["Dónde falla tu presencia digital", "Publicas 2 veces al mes y tus videos no tienen llamado a la acción."],
    ["Estrategia", "Antes y después, tips de 20 s y testimonios. 4 videos por semana."],
    ["Cómo grabar", "Luz de ventana, celular a la altura de los ojos, primeros 2 segundos con el resultado."],
  ];
  return (
    <Scene dur={100}>
      <Orb x={1770} y={300} r={56} color={C.purple} delay={12} />
      <Orb x={140} y={900} r={80} color={C.sun} delay={20} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 90 }}>
        <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 26 }}>
          <Kicker text="Reporte completo" at={2} />
          <Words text="Un plan de marca que sí se entiende." at={8} size={84} align="left" stagger={3} />
          <div style={{ opacity: ease(f, 36, 20), display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chip>Análisis de mercado</Chip>
            <Chip bg="rgba(255,177,122,0.35)">Oferta</Chip>
            <Chip bg="rgba(79,71,137,0.12)" color={C.purple}>PDF listo para compartir</Chip>
          </div>
        </div>
        <div style={{ opacity: p, transform: `translateY(${(1 - p) * 100}px)` }}>
          <Browser w={860} h={640} rotY={interpolate(p, [0, 1], [-30, -12])} rotX={interpolate(p, [0, 1], [16, 5])}>
            <div style={{ padding: 34, transform: `translateY(${scroll}px)`, fontFamily: SANS, color: C.ink }}>
              <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
                <ScoreRing at={24} value={62} size={170} />
                <div>
                  <Label>Presencia digital</Label>
                  <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8, lineHeight: 1.1 }}>
                    Glow Studio tiene buen servicio, pero casi nadie lo ve.
                  </div>
                </div>
              </div>
              {sections.map(([t, d], i) => (
                <div
                  key={t}
                  style={{
                    marginTop: 22,
                    padding: "20px 24px",
                    borderRadius: 18,
                    background: i === 0 ? C.cream : "#fff",
                    border: `1px solid ${i === 0 ? "rgba(252,231,98,0.9)" : C.line}`,
                    opacity: ease(f, 34 + i * 8, 20),
                    transform: `translateY(${(1 - ease(f, 34 + i * 8, 20)) * 30}px)`,
                  }}
                >
                  <div style={{ fontSize: 23, fontWeight: 800 }}>{t}</div>
                  <div style={{ fontSize: 18, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>{d}</div>
                </div>
              ))}
            </div>
          </Browser>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const S6Plan: React.FC = () => {
  const days: [string, string, string][] = [
    ["Lun", "Antes y después", "Esto pasó en 1 sola sesión"],
    ["Mar", "Mito o verdad", "El botox no es solo para arrugas"],
    ["Mié", "Detrás de cámaras", "Así se prepara tu cita"],
    ["Jue", "Testimonio", "Llegó insegura, salió así"],
    ["Vie", "Oferta", "Solo 10 lugares este mes"],
  ];
  const f = useCurrentFrame();
  return (
    <Scene dur={96}>
      <Ring x={1760} y={170} size={130} color={C.peach} delay={10} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96, gap: 18 }}>
        <Kicker text="Plan semanal" at={2} />
        <Words text="Qué grabar. Cada semana." at={8} size={96} stagger={3} mark={["semana"]} />
        <div style={{ opacity: ease(f, 30, 20), fontFamily: SANS, fontSize: 30, color: C.muted }}>Ideas probadas, 3 hooks por video, guion y tomas.</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 26, paddingTop: 470, perspective: 2000 }}>
        {days.map(([d, t, h], i) => {
          const p = ease(f, 30 + i * 6, 30);
          return (
            <div
              key={d}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 140 + Math.sin((f + i * 20) / 30) * 6}px) rotateX(${(1 - p) * 50}deg) rotateY(${(i - 2) * -6}deg)`,
              }}
            >
              <Card style={{ width: 300, padding: 26, minHeight: 300, background: i === 0 ? C.cream : C.white }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.22em", fontSize: 18, color: C.purple }}>{d.toUpperCase()}</span>
                  <span style={{ width: 34, height: 34, borderRadius: 99, background: [C.sun, C.peach, C.purple, C.sun, C.peach][i], opacity: 0.85 }} />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 22, letterSpacing: "-0.02em" }}>{t}</div>
                <div style={{ marginTop: 16, fontSize: 13, letterSpacing: "0.12em", fontWeight: 600, color: C.muted }}>HOOK</div>
                <div style={{ fontSize: 20, marginTop: 6, lineHeight: 1.35 }}>“{h}”</div>
              </Card>
            </div>
          );
        })}
      </AbsoluteFill>
    </Scene>
  );
};

/** Mini video vertical editado con un estilo distinto. */
const StyledClip: React.FC<{ kind: "street" | "luxe" | "counsel"; at: number }> = ({ kind, at }) => {
  const f = useCurrentFrame();
  const local = f - at;
  const zoom = 1 + 0.08 * Math.max(0, Math.sin(Math.max(0, local) / 14));
  const pop = ease(f, at + 14, 14);
  const bg = {
    street: `linear-gradient(160deg, #3a3f4a, #121318)`,
    luxe: `linear-gradient(160deg, #f6d9d2, #b98a86)`,
    counsel: `linear-gradient(160deg, #3b4256, #1a1e2a)`,
  }[kind];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ background: bg, transform: `scale(${zoom})` }}>
        {/* silueta de la persona hablando */}
        <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%) scale(0.8)", transformOrigin: "50% 100%", width: 300, height: 520 }}>
          <div style={{ position: "absolute", left: 90, top: 60, width: 120, height: 150, borderRadius: "50%", background: "rgba(0,0,0,0.28)" }} />
          <div style={{ position: "absolute", left: 20, top: 220, width: 260, height: 320, borderRadius: "130px 130px 0 0", background: "rgba(0,0,0,0.28)" }} />
        </div>
      </AbsoluteFill>
      {kind === "street" ? (
        <>
          <div style={{ position: "absolute", top: "18%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ transform: `rotate(-4deg) scale(${pop})`, background: "#FFD60A", border: "4px solid #111", boxShadow: "5px 6px 0 #000", borderRadius: 12, padding: "6px 14px", fontFamily: `"Anton", sans-serif`, fontSize: 32, color: "#111" }}>
              FADE PERFECTO
            </div>
          </div>
          <div style={{ position: "absolute", top: "34%", right: 26, fontSize: 52, transform: `scale(${ease(f, at + 26, 12)})` }}>💈</div>
          <div style={{ position: "absolute", bottom: "16%", left: 0, right: 0, textAlign: "center", fontFamily: `"Anton", sans-serif`, fontSize: 50, color: "#fff", WebkitTextStroke: "6px #000", paintOrder: "stroke fill" }}>
            EN <span style={{ color: "#FFD60A" }}>20 MIN</span>
          </div>
        </>
      ) : null}
      {kind === "luxe" ? (
        <>
          <div style={{ position: "absolute", top: "20%", left: 0, right: 0, textAlign: "center", fontFamily: `"Playfair Display", serif`, fontWeight: 700, fontSize: 40, color: "#fff", opacity: pop, textShadow: "0 0 18px #F9C6CF, 0 0 40px #F9C6CF" }}>
            Piel de cristal
          </div>
          <div style={{ position: "absolute", top: "31%", left: 30, fontSize: 44, opacity: ease(f, at + 26, 14) }}>✨</div>
          <div style={{ position: "absolute", bottom: "16%", left: 12, right: 12, textAlign: "center", fontFamily: `"Playfair Display", serif`, fontWeight: 700, fontSize: 30, color: "#fff", textShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
            sin agujas <span style={{ color: "#F9C6CF" }}>y sin dolor</span>
          </div>
        </>
      ) : null}
      {kind === "counsel" ? (
        <>
          <div style={{ position: "absolute", top: "12%", left: 0, display: "flex", transform: `translateX(${(1 - pop) * -300}px)` }}>
            <div style={{ width: 9, background: "#E5C07B" }} />
            <div style={{ background: "rgba(10,10,14,0.85)", padding: "10px 18px", fontFamily: SANS, color: "#fff" }}>
              <div style={{ fontWeight: 800, fontSize: 24 }}>Ruiz Law</div>
              <div style={{ fontSize: 16, color: "#E5C07B" }}>@ruizlaw</div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: "16%", left: 0, right: 0, background: "rgba(10,10,14,0.72)", padding: "12px 10px", textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 24, color: "#fff" }}>
            Tienes <span style={{ borderBottom: "4px solid #E5C07B" }}>2 años</span> para reclamar
          </div>
        </>
      ) : null}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 7, width: `${Math.min(100, Math.max(0, local) * 1.2)}%`, background: kind === "street" ? "#FFD60A" : kind === "luxe" ? "#F9C6CF" : "#E5C07B" }} />
    </AbsoluteFill>
  );
};

const S7Edit: React.FC = () => {
  const f = useCurrentFrame();
  const clips: { kind: "street" | "luxe" | "counsel"; label: string; rot: number }[] = [
    { kind: "street", label: "Barbería", rot: 22 },
    { kind: "luxe", label: "Med spa", rot: 0 },
    { kind: "counsel", label: "Abogados", rot: -22 },
  ];
  return (
    <Scene dur={104}>
      <Orb x={200} y={260} r={64} color={C.purple} delay={8} />
      <Orb x={1720} y={820} r={70} color={C.sun} delay={16} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70, gap: 14 }}>
        <Kicker text="Auto-edición" at={2} />
        <Words text="Tú grabas. El motor edita." at={8} size={88} stagger={3} />
        <div style={{ opacity: ease(f, 28, 20), fontFamily: SANS, fontSize: 28, color: C.muted }}>
          Cortes, subtítulos, zooms, emojis y motion graphics con el estilo de tu marca.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 80, paddingBottom: 56 }}>
        {clips.map((c, i) => {
          const p = ease(f, 26 + i * 7, 36);
          return (
            <div key={c.kind} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: p, transform: `translateY(${(1 - p) * 160}px)` }}>
              <Phone w={250} rotY={c.rot * (1.4 - 0.4 * p)} rotX={4}>
                <StyledClip kind={c.kind} at={34 + i * 7} />
              </Phone>
              <Chip bg={i === 1 ? "rgba(255,177,122,0.45)" : "rgba(252,231,98,0.5)"}>{c.label}</Chip>
            </div>
          );
        })}
      </AbsoluteFill>
    </Scene>
  );
};

/** Flyer de ejemplo (diseño de muestra hecho en CSS). */
export const MockFlyer: React.FC<{ kind: "karaoke" | "tacos" | "glow"; w: number }> = ({ kind, w }) => {
  const h = w * 1.25;
  const k = w / 420;
  const look = {
    karaoke: {
      bg: "radial-gradient(circle at 50% 30%, #ff3cac 0%, #6a2bd1 45%, #140726 100%)",
      title: ["NOCHE DE", "KARAOKE"],
      sub: "VIERNES · 9 PM",
      pill: "2x1 EN CERVEZAS",
      pillBg: C.sun,
      font: `"Anton", sans-serif`,
      emoji: "🎤",
    },
    tacos: {
      bg: "radial-gradient(circle at 50% 35%, #ffb17a 0%, #e8590c 50%, #3a1204 100%)",
      title: ["MARTES", "DE TACOS"],
      sub: "TODO EL DÍA",
      pill: "3 TACOS + AGUA",
      pillBg: "#fff3d6",
      font: `"Anton", sans-serif`,
      emoji: "🌮",
    },
    glow: {
      bg: "radial-gradient(circle at 50% 30%, #fff5f7 0%, #f6d9d2 45%, #b98a86 100%)",
      title: ["Glow", "Week"],
      sub: "SOLO ESTA SEMANA",
      pill: "Facial + regalo",
      pillBg: "#ffffff",
      font: `"Playfair Display", serif`,
      emoji: "✨",
    },
  }[kind];
  const dark = kind !== "glow";
  return (
    <div style={{ width: w, height: h, borderRadius: 22 * k, overflow: "hidden", background: look.bg, position: "relative", boxShadow: "0 50px 100px -30px rgba(33,28,53,0.55)" }}>
      <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", width: 200 * k, height: 200 * k, borderRadius: "50%", background: dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.5)", display: "grid", placeItems: "center", fontSize: 110 * k }}>
        {look.emoji}
      </div>
      <div style={{ position: "absolute", top: 34 * k, left: 0, right: 0, textAlign: "center", fontFamily: look.font, fontWeight: 900, fontSize: 64 * k, lineHeight: 0.95, color: dark ? "#fff" : "#5B2333", textShadow: dark ? "0 6px 24px rgba(0,0,0,0.4)" : "none" }}>
        {look.title[0]}
        <br />
        {look.title[1]}
      </div>
      <div style={{ position: "absolute", bottom: 92 * k, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * k }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.22em", fontSize: 20 * k, color: dark ? "#fff" : "#5B2333" }}>{look.sub}</div>
        <div style={{ background: look.pillBg, color: C.ink, borderRadius: 99, padding: `${8 * k}px ${20 * k}px`, fontFamily: SANS, fontWeight: 800, fontSize: 22 * k }}>{look.pill}</div>
      </div>
      <div style={{ position: "absolute", bottom: 22 * k, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 12 * k, padding: `${6 * k}px ${12 * k}px`, display: "flex", alignItems: "center" }}>
          <Img src={staticFile("brand/pr-icon-purple.png")} style={{ height: 30 * k, width: "auto" }} />
        </div>
      </div>
    </div>
  );
};

/** Miniatura de entrada (estilo, logo, foto de la noche). */
const InputTile: React.FC<{ at: number; label: string; pin?: boolean; children: React.ReactNode }> = ({ at, label, pin, children }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, 24);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.8 + 0.2 * p})` }}>
      <div style={{ position: "relative", width: 132, height: 132, borderRadius: 24, overflow: "hidden", background: C.cream, border: `1px solid ${C.line}`, boxShadow: "0 20px 40px -20px rgba(33,28,53,0.4)" }}>
        {children}
        {pin ? <span style={{ position: "absolute", right: 8, top: 8, width: 30, height: 30, borderRadius: 99, background: C.purple, color: "#fff", display: "grid", placeItems: "center", fontSize: 15 }}>📌</span> : null}
      </div>
      <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 18, color: C.muted }}>{label}</span>
    </div>
  );
};

const S7Flyers: React.FC = () => {
  const f = useCurrentFrame();
  const flow = ease(f, 30, 20, 0, 1, IN_OUT);
  const fan = ease(f, 44, 36);
  const cards: { kind: "karaoke" | "tacos" | "glow"; rot: number; x: number; z: number; delay: number }[] = [
    { kind: "glow", rot: -16, x: -300, z: -160, delay: 10 },
    { kind: "tacos", rot: 16, x: 300, z: -160, delay: 6 },
    { kind: "karaoke", rot: 0, x: 0, z: 40, delay: 0 },
  ];
  return (
    <Scene dur={104}>
      <Orb x={1780} y={180} r={60} color={C.peach} delay={8} />
      <Orb x={140} y={940} r={70} color={C.purple} delay={14} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 70 }}>
        <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 24 }}>
          <Kicker text="Flyers con IA" at={2} />
          <Words text="Tus flyers, con tu marca." at={8} size={84} align="left" stagger={3} />
          <div style={{ opacity: ease(f, 24, 18), fontFamily: SANS, fontSize: 28, color: C.muted, lineHeight: 1.35 }}>
            Sube tu estilo, tu logo y las fotos de la noche. La IA lo diseña en segundos.
          </div>
          <div style={{ display: "flex", gap: 22, marginTop: 10 }}>
            <InputTile at={14} label="Tu estilo">
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #ff3cac, #6a2bd1 60%, #140726)" }} />
              <div style={{ position: "absolute", left: 16, top: 18, right: 16, fontFamily: `"Anton", sans-serif`, color: "#fff", fontSize: 30, lineHeight: 0.95 }}>BIG<br />TYPE</div>
            </InputTile>
            <InputTile at={20} label="Tu logo" pin>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#fff" }}>
                <Img src={staticFile("brand/pr-icon-purple.png")} style={{ height: 70, width: "auto" }} />
              </div>
            </InputTile>
            <InputTile at={26} label="Esta noche">
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #3b4256, #111)" }} />
              <div style={{ position: "absolute", left: 44, top: 22, width: 44, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
              <div style={{ position: "absolute", left: 26, top: 78, width: 80, height: 70, borderRadius: "40px 40px 0 0", background: "rgba(255,255,255,0.35)" }} />
              <div style={{ position: "absolute", right: 14, bottom: 12, fontSize: 30 }}>🎤</div>
            </InputTile>
          </div>
          <div style={{ height: 6, width: 440, borderRadius: 99, background: "#f0eef5", overflow: "hidden", marginTop: 6 }}>
            <div style={{ height: "100%", width: `${flow * 100}%`, background: `linear-gradient(90deg, ${C.purple}, ${C.peach}, ${C.sun})` }} />
          </div>
        </div>
        <div style={{ position: "relative", width: 900, height: 760, perspective: 2400 }}>
          {cards.map((c) => {
            const p = ease(f, 44 + c.delay, 34);
            return (
              <div
                key={c.kind}
                style={{
                  position: "absolute",
                  left: 450 - 190,
                  top: 140,
                  opacity: p,
                  transform: `translateX(${c.x * fan}px) translateZ(${c.z}px) rotateY(${c.rot * fan - (1 - p) * 30}deg) rotateZ(${(c.rot / 3) * fan}deg) translateY(${(1 - p) * 120 + Math.sin((f + c.delay * 4) / 26) * 6}px)`,
                  filter: `blur(${(1 - p) * 10}px)`,
                }}
              >
                <MockFlyer kind={c.kind} w={380} />
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              gap: 12,
              opacity: ease(f, 70, 16),
              transform: `translateY(${(1 - ease(f, 70, 16)) * 20}px)`,
            }}
          >
            <Chip>Post, historia o cuadrado</Chip>
            <Chip bg="rgba(255,177,122,0.4)">Ajusta con una frase</Chip>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const S8Plans: React.FC = () => {
  const f = useCurrentFrame();
  const plans: [string, string, string][] = [
    ["Roots Plan", "Investigación, reporte, plan semanal y flyers con IA.", C.cream],
    ["Roots Auto", "Todo lo anterior y el motor edita tus videos solo.", "#fff"],
    ["Roots Edit", "Todo lo anterior y nuestro equipo los edita a mano.", "#fff"],
    ["Full PRA", "Producción completa: grabamos, editamos y publicamos.", C.ink],
  ];
  const outro = ease(f, 86, 18, 0, 1, IN_OUT);
  return (
    <Scene dur={260}>
      <AbsoluteFill style={{ opacity: 1 - outro, transform: `scale(${1 - outro * 0.04})` }}>
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 110, gap: 18 }}>
          <Kicker text="Planes" at={2} />
          <Words text="Escoge cuánto quieres delegar." at={8} size={88} stagger={3} />
        </AbsoluteFill>
        <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 28, paddingTop: 170, perspective: 2200 }}>
          {plans.map(([n, d, bg], i) => {
            const p = ease(f, 24 + i * 7, 32);
            const dark = bg === C.ink;
            return (
              <div key={n} style={{ opacity: p, transform: `translateY(${(1 - p) * 120}px) rotateY(${(1 - p) * -40}deg)` }}>
                <Card
                  style={{
                    width: 360,
                    height: 330,
                    background: dark ? `linear-gradient(160deg, ${C.purple}, ${C.ink})` : bg,
                    color: dark ? "#fff" : C.ink,
                    border: dark ? "none" : `1px solid ${C.line}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: 34,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.24em", fontSize: 22, color: dark ? C.sun : C.purple }}>{n.toUpperCase()}</div>
                    <div style={{ fontSize: 23, lineHeight: 1.4, marginTop: 20, color: dark ? "rgba(255,255,255,0.85)" : C.muted }}>{d}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Array.from({ length: 4 }).map((_, k) => (
                      <span key={k} style={{ flex: 1, height: 8, borderRadius: 99, background: k <= i ? (dark ? C.sun : C.purple) : dark ? "rgba(255,255,255,0.2)" : "#ece9f3" }} />
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>
      <Outro at={92} />
    </Scene>
  );
};

const Outro: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const p = ease(f, at + 4, 30);
  if (f < at) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 30, opacity: ease(f, at, 16) }}>
      <Orb x={560} y={330} r={70} color={C.purple} delay={at} />
      <Orb x={1380} y={760} r={50} color={C.peach} delay={at + 8} />
      <Ring x={1420} y={300} size={120} color={C.sun} delay={at + 12} />
      <div style={{ display: "flex", alignItems: "center", gap: 28, transform: `scale(${0.85 + 0.15 * p})`, opacity: p }}>
        <Img src={staticFile("brand/pr-icon-purple.png")} style={{ height: 120, width: "auto" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: `2px solid ${C.line}`, paddingLeft: 28 }}>
          <Img src={staticFile("brand/pr-wordmark-purple.png")} style={{ height: 40, width: "auto" }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.32em", fontSize: 20, color: C.muted }}>ROOTS ENGINE</span>
        </div>
      </div>
      <Words text="Tu contenido, en piloto automático." at={at + 18} size={64} stagger={3} />
      <div
        style={{
          opacity: ease(f, at + 40, 20),
          transform: `translateY(${(1 - ease(f, at + 40, 20)) * 20}px)`,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <span style={{ borderRadius: 99, background: C.purple, color: "#fff", fontFamily: SANS, fontWeight: 700, fontSize: 28, padding: "18px 40px", boxShadow: "0 20px 40px -16px rgba(79,71,137,0.9)" }}>
          Pide tu demo
        </span>
        <span style={{ fontFamily: SANS, fontSize: 26, color: C.muted }}>Purple Roots Agency · El Paso / Juárez</span>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────────── línea de tiempo ─────────────────────────────

const TIMELINE: { from: number; dur: number; C: React.FC }[] = [
  { from: 0, dur: 84, C: S1Hook },
  { from: 76, dur: 76, C: S2Logo },
  { from: 144, dur: 104, C: S3Signup },
  { from: 240, dur: 104, C: S4Market },
  { from: 336, dur: 100, C: S5Report },
  { from: 428, dur: 96, C: S6Plan },
  { from: 516, dur: 104, C: S7Edit },
  { from: 612, dur: 104, C: S7Flyers },
  { from: 708, dur: 192, C: S8Plans },
];

export const Promo: React.FC = () => {
  useFonts(["Inter", "Josefin Sans", "Anton", "Playfair Display"]);
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {TIMELINE.map(({ from, dur, C: S }, i) => (
        <Sequence key={i} from={from} durationInFrames={Math.min(dur, durationInFrames - from)}>
          <S />
        </Sequence>
      ))}
      {TIMELINE.slice(1).map(({ from }, i) => (
        <Whoosh key={i} at={from - 4} />
      ))}
    </AbsoluteFill>
  );
};
