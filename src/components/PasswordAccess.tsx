"use client";
import { useActionState } from "react";
import { setClientPasswordAction, type FormState } from "@/app/access-actions";
import { Spinner } from "./ApiButton";

/** La agencia le crea al cliente acceso con correo y contraseña (sin esperar correos). */
export function PasswordAccess({ clientId, defaultEmail }: { clientId: string; defaultEmail?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setClientPasswordAction.bind(null, clientId), null);
  return (
    <form action={action} className="space-y-2">
      <input name="email" type="email" required defaultValue={defaultEmail ?? ""} placeholder="correo del cliente" className="input" />
      <input name="password" type="text" required minLength={8} placeholder="contraseña (mínimo 8)" className="input" autoComplete="off" />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? <Spinner /> : null} Crear acceso</button>
      {state?.error ? <p className="text-xs text-bad">{state.error}</p> : null}
      {state?.ok ? <p className="rounded-lg bg-sun/60 px-3 py-2 text-xs">{state.ok}</p> : null}
    </form>
  );
}
