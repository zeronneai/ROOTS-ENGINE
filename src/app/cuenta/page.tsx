import { requireViewer } from "@/server/auth";
import { TopBar } from "@/components/Shell";
import { ChangePassword } from "./ChangePassword";

export const dynamic = "force-dynamic";

/** Mi cuenta: poner o cambiar contraseña (agencia y clientes). */
export default async function CuentaPage() {
  const viewer = await requireViewer();
  const back = viewer.role === "agency" ? "/agency" : viewer.clientId ? `/c/${viewer.clientId}` : "/";
  return (
    <>
      <TopBar right={<a href={back} className="text-muted hover:text-ink">← Regresar</a>} />
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="display kicker-dot text-[11px] text-purple">Mi cuenta</p>
        <h1 className="mt-2 text-2xl font-bold">{viewer.email}</h1>
        <p className="mt-1 text-sm text-muted">{viewer.role === "agency" ? "Agencia" : "Cliente"}</p>
        <div className="card mt-6 p-5">
          <div className="font-semibold">Contraseña</div>
          <p className="mt-1 text-sm text-muted">Ponla una vez y ya entras con correo y contraseña, sin esperar correos.</p>
          <ChangePassword />
        </div>
      </main>
    </>
  );
}
