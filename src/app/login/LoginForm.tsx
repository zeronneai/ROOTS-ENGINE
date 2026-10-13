"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Spinner } from "@/components/ApiButton";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const sb = supabaseBrowser();
    if (mode === "password") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        setErr(error.message.includes("Invalid") ? "Correo o contraseña incorrectos" : error.message);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (sent)
    return (
      <p className="mt-6 rounded-xl bg-sun/50 p-4 text-sm">
        Listo. Revisa <b>{email}</b> y abre el link para entrar.
      </p>
    );

  return (
    <>
      <div className="mt-6 grid grid-cols-2 rounded-full bg-cream p-1 text-sm">
        {(["password", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full py-2 font-medium transition ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}
          >
            {m === "password" ? "Con contraseña" : "Link al correo"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input className="input" type="email" required autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "password" ? (
          <input className="input" type="password" required autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        ) : null}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          {mode === "password" ? "Entrar" : busy ? "Enviando..." : "Mandarme el link"}
        </button>
        {err ? <p className="text-xs text-bad">{err}</p> : null}
      </form>
    </>
  );
}
