import Link from "next/link";
import { Logo } from "./Logo";

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link href="/agency">
          <Logo small />
        </Link>
        <div className="flex items-center gap-3 text-sm">{right}</div>
      </div>
    </header>
  );
}

export function PageTitle({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? <p className="display text-[11px] text-lavender">{kicker}</p> : null}
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card grid place-items-center p-10 text-center">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-2 max-w-md text-sm text-muted">{children}</div>
    </div>
  );
}

export function NoBackend() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <Empty title="Falta conectar Supabase">
        Copia <code>.env.example</code> a <code>.env.local</code> y llena las llaves de Supabase. Mientras, la demo del
        editor funciona en la página principal.
      </Empty>
    </main>
  );
}
