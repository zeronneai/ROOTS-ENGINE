import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/agency";
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  const safe = /^\/(?![\/\\])/.test(next) ? next : "/agency";
  const target = new URL(safe, url.origin);
  return NextResponse.redirect(target.origin === url.origin ? target : new URL("/agency", url.origin));
}
