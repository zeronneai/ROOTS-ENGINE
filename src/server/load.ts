import "server-only";
import { cache } from "react";
import { requireClientAccess } from "./auth";
import { getClientContext } from "./engine";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Carga el cliente validando acceso. Memoizado por request. */
export const loadClient = cache(async (clientId: string) => {
  const viewer = await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const ctx = await getClientContext(db, clientId);
  return { viewer, db, ...ctx, isAgency: viewer.role === "agency" };
});
