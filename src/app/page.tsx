import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StyleLab } from "@/components/StyleLab";
import { demoWords, DEMO_DURATION } from "@/remotion/demo";
import { PLAN_TIERS } from "@/lib/types";

const STEPS = [
  { n: "01", t: "Encuentra a tu competencia", d: "Escaneamos las cuentas que más pegan en tu giro y detectamos sus videos outlier." },
  { n: "02", t: "Desarma lo que funciona", d: "El hook, la estructura y por qué funcionó. Sin adivinar." },
  { n: "03", t: "Planea qué grabar", d: "Cada semana: ideas probadas, 3 hooks, guion y lista de tomas hecha para ti." },
  { n: "04", t: "Edita con TU estilo", d: "Subes el clip y el motor lo edita con el estilo de tu marca. O lo edita nuestro equipo." },
  { n: "05", t: "Publica y aprende", d: "Medimos qué funcionó y el siguiente plan sale más afilado." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Link href="/login" className="btn btn-ghost">
          Entrar
        </Link>
      </header>

      <section className="grid items-center gap-10 py-14 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="display text-xs text-lavender">Purple Roots Agency · El Paso / Juárez</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Deja de adivinar
            <br />
            <span className="mark text-purple">qué publicar.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Roots Engine investiga a tu competencia, te dice exactamente qué grabar esta semana y edita tus videos con el
            estilo de tu marca. Tú grabas con tu celular, nosotros hacemos lo demás.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#lab" className="btn btn-primary">
              Ver el editor en vivo
            </a>
            <Link href="/login" className="btn btn-ghost">
              Soy cliente
            </Link>
          </div>
        </div>

        <ol className="card glow space-y-1 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="display text-xs">Content Engine</span>
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Automation on
            </span>
          </div>
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-xl px-3 py-3 hover:bg-purple/5">
              <span className="font-mono text-xs text-purple">{s.n}</span>
              <div>
                <div className="font-semibold">{s.t}</div>
                <div className="text-sm text-muted">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="lab" className="py-14">
        <p className="display text-xs text-lavender">Laboratorio de estilo</p>
        <h2 className="mt-3 text-3xl font-bold">El mismo clip. Cada negocio con su propio look.</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Una barbería no se puede ver igual que un despacho de abogados. Cambia el estilo y mira cómo el motor ajusta
          subtítulos, zooms, emojis, sonidos y color.
        </p>
        <div className="mt-8">
          <StyleLab
            src="/demo/sample.mp4"
            words={demoWords()}
            duration={DEMO_DURATION}
            hookTitle="El secreto que nadie te dice"
            handle="purplerootsagency"
          />
        </div>
      </section>

      <section className="py-14">
        <p className="display text-xs text-lavender">Planes</p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {Object.entries(PLAN_TIERS).map(([k, v]) => (
            <div key={k} className="card p-5">
              <div className="display text-sm">{v.label}</div>
              <p className="mt-3 text-sm text-muted">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
