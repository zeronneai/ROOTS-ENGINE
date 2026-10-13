"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (sent)
    return (
      <p className="mt-6 rounded-xl border border-line p-4 text-sm">
        Listo. Revisa <b>{email}</b> y abre el link para entrar.
      </p>
    );

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input className="input" type="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Enviando..." : "Mandarme el link"}
      </button>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </form>
  );
}
