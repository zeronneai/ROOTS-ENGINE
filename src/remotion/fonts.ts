import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

import { FONT_FILES } from "../lib/styles/fonts";
export { AVAILABLE_FONTS } from "../lib/styles/fonts";

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const cache = new Map<string, Promise<void>>();

export function loadFont(family: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const def = FONT_FILES[family];
  if (!def) return Promise.resolve();
  if (cache.has(family)) return cache.get(family)!;

  const p = Promise.all(
    def.weights.flatMap((w) =>
      (
        [
          ["latin", LATIN],
          ["latin-ext", LATIN_EXT],
        ] as const
      ).map(async ([subset, range]) => {
        const face = new FontFace(family, `url(${staticFile(`fonts/${def.slug}-${subset}-${w}.woff2`)}) format("woff2")`, {
          weight: String(w),
          unicodeRange: range,
        });
        try {
          await face.load();
          document.fonts.add(face);
        } catch {
          // subset faltante: no rompe el render
        }
      }),
    ),
  ).then(() => undefined);

  cache.set(family, p);
  return p;
}

/** Bloquea el render hasta que carguen las fuentes (y las recarga si cambian). */
export function useFonts(families: string[]) {
  const key = families.join("|");
  const [handle] = useState(() => delayRender(`fonts: ${key}`));
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all(key.split("|").map(loadFont)).finally(() => {
      continueRender(handle);
      if (alive) force((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [key, handle]);
}

export const EMOJI_FONT_STACK = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
