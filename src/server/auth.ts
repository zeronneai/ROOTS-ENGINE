import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  role: "agency" | "client";
  clientId: string | null;
};

export async function getViewer(): Promise<Viewer | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as Viewer["role"]) ?? "client",
    clientId: profile?.client_id ?? null,
  };
}

export async function requireViewer() {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

export async function requireAgency() {
  const v = await requireViewer();
  if (v.role !== "agency") redirect(v.clientId ? `/c/${v.clientId}` : "/login?e=sin-acceso");
  return v;
}

export async function requireClientAccess(clientId: string) {
  const v = await requireViewer();
  if (v.role !== "agency" && v.clientId !== clientId) redirect("/login?e=sin-acceso");
  return v;
}

/** Para API routes: regresa null en vez de redirigir. */
export async function canAccess(clientId: string) {
  const v = await getViewer();
  if (!v) return null;
  if (v.role === "agency" || v.clientId === clientId) return v;
  return null;
}
