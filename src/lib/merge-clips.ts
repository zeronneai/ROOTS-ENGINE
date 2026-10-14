import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

function hasAudio(file: string) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file]).toString();
  return out.trim().length > 0;
}

function size(file: string) {
  const j = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation", "-of", "json", file]).toString(),
  );
  const s = j.streams?.[0] ?? {};
  const rot = Math.abs(Number(s.side_data_list?.find((d: { rotation?: number }) => d.rotation !== undefined)?.rotation ?? 0));
  const [w, h] = rot === 90 || rot === 270 ? [s.height, s.width] : [s.width, s.height];
  return { w: Number(w) || 1080, h: Number(h) || 1920 };
}

/**
 * Une varios clips en uno solo, en orden. Todos se pasan al mismo formato
 * (el del primer clip: vertical u horizontal), 30 fps y audio AAC, para que el editor los vea como un solo video.
 * Comprimido para que quepa en el almacenamiento (aprox. 35 MB por minuto).
 */
export function mergeClips(files: string[], dir: string): { file: string; clips: { start: number; end: number }[] } {
  const first = size(files[0]);
  const vertical = first.h >= first.w;
  const [W, H] = vertical ? [1080, 1920] : [1920, 1080];
  const parts: string[] = [];
  files.forEach((f, i) => {
    const out = path.join(dir, `part-${i}.mp4`);
    const audio = hasAudio(f);
    const args = ["-v", "error", "-y", "-i", f];
    if (!audio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    args.push(
      "-vf",
      `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p`,
      "-map", "0:v:0",
      "-map", audio ? "0:a:0" : "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "4500k", "-bufsize", "9000k",
      "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
      "-shortest",
      out,
    );
    execFileSync("ffmpeg", args);
    parts.push(out);
  });
  const list = path.join(dir, "parts.txt");
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  const merged = path.join(dir, "merged.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", merged]);
  // dónde empieza y termina cada clip dentro del video unido
  const clips: { start: number; end: number }[] = [];
  let t = 0;
  for (const p of parts) {
    const d = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString().trim()) || 0;
    clips.push({ start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    t += d;
  }
  return { file: merged, clips };
}
