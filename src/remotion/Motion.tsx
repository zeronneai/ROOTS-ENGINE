import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EditStyle } from "../lib/styles/types";
import { EMOJI_FONT_STACK } from "./fonts";

/**
 * Motion graphics del auto-editor. Cada estilo de negocio tiene su versión:
 * sticker (urbano, comida, gym), bar (abogados, dental), glow (med spa, bar de noche), minimal (editorial).
 */

/** texto oscuro o claro según el color de fondo */
export function readableOn(color: string) {
  const m = /^#?([0-9a-f]{6})/i.exec(color.trim());
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#FFFFFF";
}

const accentOf = (style: EditStyle) =>
  /^#[0-9a-f]{6}/i.test(style.captions.highlightColor) ? style.captions.highlightColor : style.overlays.progressColor;

/** Si el texto trae un número, lo anima contando desde 0. */
function countUp(text: string, frame: number, fps: number) {
  const m = /(\d+(?:[.,]\d+)?)/.exec(text);
  if (!m) return text;
  const target = Number(m[1].replace(",", "."));
  const p = interpolate(frame, [0, fps * 0.55], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const decimals = m[1].includes(".") || m[1].includes(",") ? 1 : 0;
  const shown = (target * p).toFixed(decimals);
  return text.replace(m[1], shown);
}

// ───────────────────────────── Callout (texto animado) ─────────────────────────────

export const Callout: React.FC<{ text: string; kind: "keyword" | "number"; style: EditStyle }> = ({ text, kind, style }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const accent = accentOf(style);
  const variant = style.motion.calloutStyle;
  const shown = kind === "number" ? countUp(text, frame, fps) : text;
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const upper = style.captions.position === "upper";
  const top = upper ? height * 0.52 : height * 0.15;
  const big = kind === "number" ? 1.35 : 1;
  // que el texto quepa: se achica con textos largos y si aún así no cabe, baja de línea
  const fit = (base: number, maxW: number, em = 0.6) =>
    Math.max(base * 0.5, Math.min(base * big, maxW / Math.max(1, shown.length * em)));
  const wrap = { whiteSpace: "normal" as const, textWrap: "balance" as const, textAlign: "center" as const };

  if (variant === "sticker") {
    const pop = spring({ frame, fps, config: { damping: 7, stiffness: 210, mass: 0.7 } });
    const wobble = Math.sin(frame / 3.2) * 1.4 * (1 - Math.min(1, frame / (fps * 0.9)));
    const fg = readableOn(accent);
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", transform: `scale(${pop * exit}) rotate(${-4 + wobble}deg)` }}>
            <Burst color={accent} size={560 * k} frame={frame} fps={fps} />
            <div
              style={{
                position: "relative",
                fontFamily: `"${style.overlays.hookTitleFont}", sans-serif`,
                fontWeight: 900,
                fontSize: fit(104 * k, 800 * k),
                maxWidth: 860 * k,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: 1 * k,
                color: fg,
                background: accent,
                padding: `${22 * k}px ${40 * k}px`,
                borderRadius: 22 * k,
                border: `${8 * k}px solid ${fg === "#111111" ? "#111111" : "#FFFFFF"}`,
                boxShadow: `${10 * k}px ${12 * k}px 0 rgba(0,0,0,0.85)`,
                ...wrap,
              }}
            >
              {shown}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (variant === "bar") {
    const wipe = interpolate(frame, [0, fps * 0.32], [0, 100], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const textIn = interpolate(frame, [fps * 0.15, fps * 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ pointerEvents: "none", opacity: exit }}>
        <div style={{ position: "absolute", left: 70 * k, top, display: "flex", alignItems: "stretch", clipPath: `inset(0 ${100 - wipe}% 0 0)` }}>
          <div style={{ width: 14 * k, background: accent }} />
          <div
            style={{
              background: "rgba(12,12,18,0.88)",
              padding: `${22 * k}px ${36 * k}px`,
              fontFamily: `"${style.captions.font}", sans-serif`,
              fontWeight: 800,
              fontSize: fit(76 * k, 760 * k, 0.62),
              maxWidth: 860 * k,
              lineHeight: 1.05,
              color: "#FFFFFF",
              letterSpacing: 1 * k,
              ...wrap,
            }}
          >
            <span style={{ opacity: textIn, display: "inline-block", transform: `translateX(${(1 - textIn) * 30 * k}px)` }}>{shown}</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (variant === "glow") {
    const p = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
    return (
      <AbsoluteFill style={{ pointerEvents: "none", opacity: p * exit }}>
        <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", transform: `scale(${interpolate(p, [0, 1], [1.18, 1])})`, filter: `blur(${(1 - p) * 8}px)` }}>
            <Sparkles color={accent} frame={frame} fps={fps} w={640 * k} h={220 * k} />
            <div
              style={{
                fontFamily: `"${style.overlays.hookTitleFont}", serif`,
                fontWeight: 700,
                fontSize: fit(100 * k, 860 * k, 0.58),
                maxWidth: 900 * k,
                lineHeight: 1,
                color: "#FFFFFF",
                textTransform: style.captions.uppercase ? "uppercase" : "none",
                textShadow: `0 0 ${18 * k}px ${accent}, 0 0 ${44 * k}px ${accent}, 0 0 ${80 * k}px ${accent}`,
                ...wrap,
              }}
            >
              {shown}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // minimal (editorial)
  const line = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const txt = interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: exit }}>
      <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * k }}>
        <div style={{ width: 380 * k, height: 2 * k, background: "#FFFFFF", transform: `scaleX(${line})` }} />
        <div
          style={{
            fontFamily: `"${style.overlays.hookTitleFont}", serif`,
            fontWeight: 600,
            fontStyle: "italic",
            fontSize: fit(92 * k, 860 * k, 0.6),
            maxWidth: 900 * k,
            lineHeight: 1,
            color: "#FFFFFF",
            opacity: txt,
            letterSpacing: interpolate(txt, [0, 1], [14, 2]) * k,
            textShadow: "0 4px 24px rgba(0,0,0,0.55)",
            ...wrap,
          }}
        >
          {shown}
        </div>
        <div style={{ width: 380 * k, height: 2 * k, background: "#FFFFFF", transform: `scaleX(${line})` }} />
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────────── Destellos ─────────────────────────────

/** Rayos que salen disparados del centro (detrás de stickers y emojis). */
export const Burst: React.FC<{ color: string; size: number; frame: number; fps: number; rays?: number }> = ({
  color,
  size,
  frame,
  fps,
  rays = 12,
}) => {
  const p = interpolate(frame, [0, fps * 0.45], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const fade = interpolate(frame, [fps * 0.25, fps * 0.55], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (fade <= 0) return null;
  const r0 = size * 0.18 + size * 0.22 * p;
  const r1 = size * 0.26 + size * 0.24 * p;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", opacity: fade, overflow: "visible" }}
    >
      {Array.from({ length: rays }).map((_, i) => {
        const a = (i / rays) * Math.PI * 2 + 0.2;
        return (
          <line
            key={i}
            x1={Math.cos(a) * r0}
            y1={Math.sin(a) * r0}
            x2={Math.cos(a) * r1}
            y2={Math.sin(a) * r1}
            stroke={color}
            strokeWidth={size * 0.022}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

/** Estrellitas que parpadean alrededor (estilo lujo / noche). */
const Sparkles: React.FC<{ color: string; frame: number; fps: number; w: number; h: number }> = ({ color, frame, fps, w, h }) => {
  const spots = [
    [-0.46, -0.42, 1],
    [0.48, -0.3, 0.8],
    [-0.38, 0.5, 0.7],
    [0.4, 0.48, 1.1],
    [0.02, -0.62, 0.6],
  ];
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", overflow: "visible" }}>
      {spots.map(([x, y, s], i) => {
        const tw = Math.max(0, Math.sin((frame + i * 7) / (fps * 0.12)));
        const r = 22 * s * tw * (w / 640);
        const cx = w / 2 + x * w;
        const cy = h / 2 + y * h;
        return (
          <path
            key={i}
            d={`M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`}
            fill="#FFFFFF"
            style={{ filter: `drop-shadow(0 0 ${8 * (w / 640)}px ${color})` }}
          />
        );
      })}
    </svg>
  );
};

/** Líneas de velocidad desde las orillas en los zooms fuertes. */
export const ImpactLines: React.FC<{ p: number; color?: string }> = ({ p, color = "#FFFFFF" }) => {
  const { width, height } = useVideoConfig();
  if (p >= 1) return null;
  const n = 22;
  const cx = width / 2;
  const cy = height * 0.4;
  const R = Math.hypot(width, height) * 0.62;
  const inner = R * interpolate(p, [0, 1], [0.62, 0.9]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: interpolate(p, [0, 0.2, 1], [0, 0.85, 0]) }}>
      <svg width={width} height={height}>
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2 + (i % 2) * 0.07;
          const w = 3 + (i % 3) * 3;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * inner}
              y1={cy + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * R}
              y2={cy + Math.sin(a) * R}
              stroke={color}
              strokeWidth={w * (width / 1080)}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ───────────────────────────── Marca ─────────────────────────────

/** Nombre del negocio entrando arriba a la izquierda (tipo noticiero, pero con su marca). */
export const LowerThird: React.FC<{ name: string; handle?: string; style: EditStyle }> = ({ name, handle, style }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const accent = accentOf(style);
  const inP = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [0, 1], { extrapolateLeft: "clamp" });
  const x = interpolate(inP - out, [0, 1], [-520 * k, 0]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 120 * k, left: 0, transform: `translateX(${x}px)`, display: "flex", alignItems: "stretch" }}>
        <div style={{ width: 16 * k, background: accent }} />
        <div style={{ background: "rgba(10,10,14,0.82)", padding: `${18 * k}px ${30 * k}px ${18 * k}px ${24 * k}px`, borderRadius: `0 ${16 * k}px ${16 * k}px 0` }}>
          <div style={{ fontFamily: `"${style.overlays.hookTitleFont}", sans-serif`, fontWeight: 800, fontSize: 44 * k, color: "#FFFFFF", lineHeight: 1.05 }}>
            {name}
          </div>
          {handle ? (
            <div style={{ fontFamily: `"${style.captions.font}", sans-serif`, fontWeight: 600, fontSize: 28 * k, color: accent, marginTop: 6 * k }}>
              @{handle.replace(/^@/, "")}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Cierre: llamado a la acción y @usuario en los últimos segundos. */
export const EndCard: React.FC<{ cta?: string | null; handle?: string; style: EditStyle }> = ({ cta, handle, style }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const k = width / 1080;
  const accent = accentOf(style);
  const fg = readableOn(accent);
  const p = spring({ frame, fps, config: { damping: 13, stiffness: 150 } });
  const p2 = spring({ frame: frame - 6, fps, config: { damping: 13, stiffness: 150 } });
  const upper = style.captions.position === "upper";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: upper
            ? `linear-gradient(0deg, rgba(0,0,0,${0.55 * p}) 0%, transparent 45%)`
            : `linear-gradient(180deg, rgba(0,0,0,${0.55 * p}) 0%, transparent 45%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: upper ? undefined : height * 0.12,
          bottom: upper ? height * 0.12 : undefined,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22 * k,
        }}
      >
        {cta ? (
          <div
            style={{
              transform: `translateY(${(1 - p) * -60 * k}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
              opacity: p,
              fontFamily: `"${style.overlays.hookTitleFont}", sans-serif`,
              fontWeight: 900,
              fontSize: 84 * k,
              lineHeight: 1.02,
              maxWidth: "86%",
              textAlign: "center",
              textWrap: "balance",
              color: "#FFFFFF",
              textTransform: style.captions.uppercase ? "uppercase" : "none",
              textShadow: "0 6px 26px rgba(0,0,0,0.6)",
            }}
          >
            {cta}
          </div>
        ) : null}
        {handle ? (
          <div
            style={{
              transform: `scale(${p2})`,
              background: accent,
              color: fg,
              borderRadius: 999,
              padding: `${14 * k}px ${34 * k}px`,
              fontFamily: `"${style.captions.font}", sans-serif`,
              fontWeight: 800,
              fontSize: 44 * k,
              boxShadow: `0 ${10 * k}px ${30 * k}px rgba(0,0,0,0.4)`,
              display: "flex",
              alignItems: "center",
              gap: 14 * k,
            }}
          >
            <span style={{ fontSize: 40 * k, fontFamily: EMOJI_FONT_STACK }}>📲</span>@{handle.replace(/^@/, "")}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
