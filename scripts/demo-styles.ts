/**
 * Renderiza el MISMO clip en varios estilos para comparar.
 * Uso: npx tsx scripts/demo-styles.ts [ruta-en-public] [preset1,preset2,...]
 * Ej:  npx tsx scripts/demo-styles.ts demo/sample.mp4 street-fade,counsel-authority,glow-luxe
 */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { renderAutoEdit } from "../src/server/render";
import { buildEdl, heuristicDirection } from "../src/lib/edl/build";
import { getPreset, PRESETS } from "../src/lib/styles/presets";
import { demoWords, DEMO_DURATION } from "../src/remotion/demo";

const clip = process.argv[2] ?? "demo/sample.mp4";
const ids = (process.argv[3] ?? PRESETS.map((p) => p.id).join(",")).split(",");
const outDir = path.resolve("out/demo");
mkdirSync(outDir, { recursive: true });

const words = demoWords();

(async () => {
  for (const id of ids) {
    const style = getPreset(id);
    const edl = buildEdl({
      words,
      sourceDuration: DEMO_DURATION,
      style,
      direction: heuristicDirection(words, style, "El secreto que nadie te dice"),
    });
    const out = path.join(outDir, `${id}.mp4`);
    const started = Date.now();
    await renderAutoEdit(
      { src: `/${clip}`.replace(/^\/+/, "/"), edl, style, brand: { handle: "purplerootsagency" } },
      out,
    );
    console.log(`✓ ${id} → ${out} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
})();
