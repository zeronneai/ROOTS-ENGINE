"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { AuditFormState } from "@/app/audit-actions";

type Values = Partial<{
  business_name: string;
  intro: string | null;
  category: string | null;
  city: string;
  website: string | null;
  google_maps_url: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  team_notes: string | null;
  language: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}>;

/** Lo que nos dieron del prospecto. Solo el nombre es obligatorio: lo demás lo busca el motor. */
export function AuditForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (prev: AuditFormState, form: FormData) => Promise<AuditFormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const v = (k: keyof Values) => (values[k] ?? "") as string;
  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio *">
          <input name="business_name" required className="input" defaultValue={v("business_name")} />
        </Field>
        <Field label="Giro (para buscar a su competencia)" hint="Ej: med spa, barbería, abogado de accidentes, taquería">
          <input name="category" className="input" defaultValue={v("category")} placeholder="Si lo dejas vacío, se toma de Google" />
        </Field>
        <Field label="Ciudad">
          <input name="city" className="input" defaultValue={v("city") || "El Paso, TX"} />
        </Field>
        <Field label="Idioma del reporte">
          <select name="language" className="input" defaultValue={v("language") || "en"}>
            <option value="en">Inglés</option>
            <option value="es">Español</option>
          </select>
        </Field>
        <Field label="Instagram">
          <input name="instagram" className="input" defaultValue={v("instagram")} placeholder="@usuario o link" />
        </Field>
        <Field label="TikTok">
          <input name="tiktok" className="input" defaultValue={v("tiktok")} placeholder="@usuario o link" />
        </Field>
        <Field label="Facebook">
          <input name="facebook" className="input" defaultValue={v("facebook")} placeholder="Link de la página" />
        </Field>
        <Field label="Sitio web">
          <input name="website" className="input" defaultValue={v("website")} placeholder="Si no lo pones, se toma de Google" />
        </Field>
        <Field label="Link de Google Maps (opcional)" hint="Ayuda si el nombre es muy común">
          <input name="google_maps_url" className="input" defaultValue={v("google_maps_url")} placeholder="Si no, se busca por nombre y ciudad" />
        </Field>
      </div>
      <Field label="Cuéntale al motor del negocio" hint="A qué se dedica, qué vende, a quién, qué nos dijo que le preocupa. Entre más contexto, mejor la auditoría.">
        <textarea name="intro" rows={4} className="input" defaultValue={v("intro")} />
      </Field>
      <Field label="Notas del equipo (opcional)" hint="Ej: les mandamos DM y contestaron en 2 días; el número de Google no contesta; el link de la bio está roto">
        <textarea name="team_notes" rows={3} className="input" defaultValue={v("team_notes")} />
      </Field>
      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold">Contacto del prospecto (solo para nosotros)</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Nombre"><input name="contact_name" className="input" defaultValue={v("contact_name")} /></Field>
          <Field label="Correo"><input name="contact_email" type="email" className="input" defaultValue={v("contact_email")} /></Field>
          <Field label="WhatsApp / teléfono"><input name="contact_phone" className="input" defaultValue={v("contact_phone")} /></Field>
        </div>
      </details>
      {state?.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}
      <SubmitButton className="btn btn-primary">{submitLabel}</SubmitButton>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
