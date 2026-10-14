import type { TourEdl } from "./types";

type Clip = { start: number; end: number };

/**
 * Arma las tomas del recorrido alineadas al ritmo:
 * cada toma dura un número fijo de golpes (2 en canciones lentas, 4 en rápidas, ~2 s) y se reparten
 * entre los clips según lo que dura cada uno, tomando partes bien distribuidas de cada clip.
 */
export function planShots(opts: { clips: Clip[]; beats: number[]; bpm: number; targetSeconds?: number }): {
  shots: TourEdl["shots"];
  duration: number;
  beats: number[];
} {
  const clips = opts.clips.filter((c) => c.end - c.start > 0.6);
  const total = clips.reduce((a, c) => a + (c.end - c.start), 0);
  const beatLen = 60 / (opts.bpm || 120);
  const perShot = beatLen * 4 < 1.6 ? 8 : beatLen * 4 > 2.8 ? 2 : 4; // golpes por toma, ~2 s
  const target = Math.max(8, Math.min(opts.targetSeconds ?? 30, total * 0.92, 90));

  // cortes en tiempos de golpe; si la canción no trae suficientes golpes, seguimos la rejilla
  const beats = [...opts.beats];
  while (beats.length && beats[beats.length - 1] < target + 4) beats.push(+(beats[beats.length - 1] + beatLen).toFixed(3));
  if (!beats.length) for (let t = 0; t < target + 4; t += beatLen) beats.push(+t.toFixed(3));
  const cuts = [0];
  for (let i = perShot; i < beats.length; i += perShot) {
    if (beats[i] - cuts[cuts.length - 1] < 0.8) continue;
    cuts.push(beats[i]);
    if (beats[i] >= target) break;
  }
  const n = cuts.length - 1;
  if (n < 1 || !clips.length) return { shots: [], duration: 0, beats: [] };

  // cuántas tomas le tocan a cada clip (al menos 1 a cada uno mientras alcance)
  const alloc = clips.map(() => 0);
  for (let k = 0; k < Math.min(n, clips.length); k++) alloc[k] = 1;
  for (let k = clips.length; k < n; k++) {
    let best = 0;
    let score = -Infinity;
    clips.forEach((c, i) => {
      const s = (c.end - c.start) / (alloc[i] + 1);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    alloc[best]++;
  }

  const moves: TourEdl["shots"][number]["move"][] = ["in", "right", "out", "left"];
  const shots: TourEdl["shots"] = [];
  let k = 0;
  clips.forEach((c, i) => {
    for (let j = 0; j < alloc[i] && k < n; j++, k++) {
      const len = cuts[k + 1] - cuts[k];
      const usable = c.end - c.start - 0.6;
      // partes repartidas a lo largo del clip, saltando el inicio y el final (movimientos de cámara al empezar)
      const free = Math.max(0, usable - len);
      const src = c.start + 0.3 + (alloc[i] === 1 ? free / 2 : (free * j) / (alloc[i] - 1));
      shots.push({ start: cuts[k], end: cuts[k + 1], src: +src.toFixed(3), clip: i, move: moves[k % moves.length] });
    }
  });
  const duration = shots[shots.length - 1].end;
  return { shots, duration, beats: beats.filter((b) => b < duration) };
}
