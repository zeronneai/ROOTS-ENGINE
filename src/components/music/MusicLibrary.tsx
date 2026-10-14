"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { addAgencyTrackAction, deleteTrackAction } from "@/app/music-actions";
import { ENERGY_LABEL, MUSIC_MOODS } from "@/lib/music-moods";
import { Spinner } from "../ApiButton";

export type TrackView = { id: string; title: string; moods: string[]; energy: number; url: string | null; client: string | null };

export function MusicLibrary({ tracks }: { tracks: TrackView[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [moods, setMoods] = useState<string[]>([]);
  const [energy, setEnergy] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `agency/music/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseBrowser().storage.from("brand").upload(path, file, { contentType: file.type || "audio/mpeg" });
      if (error) throw new Error(error.message);
      await addAgencyTrackAction({ path, title: title || file.name.replace(/\.[^.]+$/, ""), moods, energy });
      setFile(null);
      setTitle("");
      setMoods([]);
      setEnergy(0);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <div className="font-semibold">Agregar canción</div>
        <label className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:border-purple">
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/mp4,audio/x-m4a"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
          {file ? <span className="text-ink">{file.name} · {(file.size / 1e6).toFixed(1)} MB</span> : "Toca para escoger un MP3 (libre de derechos)"}
        </label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre de la canción" />
        <div>
          <div className="label mb-2">¿Cómo se siente?</div>
          <div className="flex flex-wrap gap-2">
            {MUSIC_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMoods(moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m])}
                className={`rounded-full border px-3 py-1.5 text-sm capitalize ${moods.includes(m) ? "border-purple bg-purple text-white" : "border-line bg-white"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-2">Energía: {ENERGY_LABEL[String(energy)]}</div>
          <input type="range" min={-2} max={2} step={1} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="w-full accent-[#4f4789]" />
        </div>
        <button className="btn btn-primary" disabled={!file || busy} onClick={upload}>
          {busy ? <><Spinner /> Subiendo...</> : "Agregar a la biblioteca"}
        </button>
        {err ? <p className="text-sm text-bad">{err}</p> : null}
      </div>

      <div className="space-y-3">
        {tracks.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="chip">{ENERGY_LABEL[String(t.energy)]}</span>
                {t.moods.map((m) => <span key={m} className="chip capitalize">{m}</span>)}
                {t.client ? <span className="chip !bg-peach/40">Solo {t.client}</span> : null}
              </div>
            </div>
            {t.url ? <audio src={t.url} controls preload="none" className="h-10 max-w-full" /> : null}
            <button className="btn btn-ghost !px-3 !py-2 text-xs text-bad" disabled={pending} onClick={() => start(async () => { await deleteTrackAction(t.id); router.refresh(); })}>
              Borrar
            </button>
          </div>
        ))}
        {!tracks.length ? <p className="text-sm text-muted">Todavía no hay canciones. Sube unas 10 para empezar, de distintas energías.</p> : null}
      </div>
    </div>
  );
}
