"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ClientNav({ clientId, isAgency, badge = 0 }: { clientId: string; isAgency: boolean; badge?: number }) {
  const path = usePathname();
  const base = `/c/${clientId}`;
  const items = [
    { href: base, label: "Resumen", n: "00" },
    { href: `${base}/reporte`, label: "Reporte", n: "✦" },
    { href: `${base}/marca`, label: "Marca", n: "01" },
    { href: `${base}/competencia`, label: "Competencia", n: "02" },
    { href: `${base}/plan`, label: "Plan semanal", n: "03" },
    { href: `${base}/campanas`, label: "Campañas", n: "✦" },
    { href: `${base}/videos`, label: "Videos", n: "04" },
    { href: `${base}/flyers`, label: "Flyers", n: "✦" },
    { href: `${base}/rebranding`, label: "Rebranding", n: "✦" },
    { href: `${base}/estilo`, label: "Estilo de edición", n: "05" },
    ...(isAgency ? [{ href: `${base}/ajustes`, label: "Ajustes", n: "··" }] : []),
  ];
  return (
    <nav className="flex flex-col gap-1 p-1">
      {items.map((i) => {
        const active = i.href === base ? path === base : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-sun/60 font-semibold text-ink" : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            <span className="font-mono text-[10px] text-purple">{i.n}</span>
            {i.label}
            {i.href === base && badge > 0 ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-peach px-1.5 text-[11px] font-bold text-ink">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
