import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
import { SignupForm } from "./SignupForm";
import { NICHES } from "@/lib/styles/presets";

export const dynamic = "force-dynamic";

/** Registro de un cliente nuevo con link de un solo uso. */
export default async function EmpezarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token) || !process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  const { data: invite } = await supabaseAdmin().from("signup_invites").select("used_at").eq("token", token).maybeSingle();
  if (!invite) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-5 sm:py-12">
      <Logo />
      {invite.used_at ? (
        <div className="card mt-10 p-8 text-center">
          <h1 className="text-2xl font-bold">Este link ya se usó</h1>
          <p className="mt-2 text-muted">Si ya creaste tu cuenta, entra con tu correo y contraseña.</p>
          <a href="/login" className="btn btn-primary mt-6">Entrar</a>
        </div>
      ) : (
        <>
          <p className="display mt-10 text-[11px] text-purple">Bienvenido a Roots Engine</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Crea tu <span className="mark">motor de contenido</span>
          </h1>
          <p className="mt-3 text-muted">
            Danos lo básico de tu negocio. Con eso revisamos tus redes, tu Google y a tu competencia, y te armamos tu
            estrategia y tus videos de la semana.
          </p>
          <SignupForm token={token} niches={NICHES.map((n) => ({ id: n.id, label: n.label }))} />
        </>
      )}
    </main>
  );
}
