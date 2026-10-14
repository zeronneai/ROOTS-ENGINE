import { clientRoute } from "@/server/api";
import { getClientContext } from "@/server/engine";
import { loadResearch } from "@/server/research";
import { suggestFlyerIdeas } from "@/lib/ai/flyer";
import { upcomingDates } from "@/lib/special-dates";

export const maxDuration = 120;

/** Ideas de flyer con base en la investigación del cliente y las fechas especiales que vienen. */
export const POST = clientRoute(async ({ clientId, body, db }) => {
  const ctx = await getClientContext(db, clientId);
  const { data: recent } = await db.from("flyers").select("brief").eq("client_id", clientId).order("created_at", { ascending: false }).limit(8);
  const ideas = await suggestFlyerIdeas({
    brand: ctx.brand.data,
    client: { name: ctx.client.name, niche: ctx.client.niche, city: ctx.client.city },
    research: await loadResearch(db, clientId, ctx.brand.data),
    dates: upcomingDates(new Date(), 45),
    recent: (recent ?? []).map((r) => r.brief),
    hint: typeof body.hint === "string" ? body.hint.slice(0, 300) : null,
  });
  return { ideas };
});
