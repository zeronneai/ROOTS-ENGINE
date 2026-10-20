/**
 * Promo para clientes con voz, en español o inglés, horizontal o vertical.
 *   npm run promo:clientes                       → español 16:9
 *   npm run promo:clientes -- --en --vertical    → inglés 9:16
 *   npm run promo:clientes -- --all              → las 4 versiones
 *   agrega --sync para solo medir la voz
 *
 * Voces: public/promo/voz-clientes.mp3 (español) y public/promo/voice-clients-en.mp3 (inglés).
 * Se detectan las pausas entre frases para que cada escena entre justo cuando se dice.
 */
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { detectSilences } from "../src/lib/silence";
import { CLIENT_SCRIPT, estimateSegments, VOICE_FILES, type Lang } from "../src/remotion/promo/ClientPromo";

const args = process.argv.slice(2);

function sync(lang: Lang) {
  const voice = path.resolve("public", VOICE_FILES[lang].mp3);
  if (!existsSync(voice)) {
    console.log(`No hay voz en public/${VOICE_FILES[lang].mp3}: se usan tiempos estimados.`);
    return;
  }
  const script = CLIENT_SCRIPT[lang];
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", voice]).toString().trim());
  const { silences } = detectSilences(voice, 150);
  const inner = silences.filter((s) => s.start > 0.15 && s.end < duration - 0.15);
  const est = estimateSegments(lang, duration);
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
  const segments = script.map((_, i) => ({
    start: +(i === 0 ? first : cuts[i - 1].end).toFixed(3),
    end: +(i === script.length - 1 ? last : cuts[i].start).toFixed(3),
  }));
  writeFileSync(path.resolve("public", VOICE_FILES[lang].json), JSON.stringify({ duration: +duration.toFixed(3), segments }, null, 2));
  console.log(`Voz ${lang} de ${duration.toFixed(1)}s, frases:`);
  segments.forEach((s, i) => console.log(`  ${s.start.toFixed(2)}s  ${script[i]}`));
}

async function render(jobs: { lang: Lang; vertical: boolean }[]) {
  const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts"), publicDir: path.resolve("public") });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  mkdirSync("out", { recursive: true });
  for (const { lang, vertical } of jobs) {
    const id = `PromoClientes${lang === "en" ? "EN" : ""}${vertical ? "Vertical" : ""}`;
    const composition = await selectComposition({ serveUrl, id, inputProps: {}, browserExecutable });
    const out = path.resolve(`out/promo-clientes-${lang}-${vertical ? "9x16" : "16x9"}.mp4`);
    let last = -1;
    console.log(`Renderizando ${id}...`);
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
        if (pct % 20 === 0 && pct !== last) console.log(`  ${(last = pct)}%`);
      },
    });
    console.log(`Listo: ${out}`);
  }
}

const all = args.includes("--all");
const jobs: { lang: Lang; vertical: boolean }[] = all
  ? [
      { lang: "es", vertical: false },
      { lang: "es", vertical: true },
      { lang: "en", vertical: false },
      { lang: "en", vertical: true },
    ]
  : [{ lang: args.includes("--en") ? "en" : "es", vertical: args.includes("--vertical") }];

for (const lang of [...new Set(jobs.map((j) => j.lang))]) sync(lang);
if (!args.includes("--sync"))
  render(jobs).catch((e) => {
    console.error(e);
    process.exit(1);
  });
