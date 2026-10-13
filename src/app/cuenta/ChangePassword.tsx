"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Spinner } from "@/components/ApiButton";

export function ChangePassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, t: "Mínimo 8 caracteres" });
    if (pw !== pw2) return setMsg({ ok: false, t: "Las contraseñas no coinciden" });
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: "Listo. Desde ahora entra con tu correo y esta contraseña." });
    if (!error) {
      setPw("");
      setPw2("");
    }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <input type="password" className="input" placeholder="Nueva contraseña" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <input type="password" className="input" placeholder="Repítela" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : null} Guardar contraseña</button>
      {msg ? <p className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-sun/60" : "bg-peach/40"}`}>{msg.t}</p> : null}
    </form>
  );
}
