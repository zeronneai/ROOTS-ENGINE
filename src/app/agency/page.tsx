export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS, type ClientRow } from "@/lib/types";
import { Empty, NoBackend, PageTitle, TopBar } from "@/components/Shell";
import { addAgencyMemberAction } from "../actions";
import { createInviteAction, deleteInviteAction } from "../access-actions";
import { CopyLink } from "@/components/CopyLink";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AgencyHome() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <NoBackend />;
  const viewer = await requireAgency();
  const db = supabaseAdmin();
  const [{ data: clients }, { data: edits }, { data: ideas }, { data: invites }] = await Promise.all([
    db.from("clients").select("*").order("created_at", { ascending: false }),
    db.from("edits").select("client_id, status"),
    db.from("content_ideas").select("client_id, status, publish_date").gte("publish_date", weekAgo()),
    db.from("signup_invites").select("*").is("used_at", null).order("created_at", { ascending: false }),
  ]);

  const count = (arr: { client_id: string; status: string }[] | null, id: string, statuses: string[]) =>
    (arr ?? []).filter((x) => x.client_id === id && statuses.includes(x.status)).length;
  const nicheLabel = (id: string | null) => NICHES.find((n) => n.id === id)?.label ?? "Sin giro";

  return (
    <>
      <TopBar
        right={
          <>
            <a href="/cuenta" className="hidden text-muted hover:text-ink sm:inline">{viewer.email} · Mi cuenta</a>
            <a href="/salir" className="btn btn-ghost !py-1.5 text-xs">Cerrar sesión</a>
          </>
        }
      />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <PageTitle kicker="Agencia" title="Clientes">
          <Link href="/agency/costos" className="btn btn-ghost">
            $ Costos
          </Link>
          <Link href="/agency/nuevo" className="btn btn-primary">
            + Nuevo cliente
          </Link>
        </PageTitle>

        {!clients?.length ? (
          <Empty title="Todavía no hay clientes">Da de alta el primero con lo que ya saben de él. El resto lo completa el motor.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(clients as ClientRow[]).map((c, n) => (
              <Link key={c.id} href={`/c/${c.id}`} className="card relative overflow-hidden p-5 pt-6 transition hover:border-purple/70">
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: ["#4f4789", "#ffb17a", "#fce762"][n % 3] }} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{c.name}</div>
                    <div className="text-sm text-muted">{nicheLabel(c.niche)} · {c.city}</div>
                  </div>
                  <span className="chip">{PLAN_TIERS[c.plan_tier]?.label ?? c.plan_tier}</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <Stat n={count(ideas, c.id, ["idea", "approved"])} l="Por grabar" />
                  <Stat n={count(edits, c.id, ["review", "agency_editing"])} l="Por revisar" />
                  <Stat n={count(edits, c.id, ["done"])} l="Listos" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <section className="card mt-12 p-5" style={{ background: "linear-gradient(120deg, #fffded, #fff 70%)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Links de registro para clientes nuevos</h2>
              <p className="text-sm text-muted">Cada link sirve una vez. El cliente llena sus datos, crea su contraseña y entra directo a su portal.</p>
            </div>
            <form action={createInviteAction} className="flex w-full flex-wrap gap-2 sm:w-auto">
              <input name="label" placeholder="Para quién (opcional)" className="input sm:w-44" />
              <select name="plan_tier" className="input sm:w-40" defaultValue="plan">
                {Object.entries(PLAN_TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <SubmitButton className="btn btn-primary">+ Crear link</SubmitButton>
            </form>
          </div>
          {invites?.length ? (
            <ul className="mt-4 space-y-3">
              {invites.map((i) => (
                <li key={i.token} className="rounded-xl border border-line bg-white p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{i.label || "Sin nombre"}</span>
                    <span className="chip">{PLAN_TIERS[i.plan_tier as keyof typeof PLAN_TIERS]?.label}</span>
                    <form action={deleteInviteAction.bind(null, i.token)} className="ml-auto">
                      <SubmitButton className="text-xs text-muted hover:text-bad">borrar</SubmitButton>
                    </form>
                  </div>
                  <CopyLink path={`/empezar/${i.token}`} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="card mt-6 max-w-xl p-5">
          <div className="label">Dar acceso a alguien del equipo</div>
          <form action={addAgencyMemberAction} className="mt-3 flex gap-2">
            <input name="email" type="email" required placeholder="correo@purpleroots.agency" className="input" />
            <SubmitButton className="btn btn-ghost">Agregar</SubmitButton>
          </form>
        </section>
      </main>
    </>
  );
}

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-xl bg-cream py-2">
      <div className="text-xl font-bold">{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{l}</div>
    </div>
  );
}
