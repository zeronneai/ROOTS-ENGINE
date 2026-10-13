"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FIELDS: [string, string][] = [
  ["negocio", "Qué hace el negocio"],
  ["productos", "Productos o servicios principales y precios"],
  ["cliente_ideal", "Su cliente ideal"],
  ["diferente", "Qué los hace diferentes"],
  ["objeciones", "Por qué la gente duda en comprarles"],
  ["tono_extra", "Cómo hablan (en sus palabras)"],
  ["frases", "Frases o palabras que usan mucho"],
  ["admira", "Cuentas o marcas que admiran"],
  ["no_quiere", "Lo que NO quieren en su contenido"],
  ["grabar", "Dónde y con quién se puede grabar"],
  ["cta", "Qué quieren que haga la gente (llamar, WhatsApp, visitar, comprar)"],
  ["colores", "Colores, logo o estilo visual"],
  ["extra", "Algo más"],
];

/** Formulario público del cliente: cae como insumo del Brand Brain. */
export async function submitIntakeAction(token: string, form: FormData) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error("Link inválido");
  const db = supabaseAdmin();
  const { data: client } = await db.from("clients").select("id").eq("intake_token", token).maybeSingle();
  if (!client) throw new Error("Link inválido");

  const val = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim().slice(0, 2000) : "";
  };
  const tones = form.getAll("tono").filter((t): t is string => typeof t === "string").slice(0, 12);
  const lines = [
    `Contacto: ${val("nombre") || "sin nombre"}`,
    tones.length ? `Tono que eligieron: ${tones.join(", ")}` : "",
    ...FIELDS.map(([k, label]) => (val(k) ? `${label}: ${val(k)}` : "")),
  ].filter(Boolean);

  await db.from("brand_inputs").insert({
    client_id: client.id,
    kind: "note",
    title: "Formulario del cliente",
    content: lines.join("\n"),
    added_by_role: "client",
  });
  redirect(`/intake/${token}?ok=1`);
}
