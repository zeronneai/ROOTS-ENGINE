import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
import { submitIntakeAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const TONES = ["Chistoso", "Directo", "Cálido", "Elegante", "Experto", "De barrio", "Inspirador", "Relajado", "Atrevido", "Familiar", "Premium", "Bilingüe / spanglish"];

export default async function IntakePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string; back?: string }> }) {
  const { token } = await params;
  const { ok, back } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token) || !process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  const { data: client } = await supabaseAdmin().from("clients").select("name").eq("intake_token", token).maybeSingle();
  if (!client) notFound();

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Logo />
      {ok ? (
        <div className="card glow mt-10 p-8 text-center">
          <h1 className="text-2xl font-bold">¡Gracias!</h1>
          <p className="mt-2 text-muted">Ya tenemos todo. Con esto armamos tu estrategia de contenido. Si quieres agregar algo más, puedes volver a llenar el formulario cuando quieras.</p>
        </div>
      ) : (
        <>
          <h1 className="mt-10 text-3xl font-bold">Cuéntanos de {client.name}</h1>
          <p className="mt-2 text-muted">
            Toma 5 minutos. Contesta lo que puedas, como si nos lo platicaras; no hay respuestas malas. Con esto armamos
            contenido que suene a ti.
          </p>
          <form action={submitIntakeAction.bind(null, token)} className="mt-8 space-y-6">
            {back ? <input type="hidden" name="back" value={back} /> : null}
            <F l="Tu nombre"><input name="nombre" className="input" /></F>
            <F l="¿Qué hace tu negocio? Explícalo como a un amigo"><textarea name="negocio" rows={3} className="input" /></F>
            <F l="Tus productos o servicios principales (y precios aproximados)"><textarea name="productos" rows={3} className="input" /></F>
            <F l="¿Quién es tu cliente ideal?"><textarea name="cliente_ideal" rows={2} className="input" placeholder="Edad, de dónde es, qué le preocupa, qué busca" /></F>
            <F l="¿Por qué te escogen a ti y no a la competencia?"><textarea name="diferente" rows={2} className="input" /></F>
            <F l="¿Por qué la gente duda antes de comprarte?"><textarea name="objeciones" rows={2} className="input" /></F>
            <div>
              <div className="label mb-2">¿Cómo se siente tu marca? (escoge las que quieras)</div>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <label key={t} className="chip cursor-pointer has-[:checked]:glow has-[:checked]:text-ink">
                    <input type="checkbox" name="tono" value={t} className="sr-only" />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <F l="Cuéntanos tu tono con tus palabras"><textarea name="tono_extra" rows={2} className="input" placeholder="Ej: hablamos como compas, con humor, pero sabemos lo que hacemos" /></F>
            <F l="Frases o palabras que usas mucho"><input name="frases" className="input" /></F>
            <F l="Cuentas o marcas que admiras (de cualquier giro)"><input name="admira" className="input" placeholder="@cuenta1, @cuenta2" /></F>
            <F l="Lo que NO quieres en tu contenido"><textarea name="no_quiere" rows={2} className="input" /></F>
            <F l="¿Dónde y con quién se puede grabar?"><textarea name="grabar" rows={2} className="input" placeholder="El local, tu equipo, clientes que se animen, productos..." /></F>
            <F l="¿Qué quieres que haga la gente después de ver tus videos?"><input name="cta" className="input" placeholder="Llamar, mandar WhatsApp, visitarte, comprar en línea..." /></F>
            <F l="Colores, logo o estilo visual"><input name="colores" className="input" /></F>
            <F l="¿Algo más que debamos saber?"><textarea name="extra" rows={3} className="input" /></F>
            <SubmitButton className="btn btn-primary w-full">Enviar</SubmitButton>
          </form>
        </>
      )}
    </main>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{l}</span>
      {children}
    </label>
  );
}
