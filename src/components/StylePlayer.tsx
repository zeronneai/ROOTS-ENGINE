"use client";
import { Player } from "@remotion/player";
import { useMemo } from "react";
import { AutoEdit } from "@/remotion/AutoEdit";
import { buildEdl, heuristicDirection, makeTimeMap, type Direction } from "@/lib/edl/build";
import type { Word } from "@/lib/edl/types";
import type { EditStyle } from "@/lib/styles/types";

/** Vista previa en vivo del auto-editor: cambia el estilo y se ve al instante. */
export function StylePlayer(props: {
  src: string;
  words: Word[];
  duration: number;
  style: EditStyle;
  direction?: Direction | null;
  hookTitle?: string | null;
  handle?: string | null;
  brandName?: string | null;
  assetUrls?: Record<string, string>;
  className?: string;
}) {
  const { src, words, duration, style, direction, hookTitle, handle } = props;

  const edl = useMemo(() => {
    const dir = direction ?? heuristicDirection(words, style, hookTitle ?? null);
    return buildEdl({ words, sourceDuration: duration, style, direction: dir });
  }, [words, duration, style, direction, hookTitle]);

  const frames = Math.max(1, Math.ceil(makeTimeMap(edl.segments).total * edl.fps));

  return (
    <div className={props.className} style={{ aspectRatio: "9 / 16" }}>
      <Player
        component={AutoEdit}
        inputProps={{ src, edl, style, brand: { handle: handle ?? undefined, name: props.brandName ?? undefined }, assetUrls: props.assetUrls }}
        durationInFrames={frames}
        fps={edl.fps}
        compositionWidth={edl.width}
        compositionHeight={edl.height}
        style={{ width: "100%", height: "100%", borderRadius: 18, overflow: "hidden" }}
        controls
        loop
        clickToPlay
        acknowledgeRemotionLicense
      />
    </div>
  );
}
