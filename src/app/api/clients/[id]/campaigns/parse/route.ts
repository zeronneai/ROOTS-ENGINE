import { clientRoute } from "@/server/api";
import { parseEventList } from "@/lib/ai/campaign";

export const maxDuration = 120;

/** Lee una lista pegada y la convierte en eventos con fecha. */
export const POST = clientRoute(
  async ({ body }) => {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 5) throw new Error("Pega la lista primero");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chihuahua" });
    return parseEventList(text, today);
  },
  { agencyOnly: true },
);
