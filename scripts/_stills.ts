import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { estimateSegments } from "../src/remotion/promo/ClientPromo";
(async () => {
  const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts"), publicDir: path.resolve("public") });
  const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
  const composition = await selectComposition({ serveUrl, id: "PromoClientes", inputProps: {}, browserExecutable });
  const segs = estimateSegments();
  for (const [i, s] of segs.entries()) {
    const f = Math.round(((s.start + s.end) / 2 + (i===8?1.2:0.6)) * 30);
    await renderStill({ composition, serveUrl, inputProps: composition.props, frame: Math.min(f, composition.durationInFrames-1), output: "/tmp/claude-0/-home-claude/2d9687e2-d008-581d-ab18-6b9f664a4727/scratchpad/cp/s" + i + ".png", browserExecutable });
  }
})();
