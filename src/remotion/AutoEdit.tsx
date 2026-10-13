import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import type { Edl } from "../lib/edl/types";
import type { EditStyle } from "../lib/styles/types";
import { makeTimeMap } from "../lib/edl/build";
import { Captions, type OutWord } from "./Captions";
import { EMOJI_FONT_STACK, useFonts } from "./fonts";

export type AutoEditProps = {
  src: string;
  edl: Edl;
  style: EditStyle;
  brand?: { name?: string; handle?: string };
};

export const calculateAutoEditMetadata: CalculateMetadataFunction<AutoEditProps> = ({ props }) => {
  const { total } = makeTimeMap(props.edl.segments);
  return {
    durationInFrames: Math.max(1, Math.ceil(total * props.edl.fps)),
    fps: props.edl.fps,
    width: props.edl.width,
    height: props.edl.height,
  };
};

type Cut = { at: number; kind: EditStyle["transition"] };

export const AutoEdit: React.FC<AutoEditProps> = ({ src, edl, style, brand }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const k = width / 1080;

  useFonts([style.captions.font, style.overlays.hookTitleFont]);
  const videoSrc = /^(https?:|blob:|data:)/.test(src) || src.startsWith(staticFile("")) ? src : staticFile(src.replace(/^\/+/, ""));

  const tm = useMemo(() => makeTimeMap(edl.segments), [edl.segments]);

  // ── todo a tiempo de salida ──
  const words: OutWord[] = useMemo(
    () =>
      edl.words
        .map((w) => {
          const s = tm.toOut(w.start);
          if (s === null) return null;
          const e = tm.toOut(w.end) ?? s + (w.end - w.start);
          return { text: w.text, start: s, end: Math.max(e, s + 0.05), emphasis: w.emphasis };
        })
        .filter(Boolean) as OutWord[],
    [edl.words, tm],
  );

  const zooms = useMemo(
    () =>
      edl.zooms
        .map((z) => ({ ...z, at: tm.toOutSnap(z.at) }))
        .filter((z): z is typeof z & { at: number } => z.at !== null),
    [edl.zooms, tm],
  );
  const emojis = useMemo(
    () => edl.emojis.map((e) => ({ ...e, at: tm.toOutSnap(e.at) })).filter((e) => e.at !== null) as (Edl["emojis"][number])[],
    [edl.emojis, tm],
  );
  const sfx = useMemo(
    () => edl.sfx.map((s) => ({ ...s, at: tm.toOutSnap(s.at) })).filter((s) => s.at !== null) as Edl["sfx"],
    [edl.sfx, tm],
  );

  // transiciones solo en los saltos grandes (no en cada micro-corte)
  const cuts: Cut[] = useMemo(() => {
    if (style.transition === "none" || style.transition === "fade") return [];
    const out: Cut[] = [];
    let last = -Infinity;
    edl.segments.forEach((s, i) => {
      if (i === 0) return;
      const removed = s.start - edl.segments[i - 1].end;
      const at = tm.offsets[i];
      if (removed >= 0.8 && at - last > 2) {
        out.push({ at, kind: style.transition });
        last = at;
      }
    });
    return out;
  }, [edl.segments, style.transition, tm]);

  // ── segmento actual (para jump-cut alterno) ──
  let segIndex = 0;
  for (let i = 0; i < tm.offsets.length; i++) if (t >= tm.offsets[i]) segIndex = i;
  const jumpScale = style.zoom.jumpCutAlternate && segIndex % 2 === 1 ? 1.07 : 1;

  // ── zoom ──
  let zoomScale = 1;
  let shakeX = 0;
  let shakeY = 0;
  for (const z of zooms) {
    const local = t - z.at;
    if (local < 0 || local > z.duration) continue;
    const target = z.scale ?? style.zoom.intensity;
    const kind = z.kind ?? style.zoom.style;
    if (kind === "smooth") {
      const p = interpolate(local, [0, z.duration * 0.55, z.duration], [0, 1, 0], {
        easing: Easing.inOut(Easing.cubic),
      });
      zoomScale = 1 + (target - 1) * p;
    } else {
      const inP = interpolate(local, [0, 0.08], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
      const outP = interpolate(local, [z.duration - 0.1, z.duration], [1, 0], { extrapolateLeft: "clamp" });
      zoomScale = 1 + (target - 1) * Math.min(inP, outP);
      if (kind === "shake" && local < 0.35) {
        const amp = (1 - local / 0.35) * 14 * k;
        shakeX = Math.sin(frame * 2.7) * amp;
        shakeY = Math.cos(frame * 3.3) * amp * 0.6;
      }
    }
  }

  // ── transición de corte ──
  let cutFx: { kind: Cut["kind"]; p: number } | null = null;
  for (const c of cuts) {
    const local = t - c.at;
    if (local >= 0 && local < 0.16) cutFx = { kind: c.kind, p: local / 0.16 };
  }
  let cutTransform = "";
  let cutFilter = "";
  if (cutFx?.kind === "whip") {
    cutTransform = `translateX(${interpolate(cutFx.p, [0, 1], [-90 * k, 0])}px)`;
    cutFilter = `blur(${interpolate(cutFx.p, [0, 1], [10, 0])}px)`;
  } else if (cutFx?.kind === "glitch") {
    const j = Math.sin(frame * 12.9898) > 0 ? 1 : -1;
    cutTransform = `translateX(${j * 16 * k * (1 - cutFx.p)}px) skewX(${j * 5 * (1 - cutFx.p)}deg)`;
    cutFilter = `hue-rotate(${j * 40 * (1 - cutFx.p)}deg) saturate(1.6)`;
  }

  const progress = frame / Math.max(1, durationInFrames - 1);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* ── video con cortes, zoom y color ── */}
      <AbsoluteFill
        style={{
          transform: `translate(${shakeX}px, ${shakeY}px) scale(${zoomScale * jumpScale}) ${cutTransform}`,
          transformOrigin: "50% 38%",
          filter: `${style.grade.filter} ${cutFilter}`.trim(),
        }}
      >
        {edl.segments.map((s, i) => {
          const from = Math.round(tm.offsets[i] * fps);
          const next = i + 1 < edl.segments.length ? Math.round(tm.offsets[i + 1] * fps) : durationInFrames;
          return (
            <Sequence key={i} from={from} durationInFrames={Math.max(1, next - from)} premountFor={fps}>
              <OffthreadVideo
                src={videoSrc}
                trimBefore={Math.round(s.start * fps)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                pauseWhenBuffering
              />
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* ── color: tinte, viñeta, grano ── */}
      {style.grade.tint !== "transparent" ? <AbsoluteFill style={{ background: style.grade.tint, mixBlendMode: "soft-light" }} /> : null}
      {style.grade.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${style.grade.vignette}) 100%)`,
          }}
        />
      ) : null}
      {style.grade.grain > 0 ? <Grain amount={style.grade.grain} seed={frame % 8} /> : null}

      {/* ── flash ── */}
      {cutFx?.kind === "flash" ? (
        <AbsoluteFill style={{ background: "#fff", opacity: interpolate(cutFx.p, [0, 1], [0.75, 0]) }} />
      ) : null}

      {/* ── emojis ── */}
      {emojis.map((e, i) => (
        <Sequence key={`e${i}`} from={Math.round(e.at * fps)} durationInFrames={Math.round(e.duration * fps)}>
          <Emoji emoji={e.emoji} x={e.x} y={e.y} size={style.emojis.sizePx * k} animation={style.emojis.animation} />
        </Sequence>
      ))}

      {/* ── subtítulos ── */}
      <Captions words={words} style={style} />

      {/* ── título del hook ── */}
      {edl.hookTitle ? (
        <Sequence durationInFrames={Math.round(edl.hookTitle.duration * fps)}>
          <HookTitle text={edl.hookTitle.text} style={style} />
        </Sequence>
      ) : null}

      {/* ── barra de progreso ── */}
      {style.overlays.progressBar ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 10 * k,
            width: `${progress * 100}%`,
            background: style.overlays.progressColor,
            boxShadow: `0 0 ${18 * k}px ${style.overlays.progressColor}`,
          }}
        />
      ) : null}

      {/* ── @handle ── */}
      {style.overlays.handle && brand?.handle ? (
        <div
          style={{
            position: "absolute",
            top: 64 * k,
            left: 56 * k,
            fontFamily: `"${style.captions.font}", sans-serif`,
            fontWeight: 600,
            fontSize: 30 * k,
            color: "rgba(255,255,255,0.85)",
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            letterSpacing: 1,
          }}
        >
          @{brand.handle.replace(/^@/, "")}
        </div>
      ) : null}

      {/* ── sonidos ── */}
      {sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.round(s.at * fps)} durationInFrames={Math.round(fps * 1)}>
          <Audio src={staticFile(`sfx/${s.kind}.mp3`)} volume={style.sfx.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Emoji: React.FC<{ emoji: string; x: number; y: number; size: number; animation: EditStyle["emojis"]["animation"] }> = ({
  emoji,
  x,
  y,
  size,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 9, stiffness: 220 } });
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  let transform = `scale(${enter * exit})`;
  if (animation === "float") transform = `translateY(${Math.sin(frame / 6) * 10 - (1 - enter) * 40}px) scale(${0.6 + 0.4 * enter})`;
  if (animation === "spin") transform = `rotate(${interpolate(enter, [0, 1], [-140, 0])}deg) scale(${enter * exit})`;
  if (animation === "drop") transform = `translateY(${interpolate(enter, [0, 1], [-height * 0.25, 0])}px)`;

  return (
    <div
      style={{
        position: "absolute",
        left: x * width - size / 2,
        top: y * height - size / 2,
        fontSize: size,
        lineHeight: 1,
        fontFamily: EMOJI_FONT_STACK,
        transform,
        opacity: animation === "float" || animation === "drop" ? enter * exit : 1,
        filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))",
      }}
    >
      {emoji}
    </div>
  );
};

const HookTitle: React.FC<{ text: string; style: EditStyle }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const k = width / 1080;
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const o = style.overlays;
  return (
    <div
      style={{
        position: "absolute",
        top: style.captions.position === "upper" ? "auto" : "11%",
        bottom: style.captions.position === "upper" ? "14%" : "auto",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: exit,
        transform: `translateY(${interpolate(enter, [0, 1], [-30 * k, 0])}px) scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
      }}
    >
      <div
        style={{
          maxWidth: "84%",
          textAlign: "center",
          textWrap: "balance",
          fontFamily: `"${o.hookTitleFont}", sans-serif`,
          fontWeight: 900,
          fontSize: 78 * k,
          lineHeight: 1.05,
          color: o.hookTitleColor,
          background: o.hookTitleBg,
          padding: `${18 * k}px ${30 * k}px`,
          borderRadius: 18 * k,
          textTransform: style.captions.uppercase ? "uppercase" : "none",
          boxShadow: o.hookTitleBg === "transparent" ? undefined : `0 ${12 * k}px ${40 * k}px rgba(0,0,0,0.35)`,
          textShadow: o.hookTitleBg === "transparent" ? "0 4px 18px rgba(0,0,0,0.6)" : undefined,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// textura de grano precalculada (public/fx-grain.png); se mueve cada frame
const Grain: React.FC<{ amount: number; seed: number }> = ({ amount, seed }) => (
  <AbsoluteFill
    style={{
      opacity: amount * 1.4,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      backgroundImage: `url(${staticFile("fx-grain.png")})`,
      backgroundSize: "256px 256px",
      backgroundPosition: `${(seed * 97) % 256}px ${(seed * 53) % 256}px`,
    }}
  />
);
