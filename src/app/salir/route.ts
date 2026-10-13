import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Cerrar sesión. */
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete("pra_preview_client");
  return res;
}
