import Link from "next/link";
import { loadClient } from "@/server/load";
import { ClientNav } from "@/components/ClientNav";
import { NoBackend, TopBar } from "@/components/Shell";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS } from "@/lib/types";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <NoBackend />;
  const { id } = await params;
  const { client, isAgency, viewer } = await loadClient(id);
  return (
    <>
      <TopBar
        right={
          <>
            {isAgency ? <Link href="/agency" className="text-muted hover:text-white">← Clientes</Link> : null}
            <span className="hidden text-muted sm:inline">{viewer.email}</span>
          </>
        }
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-6">
          <div className="card p-4">
            <div className="text-lg font-semibold leading-tight">{client.name}</div>
            <div className="mt-1 text-xs text-muted">{NICHES.find((n) => n.id === client.niche)?.label ?? "Sin giro"}</div>
            <span className="chip mt-3">{PLAN_TIERS[client.plan_tier]?.label}</span>
          </div>
          <ClientNav clientId={id} isAgency={isAgency} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
