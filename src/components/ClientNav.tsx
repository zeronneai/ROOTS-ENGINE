"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ClientNav({ clientId, isAgency }: { clientId: string; isAgency: boolean }) {
  const path = usePathname();
  const base = `/c/${clientId}`;
  const items = [
    { href: base, label: "Resumen", n: "00" },
    { href: `${base}/reporte`, label: "Reporte", n: "✦" },
    { href: `${base}/marca`, label: "Marca", n: "01" },
    { href: `${base}/competencia`, label: "Competencia", n: "02" },
    { href: `${base}/plan`, label: "Plan semanal", n: "03" },
    { href: `${base}/videos`, label: "Videos", n: "04" },
    { href: `${base}/estilo`, label: "Estilo de edición", n: "05" },
    ...(isAgency ? [{ href: `${base}/ajustes`, label: "Ajustes", n: "··" }] : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((i) => {
        const active = i.href === base ? path === base : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-cream text-ink glow" : "text-muted hover:text-ink"
            }`}
          >
            <span className="font-mono text-[10px] text-purple">{i.n}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
