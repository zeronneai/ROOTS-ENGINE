"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientProfile } from "@/server/publishing";
import { appUrl } from "@/lib/email";
import { ADS_PLATFORMS, adsConnectUrl, type AdsPlatform } from "@/lib/metrics/zernio-metrics";

/** Agregar o quitar un cliente del panel de métricas. */
export async function setMetricsEnabledAction(clientId: string, enabled: boolean) {
  await requireAgency();
  await supabaseAdmin().from("clients").update({ metrics_enabled: enabled }).eq("id", clientId);
  revalidatePath("/metrics");
  if (!enabled) redirect("/metrics");
}

export async function addToMetricsAction(form: FormData) {
  const id = String(form.get("client_id") ?? "");
  if (id) await setMetricsEnabledAction(id, true);
}

/** Conectar una cuenta de anuncios del cliente (abre el login de Meta o Google en Zernio). */
export async function connectAdsAction(clientId: string, platform: AdsPlatform) {
  await requireAgency();
  if (!(platform in ADS_PLATFORMS)) throw new Error("Plataforma desconocida");
  const db = supabaseAdmin();
  const profileId = await clientProfile(db, clientId);
  const back = `${appUrl()}/metrics/${clientId}`;
  const { url, alreadyConnected } = await adsConnectUrl(profileId, platform, `${back}?anuncios=conectado`);
  if (alreadyConnected || !url) redirect(`/metrics/${clientId}?anuncios=ya`);
  redirect(url);
}

/** Cuál cuenta publicitaria es la de este cliente, cuando la conexión ve varias. */
export async function chooseAdAccountAction(clientId: string, connectionId: string, form: FormData) {
  await requireAgency();
  const adAccountId = String(form.get("ad_account") ?? "");
  const db = supabaseAdmin();
  const { data } = await db.from("clients").select("ad_accounts").eq("id", clientId).single();
  const map = { ...((data?.ad_accounts ?? {}) as Record<string, string>) };
  if (adAccountId) map[connectionId] = adAccountId;
  else delete map[connectionId];
  await db.from("clients").update({ ad_accounts: map }).eq("id", clientId);
  revalidatePath(`/metrics/${clientId}`);
}
