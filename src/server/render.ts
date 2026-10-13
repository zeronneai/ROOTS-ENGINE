import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { AutoEditProps } from "../remotion/AutoEdit";

let bundleLocation: Promise<string> | null = null;

function getBundle() {
  if (!bundleLocation) {
    bundleLocation = bundle({
      entryPoint: path.resolve(process.cwd(), "src/remotion/index.ts"),
      publicDir: path.resolve(process.cwd(), "public"),
      webpackOverride: (config) => config,
    });
  }
  return bundleLocation;
}

/**
 * Renderiza un AutoEdit a MP4.
 * `props.src` debe ser una URL http(s) (ej. URL firmada de Supabase) o una ruta de staticFile.
 */
export async function renderAutoEdit(props: AutoEditProps, outputLocation: string, onProgress?: (p: number) => void) {
  const serveUrl = await getBundle();
  const inputProps = props as unknown as Record<string, unknown>;
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

  const composition = await selectComposition({ serveUrl, id: "AutoEdit", inputProps, browserExecutable });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    browserExecutable,
    crf: 20,
    audioBitrate: "192k",
    concurrency: Number(process.env.REMOTION_CONCURRENCY) || null,
    onProgress: ({ progress }) => onProgress?.(progress),
  });
  return outputLocation;
}
