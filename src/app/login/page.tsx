import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const { next, e } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="card glow w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold">Entra a tu motor</h1>
        <p className="mt-1 text-sm text-muted">Entra con tu correo y contraseña, o pide un link a tu correo.</p>
        {e === "sin-acceso" ? (
          <p className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-xs text-bad">
            Tu correo todavía no tiene acceso. Pídele a Purple Roots que te dé de alta.
          </p>
        ) : null}
        <LoginForm next={next ?? "/agency"} />
      </div>
    </main>
  );
}
