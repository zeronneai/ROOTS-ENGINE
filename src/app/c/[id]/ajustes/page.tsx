import { redirect } from "next/navigation";
import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS } from "@/lib/types";
import { addMemberAction, updateClientAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AjustesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, client, isAgency } = await loadClient(id);
  if (!isAgency) redirect(`/c/${id}`);
  const { data: members } = await db.from("members").select("email").eq("client_id", id);

  return (
    <>
      <PageTitle kicker="Ajustes" title="Datos del cliente" />
      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <form action={updateClientAction.bind(null, id)} className="card grid gap-4 p-6 sm:grid-cols-2">
          <F l="Nombre"><input name="name" defaultValue={client.name} className="input" /></F>
          <F l="Giro">
            <select name="niche" defaultValue={client.niche ?? ""} className="input">
              {NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </F>
          <F l="Ciudad"><input name="city" defaultValue={client.city ?? ""} className="input" /></F>
          <F l="Idioma">
            <select name="language" defaultValue={client.language} className="input">
              <option value="es">Español</option><option value="en">Inglés</option><option value="bilingual">Bilingüe</option>
            </select>
          </F>
          <F l="Instagram"><input name="instagram" defaultValue={client.instagram ?? ""} className="input" /></F>
          <F l="TikTok"><input name="tiktok" defaultValue={client.tiktok ?? ""} className="input" /></F>
          <F l="Sitio web"><input name="website" defaultValue={client.website ?? ""} className="input" /></F>
          <F l="Link de Google Maps"><input name="google_maps_url" defaultValue={(client as { google_maps_url?: string | null }).google_maps_url ?? ""} className="input" /></F>
          <F l="Plan">
            <select name="plan_tier" defaultValue={client.plan_tier} className="input">
              {Object.entries(PLAN_TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </F>
          <F l="Estatus">
            <select name="status" defaultValue={client.status} className="input">
              <option value="onboarding">Onboarding</option><option value="active">Activo</option><option value="paused">Pausado</option>
            </select>
          </F>
          <div className="sm:col-span-2"><SubmitButton className="btn btn-primary">Guardar</SubmitButton></div>
        </form>
        <aside className="card space-y-3 p-5">
          <div className="font-semibold">Acceso del cliente</div>
          <ul className="space-y-1 text-sm text-muted">
            {(members ?? []).map((m) => <li key={m.email}>{m.email}</li>)}
            {!members?.length ? <li>Nadie todavía</li> : null}
          </ul>
          <form action={addMemberAction.bind(null, id)} className="space-y-2">
            <input name="email" type="email" required placeholder="correo del cliente" className="input" />
            <SubmitButton className="btn btn-ghost w-full">Dar acceso</SubmitButton>
          </form>
          <p className="text-xs text-muted">Entra en /login con ese correo y le llega un link. Ve solo su propio portal.</p>
        </aside>
      </div>
    </>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="label">{l}</span>{children}</label>;
}
