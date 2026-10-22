"use client";
import { useState } from "react";
import { Spinner } from "../ApiButton";

const NETS: [string, string, string][] = [
  ["instagram", "Instagram", "📸"],
  ["tiktok", "TikTok", "🎵"],
  ["facebook", "Facebook", "👍"],
  ["youtube", "YouTube", "▶️"],
];

/** Botones para conectar las redes que faltan (y reconectar las que perdieron el permiso). */
export function ConnectSocial({ clientId, connected = [], broken = [] }: { clientId: string; connected?: string[]; broken?: string[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(platform: string) {
    setBusy(platform);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/social/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      window.location.assign(j.result);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  const missing = NETS.filter(([id]) => !connected.includes(id) && !broken.includes(id));
  const toFix = NETS.filter(([id]) => broken.includes(id) && !connected.includes(id));
  if (!missing.length && !toFix.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {toFix.map(([id, label, icon]) => (
          <button key={id} type="button" className="btn btn-primary" disabled={!!busy} onClick={() => go(id)}>
            {busy === id ? <Spinner /> : <span>{icon}</span>} Reconectar {label}
          </button>
        ))}
        {missing.map(([id, label, icon]) => (
          <button key={id} type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => go(id)}>
            {busy === id ? <Spinner /> : <span>{icon}</span>} Conectar {label}
          </button>
        ))}
      </div>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </div>
  );
}
