// Copia las fuentes (self-hosted, sin depender de Google Fonts en el render)
// y genera los efectos de sonido base con ffmpeg.
// Uso: node scripts/setup-assets.mjs
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fontsOut = path.join(root, "public/fonts");
const sfxOut = path.join(root, "public/sfx");
mkdirSync(fontsOut, { recursive: true });
mkdirSync(sfxOut, { recursive: true });

// [paquete fontsource, slug, pesos]
const FONTS = [
  ["anton", "anton", [400]],
  ["inter", "inter", [400, 600, 800]],
  ["playfair-display", "playfair-display", [700, 900]],
  ["luckiest-guy", "luckiest-guy", [400]],
  ["bebas-neue", "bebas-neue", [400]],
  ["bungee", "bungee", [400]],
  ["nunito", "nunito", [800]],
  ["cormorant-garamond", "cormorant-garamond", [600]],
  ["rye", "rye", [400]],
  ["montserrat", "montserrat", [700, 900]],
  ["josefin-sans", "josefin-sans", [300, 600]],
];

for (const [pkg, slug, weights] of FONTS) {
  for (const w of weights) {
    for (const subset of ["latin", "latin-ext"]) {
      const src = path.join(root, `node_modules/@fontsource/${pkg}/files/${slug}-${subset}-${w}-normal.woff2`);
      if (!existsSync(src)) continue;
      copyFileSync(src, path.join(fontsOut, `${slug}-${subset}-${w}.woff2`));
    }
  }
}
console.log("✓ fuentes copiadas a public/fonts");

// Efectos de sonido sintetizados (cortos, libres de derechos).
const SFX = {
  whoosh: ["-f", "lavfi", "-i", "anoisesrc=d=0.45:c=pink:a=0.6", "-af",
    "highpass=f=400,lowpass=f=6000,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.25,volume=1.4"],
  pop: ["-f", "lavfi", "-i", "sine=f=880:d=0.09", "-af",
    "asetrate=44100*1.6,aresample=44100,afade=t=out:st=0.02:d=0.07,volume=1.2"],
  boom: ["-f", "lavfi", "-i", "sine=f=55:d=0.7", "-af",
    "afade=t=out:st=0.05:d=0.65,volume=3,lowpass=f=200"],
  ding: ["-f", "lavfi", "-i", "sine=f=1318:d=0.6", "-af", "afade=t=out:st=0.02:d=0.58,volume=0.8"],
  click: ["-f", "lavfi", "-i", "anoisesrc=d=0.03:c=white:a=0.9", "-af", "highpass=f=2000,volume=1.2"],
};
try {
  for (const [name, args] of Object.entries(SFX)) {
    execFileSync("ffmpeg", ["-v", "error", "-y", ...args, "-ar", "44100", "-ac", "1", path.join(sfxOut, `${name}.mp3`)]);
  }
  console.log("✓ sfx generados en public/sfx");
} catch {
  console.warn("! ffmpeg no disponible: los sfx no se generaron (ya vienen en el repo).");
}
