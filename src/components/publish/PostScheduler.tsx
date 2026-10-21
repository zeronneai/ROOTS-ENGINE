"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ApiButton";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { compressIfNeeded } from "@/lib/compress-video";

type Account = { id: string; platform: string; name: string };
type EditOption = { id: string; title: string; caption: string | null; ideaId: string | null };

const NET: Record<string, string> = { instagram: "📸 Instagram", tiktok: "🎵 TikTok", facebook: "👍 Facebook", youtube: "▶️ YouTube" };

/** Mañana a las 10:00, en formato de <input type="datetime-local">. */
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Formulario para programar un post. */
export function PostScheduler({ clientId, accounts, edits, defaultEdit }: { clientId: string; accounts: Account[]; edits: EditOption[]; defaultEdit?: string | null }) {
  const router = useRouter();
  const first = edits.find((e) => e.id === defaultEdit) ?? null;
  const [source, setSource] = useState<"edit" | "upload" | "dropbox_file" | "dropbox_folder">(edits.length ? "edit" : "upload");
  const [editId, setEditId] = useState(first?.id ?? edits[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dropboxUrl, setDropboxUrl] = useState("");
  const [caption, setCaption] = useState(first?.caption ?? "");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>(accounts.map((a) => a.id));
  const [when, setWhen] = useState(defaultWhen);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const youtube = useMemo(() => accounts.some((a) => a.platform === "youtube" && picked.includes(a.id)), [accounts, picked]);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function chooseEdit(id: string) {
    setEditId(id);
    const e = edits.find((x) => x.id === id);
    if (e?.caption && !caption.trim()) setCaption(e.caption);
  }

  async function submit() {
    setErr(null);
    setDone(false);
    try {
      let mediaPath: string | null = null;
      if (source === "upload") {
        if (!file) throw new Error("Escoge el archivo");
        setBusy("Preparando el archivo...");
        const f = file.type.startsWith("video/") ? await compressIfNeeded(file, (p) => setBusy(`Comprimiendo: ${Math.round(p * 100)}%`)) : file;
        const ext = (f.name.split(".").pop() || "mp4").toLowerCase();
        mediaPath = `${clientId}/social/${crypto.randomUUID()}.${ext}`;
        setBusy("Subiendo...");
        const { error } = await supabaseBrowser().storage.from("recordings").upload(mediaPath, f, { contentType: f.type || "video/mp4" });
        if (error) throw new Error(error.message);
      }
      setBusy("Programando...");
      const res = await fetch(`/api/clients/${clientId}/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          editId: source === "edit" ? editId : null,
          mediaPath,
          dropboxUrl: source.startsWith("dropbox") ? dropboxUrl : null,
          caption,
          title: youtube ? title : null,
          accountIds: picked,
          scheduledFor: new Date(when).toISOString(),
          timezone: tz,
          ideaId: source === "edit" ? (edits.find((e) => e.id === editId)?.ideaId ?? null) : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      setDone(true);
      setFile(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const opt = (id: typeof source, label: string, hint: string) => (
    <button type="button" onClick={() => setSource(id)} className={`rounded-xl border px-3 py-2 text-left text-xs ${source === id ? "border-purple glow" : "border-line"}`}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-muted">{hint}</div>
    </button>
  );

  return (
    <div className="card space-y-5 p-5">
      <div className="font-semibold">Programar un post</div>

      <div className="space-y-2">
        <div className="label">¿De dónde sale el video?</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("edit", "Video del motor", "Uno que ya editó Roots Engine")}
          {opt("upload", "Subir archivo", "Video o imagen de tu compu o celular")}
          {opt("dropbox_file", "Link de Dropbox", "Un archivo específico")}
          {opt("dropbox_folder", "Carpeta de Dropbox", "El más nuevo, aunque todavía no exista")}
        </div>
      </div>

      {source === "edit" ? (
        edits.length ? (
          <select className="input" value={editId} onChange={(e) => chooseEdit(e.target.value)}>
            {edits.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        ) : (
          <p className="text-sm text-muted">Todavía no hay videos exportados.</p>
        )
      ) : null}
      {source === "upload" ? <input type="file" accept="video/*,image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /> : null}
      {source.startsWith("dropbox") ? (
        <div className="space-y-1">
          <input className="input" value={dropboxUrl} onChange={(e) => setDropboxUrl(e.target.value)} placeholder="https://www.dropbox.com/scl/fo/..." />
          <p className="text-xs text-muted">
            {source === "dropbox_folder"
              ? "15 minutos antes de la hora, el sistema toma el video más nuevo de la carpeta que no se haya publicado. Puedes subirlo a la carpeta después de programar. Necesita el worker prendido."
              : "Comparte el archivo como \"cualquiera con el link\". Se baja 15 minutos antes de la hora (necesita el worker prendido)."}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="label">Dónde se publica</div>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const on = picked.includes(a.id);
            return (
              <button key={a.id} type="button" onClick={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-purple glow font-semibold" : "border-line text-muted"}`}>
                {NET[a.platform] ?? a.platform} · {a.name}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="label">Copy</span>
        <textarea rows={5} className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="El texto del post, con hashtags" />
      </label>
      {youtube ? (
        <label className="block space-y-1">
          <span className="label">Título para YouTube</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Si lo dejas vacío, se usa la primera línea del copy" />
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="label">Fecha y hora ({tz})</span>
        <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={!!busy || !picked.length} onClick={submit}>
          {busy ? <><Spinner /> {busy}</> : "Programar"}
        </button>
        {done ? <span className="text-xs text-ok">Listo, quedó programado.</span> : null}
        {err ? <span className="text-xs text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
