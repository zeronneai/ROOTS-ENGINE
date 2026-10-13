import Link from "next/link";
import { loadClient } from "@/server/load";
import { ClientNav } from "@/components/ClientNav";
import { MobileNav } from "@/components/MobileNav";
import { NoBackend, TopBar } from "@/components/Shell";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS } from "@/lib/types";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <NoBackend />;
  const { id } = await params;
  const { client, isAgency, viewer } = await loadClient(id);
  const niche = NICHES.find((n) => n.id === client.niche)?.label ?? "Sin giro";
  return (
    <>
      <TopBar
        right={
          <>
            {isAgency ? <Link href="/agency" className="hidden text-muted hover:text-ink lg:inline">← Clientes</Link> : null}
            <span className="hidden text-muted lg:inline">{viewer.email}</span>
            {/* en celular: el cliente arriba a la derecha */}
            <span className="max-w-[45vw] truncate text-right text-sm font-semibold lg:hidden">{client.name}</span>
          </>
        }
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-5 pb-28 sm:px-5 lg:grid-cols-[220px_1fr] lg:py-8">
        <aside className="hidden space-y-6 lg:block">
          <div className="card p-4">
            <div className="text-lg font-semibold leading-tight">{client.name}</div>
            <div className="mt-1 text-xs text-muted">{niche}</div>
            <span className="chip mt-3">{PLAN_TIERS[client.plan_tier]?.label}</span>
          </div>
          <ClientNav clientId={id} isAgency={isAgency} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
      <MobileNav clientId={id} isAgency={isAgency} />
    </>
  );
}
