"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const I = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  report: "M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 0v5h5M9 13h7M9 17h5",
  plan: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4",
  video: "M4 6h11v12H4zM15 10l5-3v10l-5-3",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Barra fija abajo en el celular con lo más usado; "Más" abre el resto. */
export function MobileNav({ clientId, isAgency }: { clientId: string; isAgency: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/c/${clientId}`;
  const main = [
    { href: base, label: "Resumen", icon: I.home },
    { href: `${base}/reporte`, label: "Reporte", icon: I.report },
    { href: `${base}/plan`, label: "Plan", icon: I.plan },
    { href: `${base}/videos`, label: "Videos", icon: I.video },
  ];
  const more = [
    { href: `${base}/marca`, label: "Marca" },
    { href: `${base}/competencia`, label: "Competencia" },
    { href: `${base}/estilo`, label: "Estilo de edición" },
    ...(isAgency ? [{ href: `${base}/ajustes`, label: "Ajustes" }, { href: "/agency", label: "← Todos los clientes" }] : []),
  ];
  const isActive = (href: string) => (href === base ? path === base : path.startsWith(href));
  const moreActive = more.some((m) => m.href !== "/agency" && isActive(m.href));

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-3 rounded-2xl border border-line bg-white p-2 shadow-xl"
            style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {more.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-3 text-[15px] ${isActive(m.href) && m.href !== "/agency" ? "bg-cream font-semibold" : ""}`}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 backdrop-blur lg:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {main.map((m) => {
            const a = isActive(m.href);
            return (
              <Link key={m.href} href={m.href} onClick={() => setOpen(false)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${a ? "text-purple" : "text-muted"}`}>
                <span className={`grid h-8 w-12 place-items-center rounded-full ${a ? "bg-sun/70" : ""}`}><Icon d={m.icon} /></span>
                {m.label}
              </Link>
            );
          })}
          <button onClick={() => setOpen((o) => !o)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${open || moreActive ? "text-purple" : "text-muted"}`}>
            <span className={`grid h-8 w-12 place-items-center rounded-full ${open || moreActive ? "bg-sun/70" : ""}`}><Icon d={I.more} /></span>
            Más
          </button>
        </div>
      </nav>
    </>
  );
}
