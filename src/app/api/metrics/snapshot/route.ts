import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { snapshotDue } from "@/server/social-snapshots";

export const maxDuration = 300;

/** Lo llama el cron diario de Vercel: foto de las redes públicas de los clientes del panel. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const fromCron = secret ? auth === `Bearer ${secret}` : /vercel-cron/i.test(req.headers.get("user-agent") ?? "");
  if (!fromCron) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  const out = await snapshotDue(supabaseAdmin());
  return NextResponse.json({ ok: true, ...out });
}
