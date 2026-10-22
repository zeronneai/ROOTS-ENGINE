import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** ¿Es una precarga de Next o del navegador? Esas nunca deben cerrar la sesión. */
const isPrefetch = (r: Request) =>
  r.headers.has("next-router-prefetch") || /prefetch/i.test(r.headers.get("purpose") ?? "") || /prefetch/i.test(r.headers.get("sec-purpose") ?? "");

async function signOut(request: Request) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", request.url), 303);
  res.cookies.delete("pra_preview_client");
  return res;
}

/** Cerrar sesión: el botón manda un POST. */
export async function POST(request: Request) {
  return signOut(request);
}

/** Por si alguien abre /salir a mano. Las precargas no cierran la sesión. */
export async function GET(request: Request) {
  if (isPrefetch(request)) return new NextResponse(null, { status: 204 });
  return signOut(request);
}
