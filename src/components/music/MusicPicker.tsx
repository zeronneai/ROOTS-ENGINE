"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { addClientTrackAction } from "@/app/music-actions";
import { Spinner } from "../ApiButton";

export type TrackOpt = { id: string; title: string; url?: string | null; own?: boolean; path?: string };
export type MusicChoice = { mode: "auto" | "none" | "track"; id: string | null };

/** Escoger música: automática, sin música, una de la biblioteca o subir la propia. */
export function MusicPicker({
  clientId,
  tracks,
  value,
  onChange,
  allowNone = true,
}: {
  clientId: string;
  tracks: TrackOpt[];
  value: MusicChoice;
  onChange: (v: MusicChoice, added?: TrackOpt) => void;
  allowNone?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const selected = tracks.find((t) => t.id === value.id);
  return (
    <div className="space-y-2">
      <select
        className="input"
        value={value.mode === "track" ? value.id ?? "" : value.mode}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "auto" || v === "none" ? { mode: v, id: null } : { mode: "track", id: v });
        }}
      >
        <option value="auto">🎵 Música automática (la IA escoge)</option>
        {allowNone ? <option value="none">Sin música</option> : null}
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.own ? "★ " : ""}
            {t.title}
          </option>
        ))}
      </select>
      {selected?.url ? <audio src={selected.url} controls preload="none" className="h-10 w-full" /> : null}
      <label className="block cursor-pointer text-xs text-purple underline-offset-2 hover:underline">
        <input
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/mp4,audio/x-m4a"
          className="hidden"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            setErr(null);
            try {
              const ext = f.name.split(".").pop()?.toLowerCase() || "mp3";
              const path = `${clientId}/music/${crypto.randomUUID()}.${ext}`;
              const { error } = await supabaseBrowser().storage.from("brand").upload(path, f, { contentType: f.type || "audio/mpeg" });
              if (error) throw new Error(error.message);
              const title = f.name.replace(/\.[^.]+$/, "");
              const id = await addClientTrackAction(clientId, { path, title });
              onChange({ mode: "track", id }, { id, title, own: true, url: URL.createObjectURL(f), path });
            } catch (er) {
              setErr((er as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {busy ? <span className="inline-flex items-center gap-1"><Spinner /> Subiendo canción...</span> : "+ Subir mi propia canción"}
      </label>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </div>
  );
}
