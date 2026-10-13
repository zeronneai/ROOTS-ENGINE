export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS, type ClientRow } from "@/lib/types";
import { Empty, NoBackend, PageTitle, TopBar } from "@/components/Shell";
import { addAgencyMemberAction } from "../actions";

export default async function AgencyHome() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <NoBackend />;
  const viewer = await requireAgency();
  const db = supabaseAdmin();
  const [{ data: clients }, { data: edits }, { data: ideas }] = await Promise.all([
    db.from("clients").select("*").order("created_at", { ascending: false }),
    db.from("edits").select("client_id, status"),
    db.from("content_ideas").select("client_id, status, publish_date").gte("publish_date", weekAgo()),
  ]);

  const count = (arr: { client_id: string; status: string }[] | null, id: string, statuses: string[]) =>
    (arr ?? []).filter((x) => x.client_id === id && statuses.includes(x.status)).length;
  const nicheLabel = (id: string | null) => NICHES.find((n) => n.id === id)?.label ?? "Sin giro";

  return (
    <>
      <TopBar right={<span className="text-muted">{viewer.email}</span>} />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <PageTitle kicker="Agencia" title="Clientes">
          <Link href="/agency/nuevo" className="btn btn-primary">
            + Nuevo cliente
          </Link>
        </PageTitle>

        {!clients?.length ? (
          <Empty title="Todavía no hay clientes">Da de alta el primero con lo que ya saben de él. El resto lo completa el motor.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(clients as ClientRow[]).map((c) => (
              <Link key={c.id} href={`/c/${c.id}`} className="card p-5 transition hover:border-purple/70">
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

        <section className="card mt-12 max-w-xl p-5">
          <div className="label">Dar acceso a alguien del equipo</div>
          <form action={addAgencyMemberAction} className="mt-3 flex gap-2">
            <input name="email" type="email" required placeholder="correo@purpleroots.agency" className="input" />
            <button className="btn btn-ghost">Agregar</button>
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
    <div className="rounded-xl border border-line py-2">
      <div className="text-xl font-bold">{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{l}</div>
    </div>
  );
}
