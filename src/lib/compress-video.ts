"use client";

/**
 * Comprime un video en el navegador antes de subirlo (con el chip de video del celular o la compu, sin servidor).
 * El plan gratis de Supabase acepta archivos de hasta 50 MB; si el video pesa más, se baja a 1080p
 * con el bitrate justo para que quepa. Con el plan Pro, sube NEXT_PUBLIC_MAX_UPLOAD_MB y casi nunca se comprime.
 */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;

export async function compressIfNeeded(file: File, onProgress?: (p: number) => void): Promise<File> {
  const limit = MAX_UPLOAD_MB * 1e6 * 0.9;
  if (file.size <= limit) return file;

  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const duration = await input.computeDuration();
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(duration > 0)) throw new Error(`${file.name}: no se pudo leer el video`);

  // 1080p del lado corto, sin agrandar videos más chicos
  const w = track.displayWidth;
  const h = track.displayHeight;
  const vertical = h >= w;
  const short = Math.min(w, h);
  const size = short > 1080 ? (vertical ? { width: 1080 } : { height: 1080 }) : {};

  const audioBps = 128_000;
  const videoBps = Math.max(1_200_000, Math.min(8_000_000, (limit * 8) / duration - audioBps));
  const avc = await mb.canEncodeVideo("avc", { width: 1080, height: 1920 }).catch(() => false);

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: { ...size, frameRate: 30, quality: new mb.Quality({ bitrate: Math.round(videoBps), bitrateMode: "constant" }), ...(avc ? { codec: "avc" as const } : {}) },
    audio: { quality: new mb.Quality({ bitrate: audioBps }) },
    showWarnings: false,
  });
  if (!conversion.isValid) {
    throw new Error(
      `${file.name} pesa ${(file.size / 1e6).toFixed(0)} MB y este navegador no puede comprimirlo. Prueba desde Chrome o súbelo en clips más cortos.`,
    );
  }
  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();
  const buf = (output.target as InstanceType<typeof mb.BufferTarget>).buffer;
  if (!buf) throw new Error(`${file.name}: no se pudo comprimir`);
  const out = new File([buf], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  if (out.size > MAX_UPLOAD_MB * 1e6) {
    throw new Error(`${file.name} sigue pesando ${(out.size / 1e6).toFixed(0)} MB después de comprimir. Súbelo en clips más cortos.`);
  }
  return out;
}
