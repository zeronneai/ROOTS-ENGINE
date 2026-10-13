"use client";
import { useActionState } from "react";
import { signupAction, type FormState } from "@/app/access-actions";
import { Spinner } from "@/components/ApiButton";

export function SignupForm({ token, niches }: { token: string; niches: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction.bind(null, token), null);
  return (
    <form action={action} className="mt-8 space-y-8">
      <fieldset className="card space-y-4 p-5 sm:p-6">
        <legend className="chip !bg-sun !border-sun font-semibold">1 · Tu negocio</legend>
        <F l="Nombre del negocio *"><input name="business" required className="input" /></F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F l="Giro">
            <select name="niche" className="input" defaultValue="">
              <option value="">Escoge...</option>
              {niches.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </F>
          <F l="Ciudad"><input name="city" defaultValue="El Paso, TX" className="input" /></F>
          <F l="Instagram"><input name="instagram" placeholder="@tunegocio" className="input" /></F>
          <F l="TikTok"><input name="tiktok" placeholder="@tunegocio" className="input" /></F>
          <F l="Sitio web"><input name="website" placeholder="opcional" className="input" /></F>
          <F l="Idioma de tus videos">
            <select name="language" className="input" defaultValue="es">
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="bilingual">Bilingüe</option>
            </select>
          </F>
        </div>
        <F l="Link de Google Maps (opcional)"><input name="google_maps_url" className="input" placeholder="Si no lo tienes a la mano, lo buscamos" /></F>
      </fieldset>

      <fieldset className="card space-y-4 p-5 sm:p-6">
        <legend className="chip !bg-peach !border-peach font-semibold">2 · Tu cuenta</legend>
        <F l="Tu nombre"><input name="name" className="input" /></F>
        <F l="Correo *"><input name="email" type="email" required className="input" autoComplete="email" /></F>
        <F l="Contraseña (mínimo 8) *"><input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" /></F>
      </fieldset>

      {state?.error ? <p className="rounded-xl bg-peach/30 px-4 py-3 text-sm">{state.error}</p> : null}
      <button className="btn btn-primary w-full !py-3.5 text-base" disabled={pending}>
        {pending ? <><Spinner /> Creando tu cuenta...</> : "Crear mi cuenta y empezar"}
      </button>
    </form>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{l}</span>
      {children}
    </label>
  );
}
