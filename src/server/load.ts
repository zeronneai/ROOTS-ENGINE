import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireClientAccess } from "./auth";
import { getClientContext } from "./engine";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const PREVIEW_COOKIE = "pra_preview_client";

/** Carga el cliente validando acceso. Memoizado por request. */
export const loadClient = cache(async (clientId: string) => {
  const viewer = await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const ctx = await getClientContext(db, clientId);
  // la agencia puede "ver como cliente" para revisar o hacer demos
  const previewing = viewer.role === "agency" && (await cookies()).get(PREVIEW_COOKIE)?.value === clientId;
  return { viewer, db, ...ctx, isAgency: viewer.role === "agency" && !previewing, previewing };
});

export type Pending = { key: string; text: string; href: string; tone: "todo" | "tip" };

/** Lo que le falta al cliente: preguntas, formulario, ideas por aprobar, videos por revisar. */
export const loadPendings = cache(async (clientId: string) => {
  const { db, client, brand } = await loadClient(clientId);
  const [{ data: titled }, { data: ideas }, { count: review }, { count: reports }, { count: toApprove }] = await Promise.all([
    db.from("brand_inputs").select("title").eq("client_id", clientId).not("title", "is", null),
    db.from("content_ideas").select("status").eq("client_id", clientId).eq("status", "idea"),
    db.from("edits").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "review"),
    db.from("reports").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    db.from("queue_items").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "pending"),
  ]);
  const titles = new Set((titled ?? []).map((t) => t.title));
  const openQ = (brand.data.openQuestions ?? []).filter((q) => !titles.has(q)).length;
  const base = `/c/${clientId}`;
  const list: Pending[] = [];
  if (!titles.has("Formulario del cliente"))
    list.push({ key: "intake", text: "Cuéntanos de tu negocio (5 min). Con eso el análisis sale mucho más preciso.", href: `/intake/${client.intake_token}?back=${base}`, tone: "todo" });
  if (openQ) list.push({ key: "q", text: `Tienes ${openQ} pregunta${openQ > 1 ? "s" : ""} rápida${openQ > 1 ? "s" : ""} por contestar.`, href: `${base}#preguntas`, tone: "todo" });
  if (ideas?.length) list.push({ key: "ideas", text: `${ideas.length} idea${ideas.length > 1 ? "s" : ""} de video esperando tu aprobación.`, href: `${base}/plan`, tone: "todo" });
  if (toApprove) list.push({ key: "approve", text: `${toApprove} video${toApprove > 1 ? "s" : ""} con copy listo${toApprove > 1 ? "s" : ""} para aprobar.`, href: `${base}/aprobar`, tone: "todo" });
  if (review) list.push({ key: "review", text: `${review} video${review > 1 ? "s" : ""} listo${review > 1 ? "s" : ""} para revisar.`, href: `${base}/videos`, tone: "todo" });
  if (!client.instagram && !client.tiktok)
    list.push({ key: "social", text: "Agrega tu Instagram o TikTok para que podamos analizar lo que ya publicas.", href: `/intake/${client.intake_token}?back=${base}`, tone: "tip" });
  if (!(brand.data.references?.creatorsTheyLike ?? []).length)
    list.push({ key: "refs", text: "Comparte cuentas que admires. Nos ayuda a encontrar mejores referencias.", href: `${base}/competencia`, tone: "tip" });
  return { list, todo: list.filter((p) => p.tone === "todo").length, hasReport: (reports ?? 0) > 0 };
});
