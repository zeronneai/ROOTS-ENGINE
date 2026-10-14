import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import type { EditStyle } from "../lib/styles/types";
import type { Property, TourEdl } from "../lib/tour/types";
import { useFonts, EMOJI_FONT_STACK } from "./fonts";
import { Callout, readableOn } from "./Motion";

export type TourEditProps = {
  src: string;
  edl: TourEdl;
  style: EditStyle;
  brand?: { name?: string; handle?: string; logoUrl?: string | null };
  musicUrl?: string | null;
};

export const calculateTourMetadata: CalculateMetadataFunction<TourEditProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil(props.edl.duration * props.edl.fps)),
  fps: props.edl.fps,
  width: props.edl.width,
  height: props.edl.height,
});

const OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Los datos que sí llenaron, con su ícono, en el orden en que conviene contarlos. */
export function specList(p: Property) {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
  const out: { icon: string; value: string; label: string }[] = [];
  if (p.bedrooms) out.push({ icon: "🛏️", value: fmt(p.bedrooms), label: p.bedrooms === 1 ? "Recámara" : "Recámaras" });
  if (p.bathrooms) out.push({ icon: "🛁", value: fmt(p.bathrooms), label: p.bathrooms === 1 ? "Baño" : "Baños" });
  if (p.builtM2) out.push({ icon: "📐", value: `${fmt(p.builtM2)} m²`, label: "Construcción" });
  if (p.landM2) out.push({ icon: "🌳", value: `${fmt(p.landM2)} m²`, label: "Terreno" });
  if (p.parking) out.push({ icon: "🚗", value: fmt(p.parking), label: p.parking === 1 ? "Estacionamiento" : "Autos" });
  if (p.floors) out.push({ icon: "🏠", value: fmt(p.floors), label: p.floors === 1 ? "Planta" : "Plantas" });
  return out;
}

export const TourEdit: React.FC<TourEditProps> = ({ src, edl, style, brand, musicUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const k = width / 1080;
  const t = frame / fps;
  useFonts([style.captions.font, style.overlays.hookTitleFont, "Inter"]);
  const p = (edl.property ?? {}) as Property;
  const accent = /^#[0-9a-f]{6}/i.test(style.captions.highlightColor) ? style.captions.highlightColor : "#E5C07B";

  const shots = edl.shots;
  const endStart = Math.max(shots.length > 2 ? shots[shots.length - 1].start : edl.duration - 3, edl.duration - 3.4);
  const introEnd = Math.min(shots[0]?.end ?? 2.5, 3);
  const specs = specList(p);
  const extras = [...edl.copy.highlights, ...(p.amenities ?? [])].filter((x, i, a) => a.indexOf(x) === i);

  // qué toca en cada toma (después de la intro y antes del cierre)
  const middle = shots.map((s, i) => i).filter((i) => shots[i].start >= introEnd - 0.01 && shots[i].start < endStart - 0.01);
  const specShots = middle.slice(0, specs.length);
  const extraShots = middle.slice(specs.length, specs.length + extras.length);
  const barFrom = specShots.length ? shots[specShots[specShots.length - 1]].end : introEnd;

  const videoSrc = /^(https?:|blob:|data:)/.test(src) || src.startsWith(staticFile("")) ? src : staticFile(src.replace(/^\/+/, ""));
  const lastBeat = [...edl.beats].reverse().find((b) => b <= t) ?? -1;
  const pulse = t - lastBeat < 0.18 ? 1 + 0.03 * (1 - (t - lastBeat) / 0.18) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* ── tomas ── */}
      {shots.map((s, i) => {
        const from = Math.round(s.start * fps);
        const dur = Math.max(1, Math.round(s.end * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur} premountFor={fps}>
            <Shot src={videoSrc} srcStart={s.src} move={s.move} style={style} first={i === 0} />
          </Sequence>
        );
      })}

      {/* ── color ── */}
      {style.grade.vignette > 0 ? (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,${style.grade.vignette + 0.1}) 100%)` }} />
      ) : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 70%, rgba(0,0,0,0.45) 100%)" }} />

      {/* ── intro: operación, título, ubicación y precio ── */}
      <Sequence durationInFrames={Math.round(introEnd * fps)}>
        <Intro p={p} headline={edl.copy.headline} style={style} accent={accent} />
      </Sequence>

      {/* ── nombre del cuarto ── */}
      {shots.map((s, i) =>
        edl.rooms[s.clip] && s.start >= introEnd - 0.01 && s.start < endStart - 0.01 ? (
          <Sequence key={`r${i}`} from={Math.round(s.start * fps)} durationInFrames={Math.max(1, Math.round((s.end - s.start) * fps))}>
            <RoomLabel text={edl.rooms[s.clip]} style={style} accent={accent} />
          </Sequence>
        ) : null,
      )}

      {/* ── datos uno por uno, al ritmo ── */}
      {specShots.map((si, j) => (
        <Sequence key={`s${j}`} from={Math.round(shots[si].start * fps)} durationInFrames={Math.max(1, Math.round((shots[si].end - shots[si].start) * fps))}>
          <SpecCard spec={specs[j]} accent={accent} />
        </Sequence>
      ))}

      {/* ── lo más atractivo y amenidades ── */}
      {extraShots.map((si, j) => (
        <Sequence key={`x${j}`} from={Math.round((shots[si].start + 0.1) * fps)} durationInFrames={Math.max(1, Math.round((shots[si].end - shots[si].start - 0.15) * fps))}>
          <Callout text={extras[j]} kind="keyword" style={{ ...style, captions: { ...style.captions, position: "lower" } }} />
        </Sequence>
      ))}

      {/* ── barra fija con los datos ── */}
      {specs.length ? (
        <Sequence from={Math.round(barFrom * fps)} durationInFrames={Math.max(1, Math.round((endStart - barFrom) * fps))}>
          <SpecBar specs={specs} price={p.price} style={style} accent={accent} />
        </Sequence>
      ) : null}

      {/* ── cierre ── */}
      <Sequence from={Math.round(endStart * fps)} durationInFrames={Math.max(1, durationInFrames - Math.round(endStart * fps))}>
        <EndCard p={p} headline={edl.copy.headline} cta={edl.copy.cta} brand={brand} style={style} accent={accent} pulse={pulse} />
      </Sequence>

      {/* ── música ── */}
      {musicUrl && edl.music ? (
        <Audio
          src={musicUrl}
          loop
          volume={(f) =>
            Math.min(1, edl.music!.volume * 2.2) *
            interpolate(f, [0, 8, durationInFrames - fps * 1.2, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      ) : null}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6 * k, width: `${(frame / durationInFrames) * 100}%`, background: accent }} />
    </AbsoluteFill>
  );
};

/** Una toma: movimiento lento tipo cámara de cine y entrada según la transición del estilo. */
const Shot: React.FC<{ src: string; srcStart: number; move: TourEdl["shots"][number]["move"]; style: EditStyle; first: boolean }> = ({
  src,
  srcStart,
  move,
  style,
  first,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  let transform = "";
  if (move === "in") transform = `scale(${interpolate(p, [0, 1], [1.02, 1.14])})`;
  if (move === "out") transform = `scale(${interpolate(p, [0, 1], [1.14, 1.02])})`;
  if (move === "left") transform = `scale(1.12) translateX(${interpolate(p, [0, 1], [3, -3])}%)`;
  if (move === "right") transform = `scale(1.12) translateX(${interpolate(p, [0, 1], [-3, 3])}%)`;

  // entrada de la toma
  const e = interpolate(frame, [0, 7], [0, 1], { extrapolateRight: "clamp", easing: OUT });
  let enter = "";
  let opacity = 1;
  let filter = style.grade.filter;
  if (!first) {
    if (style.transition === "whip") {
      enter = `translateX(${(1 - e) * 18 * (move === "left" ? -1 : 1)}%)`;
      filter += ` blur(${(1 - e) * 14}px)`;
    } else if (style.transition === "fade" || style.transition === "none") {
      opacity = interpolate(frame, [0, 6], [0.35, 1], { extrapolateRight: "clamp" });
    } else {
      enter = `scale(${1 + (1 - e) * 0.12})`;
      filter += ` blur(${(1 - e) * 6}px)`;
    }
  }
  const flash = !first && style.transition === "flash" ? interpolate(frame, [0, 5], [0.5, 0], { extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `${enter} ${transform}`, opacity, filter }}>
        <OffthreadVideo src={src} trimBefore={Math.round(srcStart * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} pauseWhenBuffering />
      </AbsoluteFill>
      {flash ? <AbsoluteFill style={{ background: "#fff", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ p: Property; headline: string; style: EditStyle; accent: string }> = ({ p, headline, style, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const a = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const b = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 120 } });
  const c = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 140 } });
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const op = p.operation ? `EN ${p.operation.toUpperCase()}` : null;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: height * 0.11, left: 70 * k, right: 70 * k, display: "flex", flexDirection: "column", gap: 18 * k }}>
        {op ? (
          <div style={{ alignSelf: "flex-start", transform: `translateY(${(1 - a) * -30}px)`, opacity: a, background: accent, color: readableOn(accent), fontFamily: `"Inter", sans-serif`, fontWeight: 800, letterSpacing: 6 * k, fontSize: 30 * k, padding: `${10 * k}px ${22 * k}px`, borderRadius: 8 * k }}>
            {op}
          </div>
        ) : null}
        <div style={{ opacity: b, transform: `translateY(${(1 - b) * 40}px)`, fontFamily: `"${style.overlays.hookTitleFont}", serif`, fontWeight: 700, fontSize: 96 * k, lineHeight: 1.02, color: "#fff", textShadow: "0 6px 30px rgba(0,0,0,0.55)", textWrap: "balance" }}>
          {headline}
        </div>
        {p.location ? (
          <div style={{ opacity: c, transform: `translateX(${(1 - c) * -30}px)`, display: "flex", alignItems: "center", gap: 12 * k, fontFamily: `"Inter", sans-serif`, fontWeight: 600, fontSize: 36 * k, color: "#fff", textShadow: "0 3px 14px rgba(0,0,0,0.6)" }}>
            <span style={{ fontFamily: EMOJI_FONT_STACK }}>📍</span>
            {p.location}
          </div>
        ) : null}
      </div>
      {p.price ? (
        <div style={{ position: "absolute", bottom: height * 0.12, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `scale(${c})`, background: "rgba(10,10,14,0.78)", border: `${3 * k}px solid ${accent}`, borderRadius: 999, padding: `${18 * k}px ${44 * k}px`, fontFamily: `"Inter", sans-serif`, fontWeight: 800, fontSize: 64 * k, color: "#fff", letterSpacing: -1 * k }}>
            {p.price}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const RoomLabel: React.FC<{ text: string; style: EditStyle; accent: string }> = ({ text, style, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const a = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const out = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", top: 120 * k, left: 60 * k, display: "flex", alignItems: "center", gap: 14 * k, opacity: out, transform: `translateX(${(1 - a) * -40}px)` }}>
      <span style={{ width: 6 * k, height: 54 * k, background: accent, borderRadius: 4 }} />
      <span style={{ fontFamily: `"${style.overlays.hookTitleFont}", serif`, fontWeight: 700, fontSize: 52 * k, color: "#fff", textShadow: "0 4px 18px rgba(0,0,0,0.6)", opacity: a }}>{text}</span>
    </div>
  );
};

const SpecCard: React.FC<{ spec: { icon: string; value: string; label: string }; accent: string }> = ({ spec, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const a = spring({ frame, fps, config: { damping: 11, stiffness: 170 } });
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  // el número cuenta desde 0
  const m = /^(\d+(?:\.\d+)?)/.exec(spec.value);
  const count = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp", easing: OUT });
  const shown = m ? spec.value.replace(m[1], (Number(m[1]) * count).toFixed(m[1].includes(".") ? 1 : 0)) : spec.value;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: height * 0.2, display: "flex", justifyContent: "center", opacity: out }}>
      <div style={{ transform: `scale(${a}) translateY(${(1 - a) * 60}px)`, display: "flex", alignItems: "center", gap: 26 * k, background: "rgba(255,255,255,0.94)", borderRadius: 32 * k, padding: `${24 * k}px ${40 * k}px`, boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)" }}>
        <span style={{ fontFamily: EMOJI_FONT_STACK, fontSize: 84 * k }}>{spec.icon}</span>
        <div>
          <div style={{ fontFamily: `"Inter", sans-serif`, fontWeight: 800, fontSize: 92 * k, lineHeight: 1, color: "#111", letterSpacing: -2 * k, fontVariantNumeric: "tabular-nums" }}>{shown}</div>
          <div style={{ fontFamily: `"Inter", sans-serif`, fontWeight: 600, fontSize: 30 * k, color: "#555", textTransform: "uppercase", letterSpacing: 3 * k, marginTop: 6 * k }}>{spec.label}</div>
        </div>
        <span style={{ width: 8 * k, alignSelf: "stretch", background: accent, borderRadius: 4, marginLeft: 6 * k }} />
      </div>
    </div>
  );
};

const SpecBar: React.FC<{ specs: { icon: string; value: string; label: string }[]; price?: string | null; style: EditStyle; accent: string }> = ({ specs, price, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const a = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", left: 40 * k, right: 40 * k, bottom: height * 0.055, opacity: out, transform: `translateY(${(1 - a) * 80}px)` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: `${10 * k}px ${22 * k}px`, background: "rgba(10,10,14,0.72)", borderRadius: 24 * k, padding: `${16 * k}px ${24 * k}px`, fontFamily: `"Inter", sans-serif`, fontWeight: 700, fontSize: 30 * k, color: "#fff" }}>
        {price ? <span style={{ color: accent, fontWeight: 800 }}>{price}</span> : null}
        {specs.slice(0, 4).map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 * k }}>
            <span style={{ fontFamily: EMOJI_FONT_STACK }}>{s.icon}</span>
            {s.value}
          </span>
        ))}
      </div>
    </div>
  );
};

const EndCard: React.FC<{ p: Property; headline: string; cta: string; brand?: TourEditProps["brand"]; style: EditStyle; accent: string; pulse: number }> = ({
  p,
  headline,
  cta,
  brand,
  style,
  accent,
  pulse,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const k = width / 1080;
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 15, stiffness: 130 } });
  const bg = interpolate(frame, [0, 10], [0, 0.72], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `rgba(8,8,12,${bg})`, alignItems: "center", justifyContent: "center", gap: 28 * k, padding: `0 ${70 * k}px`, textAlign: "center" }}>
      {brand?.logoUrl ? (
        <div style={{ opacity: s(0), transform: `scale(${s(0)})`, background: "#fff", borderRadius: 24 * k, padding: `${16 * k}px ${26 * k}px` }}>
          <Img src={brand.logoUrl} style={{ height: 90 * k, width: "auto", maxWidth: 520 * k, objectFit: "contain" }} />
        </div>
      ) : brand?.name ? (
        <div style={{ opacity: s(0), fontFamily: `"${style.overlays.hookTitleFont}", serif`, fontWeight: 700, fontSize: 46 * k, color: "#fff", letterSpacing: 4 * k, textTransform: "uppercase" }}>{brand.name}</div>
      ) : null}
      <div style={{ opacity: s(4), transform: `translateY(${(1 - s(4)) * 30}px)`, fontFamily: `"${style.overlays.hookTitleFont}", serif`, fontWeight: 700, fontSize: 70 * k, lineHeight: 1.05, color: "#fff", textWrap: "balance" }}>
        {headline}
      </div>
      {p.price ? (
        <div style={{ opacity: s(8), transform: `scale(${s(8) * pulse})`, fontFamily: `"Inter", sans-serif`, fontWeight: 800, fontSize: 84 * k, color: accent, letterSpacing: -2 * k }}>{p.price}</div>
      ) : null}
      {p.agentName || p.agentPhone ? (
        <div style={{ opacity: s(12), fontFamily: `"Inter", sans-serif`, color: "#fff", fontSize: 36 * k, lineHeight: 1.4 }}>
          {p.agentName ? <div style={{ fontWeight: 700 }}>{p.agentName}</div> : null}
          {p.agentPhone ? (
            <div style={{ fontWeight: 600, display: "flex", gap: 10 * k, justifyContent: "center" }}>
              <span style={{ fontFamily: EMOJI_FONT_STACK }}>📞</span>
              {p.agentPhone}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ opacity: s(16), transform: `translateY(${(1 - s(16)) * 30}px) scale(${pulse})`, background: accent, color: readableOn(accent), borderRadius: 999, padding: `${20 * k}px ${50 * k}px`, fontFamily: `"Inter", sans-serif`, fontWeight: 800, fontSize: 40 * k, boxShadow: `0 ${16 * k}px ${40 * k}px rgba(0,0,0,0.4)` }}>
        {cta}
      </div>
      {brand?.handle ? <div style={{ opacity: s(20), fontFamily: `"Inter", sans-serif`, fontSize: 30 * k, color: "rgba(255,255,255,0.8)" }}>@{brand.handle.replace(/^@/, "")}</div> : null}
    </AbsoluteFill>
  );
};
