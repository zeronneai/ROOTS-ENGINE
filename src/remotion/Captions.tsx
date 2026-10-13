import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EditStyle } from "../lib/styles/types";

export type OutWord = { text: string; start: number; end: number; emphasis?: boolean };
type Page = { start: number; end: number; words: OutWord[] };

export function buildPages(words: OutWord[], maxWords: number): Page[] {
  const pages: Page[] = [];
  let cur: OutWord[] = [];
  const flush = () => {
    if (cur.length) pages.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const breakBefore =
      cur.length >= maxWords ||
      (prev && w.start - prev.end > 0.55) ||
      (prev && /[.?!¿¡…]$/.test(prev.text));
    if (breakBefore) flush();
    cur.push(w);
  });
  flush();
  // cada página se queda en pantalla hasta que empieza la siguiente (máx 0.9s extra)
  return pages.map((p, i) => ({
    ...p,
    end: Math.min(pages[i + 1]?.start ?? Infinity, p.end + 0.9),
  }));
}

export const Captions: React.FC<{ words: OutWord[]; style: EditStyle }> = ({ words, style }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const c = style.captions;
  const t = frame / fps;
  const k = width / 1080;

  const pages = useMemo(() => buildPages(words, c.maxWordsPerPage), [words, c.maxWordsPerPage]);
  const page = pages.find((p) => t >= p.start && t < p.end);
  if (!c.enabled || !page) return null;

  const pageFrame = frame - Math.round(page.start * fps);
  const enter = spring({
    frame: pageFrame,
    fps,
    config: c.animation === "bounce" ? { damping: 8, stiffness: 180 } : { damping: 14, stiffness: 200 },
    durationInFrames: 12,
  });

  let containerTransform = "";
  let containerOpacity = 1;
  switch (c.animation) {
    case "pop":
      containerTransform = `scale(${interpolate(enter, [0, 1], [0.72, 1])})`;
      break;
    case "bounce":
      containerTransform = `translateY(${interpolate(enter, [0, 1], [40 * k, 0])}px) scale(${interpolate(enter, [0, 1], [0.85, 1])})`;
      break;
    case "slide":
      containerTransform = `translateY(${interpolate(enter, [0, 1], [28 * k, 0])}px)`;
      containerOpacity = enter;
      break;
    case "fade":
      containerOpacity = interpolate(pageFrame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
      break;
  }

  const top =
    c.position === "upper" ? "16%" : c.position === "center" ? "66%" : undefined;
  const bottom = c.position === "lower" ? "15%" : undefined;

  const fontSize = c.sizePx * k;
  const hasStroke = c.strokeWidth > 0;

  const inner = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        gap: `${0.12 * fontSize}px ${0.32 * fontSize}px`,
        padding: c.background === "pill" ? `${0.25 * fontSize}px ${0.5 * fontSize}px` : 0,
        background: c.background === "pill" ? c.backgroundColor : undefined,
        borderRadius: c.background === "pill" ? 0.6 * fontSize : 0,
        maxWidth: "86%",
      }}
    >
      {page.words.map((w, i) => {
        const active = t >= w.start && t < (page.words[i + 1]?.start ?? page.end);
        const spoken = t >= w.start;
        const isHi = c.highlightMode !== "none" && (active || w.emphasis);
        const wordFrame = frame - Math.round(w.start * fps);
        const pulse =
          c.highlightMode === "scale" && active
            ? interpolate(spring({ frame: wordFrame, fps, config: { damping: 10, stiffness: 260 }, durationInFrames: 8 }), [0, 1], [1, 1.14])
            : 1;
        const hidden = c.animation === "typewriter" && !spoken;

        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: `"${c.font}", sans-serif`,
              fontWeight: c.weight,
              fontSize,
              lineHeight: 1.08,
              letterSpacing: c.letterSpacing * k,
              textTransform: c.uppercase ? "uppercase" : "none",
              color:
                c.highlightMode === "box" && active
                  ? "#081018"
                  : isHi && c.highlightMode !== "underline"
                    ? c.highlightColor
                    : c.color,
              background: c.highlightMode === "box" && active ? c.highlightColor : undefined,
              padding: c.highlightMode === "box" ? `0 ${0.14 * fontSize}px` : undefined,
              borderRadius: c.highlightMode === "box" ? 0.18 * fontSize : undefined,
              WebkitTextStroke: hasStroke && !(c.highlightMode === "box" && active) ? `${c.strokeWidth * k}px ${c.strokeColor}` : undefined,
              paintOrder: "stroke fill",
              textShadow: c.shadow ? `0 ${6 * k}px ${22 * k}px rgba(0,0,0,0.55)` : undefined,
              transform: `scale(${pulse})`,
              opacity: hidden ? 0 : 1,
            }}
          >
            {w.text}
            {c.highlightMode === "underline" && isHi ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -0.08 * fontSize,
                  height: 0.09 * fontSize,
                  background: c.highlightColor,
                  borderRadius: 4,
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top,
          bottom,
          display: "flex",
          justifyContent: "center",
          transform: `${c.position === "center" ? "translateY(-50%) " : ""}${containerTransform}`,
          opacity: containerOpacity,
          background: c.background === "bar" ? c.backgroundColor : undefined,
          padding: c.background === "bar" ? `${0.35 * fontSize}px 0` : 0,
        }}
      >
        {inner}
      </div>
    </AbsoluteFill>
  );
};
