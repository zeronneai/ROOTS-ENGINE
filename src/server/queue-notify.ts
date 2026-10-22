/** Correo al cliente: "tienes videos nuevos por aprobar". Sin "server-only": lo usa el worker. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl, sendEmail, simpleEmail } from "../lib/email";

export async function notifyNewForApproval(db: SupabaseClient, clientId: string, added: number, log: (m: string) => void) {
  const [{ data: client }, { data: members }, { count: pending }] = await Promise.all([
    db.from("clients").select("name").eq("id", clientId).single(),
    db.from("members").select("email").eq("client_id", clientId).eq("role", "client"),
    db.from("queue_items").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "pending"),
  ]);
  const to = (members ?? []).map((m) => m.email as string);
  if (!to.length) {
    log("   (el cliente no tiene correo con acceso, no se mandó aviso)");
    return;
  }
  const total = pending ?? added;
  const { html, text } = simpleEmail(
    `${total} video${total > 1 ? "s" : ""} listo${total > 1 ? "s" : ""} para aprobar`,
    [
      `Hola, ya subimos ${added} video${added > 1 ? "s" : ""} nuevo${added > 1 ? "s" : ""} para ${client?.name ?? "tu marca"}, cada uno con su copy listo.`,
      "Revísalos, cambia lo que quieras y dale Aprobar. Los aprobados se publican solos en los días y horas que acordamos.",
    ],
    { label: "Revisar videos", href: `${appUrl()}/c/${clientId}/aprobar` },
  );
  const r = await sendEmail({ to, subject: `${client?.name ?? "Purple Roots"}: tienes videos por aprobar`, html, text });
  if (r.sent) await db.from("clients").update({ approval_notified_at: new Date().toISOString() }).eq("id", clientId);
  log(r.sent ? `   ✉ aviso enviado a ${to.join(", ")}` : `   (no se mandó el correo: ${r.reason})`);
}
