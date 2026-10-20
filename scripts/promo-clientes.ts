/**
 * Promo para clientes con voz.
 *   npm run promo:clientes            → mide la voz (si existe) y renderiza out/promo-clientes.mp4
 *   npm run promo:clientes -- --sync  → solo mide la voz y escribe los tiempos
 *
 * La voz va en public/promo/voz-clientes.mp3 (el guion está en src/remotion/promo/ClientPromo.tsx).
 * Se detectan las pausas entre frases para que cada escena entre justo cuando se dice.
 */
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { detectSilences } from "../src/lib/silence";
import { CLIENT_SCRIPT, estimateSegments } from "../src/remotion/promo/ClientPromo";

const VOICE = path.resolve("public/promo/voz-clientes.mp3");
const TIMES = path.resolve("public/promo/voz-clientes.json");

function sync() {
  if (!existsSync(VOICE)) {
    console.log("No hay voz en public/promo/voz-clientes.mp3: se usan tiempos estimados.");
    return;
  }
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", VOICE]).toString().trim());
  const { silences } = detectSilences(VOICE, 150);
  const inner = silences.filter((s) => s.start > 0.15 && s.end < duration - 0.15);
  const est = estimateSegments(duration);
  // para cada cambio de frase, la pausa más cercana a donde debería estar
  const cuts: { start: number; end: number }[] = [];
  let from = 0;
  for (let i = 0; i < est.length - 1; i++) {
    const target = (est[i].end + est[i + 1].start) / 2;
    const options = inner.filter((s) => s.start > from + 0.4);
    const best = options.sort((a, b) => Math.abs((a.start + a.end) / 2 - target) - Math.abs((b.start + b.end) / 2 - target))[0];
    const cut = best ?? { start: target - 0.1, end: target + 0.1 };
    cuts.push(cut);
    from = cut.end;
  }
  const first = silences[0]?.start === 0 ? silences[0].end : 0;
  const lastSil = silences.at(-1);
  const last = lastSil && lastSil.end >= duration - 0.05 ? lastSil.start : duration;
  const segments = CLIENT_SCRIPT.map((_, i) => ({
    start: +(i === 0 ? first : cuts[i - 1].end).toFixed(3),
    end: +(i === CLIENT_SCRIPT.length - 1 ? last : cuts[i].start).toFixed(3),
  }));
  writeFileSync(TIMES, JSON.stringify({ duration: +duration.toFixed(3), segments }, null, 2));
  console.log(`Voz de ${duration.toFixed(1)}s, frases:`);
  segments.forEach((s, i) => console.log(`  ${s.start.toFixed(2)}s  ${CLIENT_SCRIPT[i]}`));
}

async function render() {
  const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts"), publicDir: path.resolve("public") });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const composition = await selectComposition({ serveUrl, id: "PromoClientes", inputProps: {}, browserExecutable });
  mkdirSync("out", { recursive: true });
  const out = path.resolve("out/promo-clientes.mp4");
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: out,
    inputProps: composition.props,
    browserExecutable,
    crf: 18,
    audioBitrate: "192k",
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0 && pct !== last) console.log(`  render ${(last = pct)}%`);
    },
  });
  console.log(`Listo: ${out}`);
}

sync();
if (!process.argv.includes("--sync")) render().catch((e) => {
  console.error(e);
  process.exit(1);
});
